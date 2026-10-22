import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UsersService } from '../users/users.service';

import { BarberGateway } from '../barber.gateway';

export interface FindAppointmentsOptions {
  fecha?: string;
  estado?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    private readonly usersService: UsersService,
    private readonly barberGateway: BarberGateway,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const existing = await this.appointmentsRepository.findOne({
      where: {
        fechaCita: createAppointmentDto.fechaCita,
        horaCita: createAppointmentDto.horaCita,
        estado: Not(AppointmentStatus.Cancelada),
      },
    });

    if (existing) {
      throw new ConflictException('La hora seleccionada ya esta ocupada');
    }

    // Normalizar 'notas': Guardar siempre la ruta relativa (ej: uploads/audio/audio_123.m4a)
    if (createAppointmentDto.notas) {
      const match = createAppointmentDto.notas.match(/uploads\/audio\/[^?#\s]+/);
      if (match) {
        createAppointmentDto.notas = match[0];
      }
    }

    const appointment =
      this.appointmentsRepository.create(createAppointmentDto);
    const saved = await this.appointmentsRepository.save(appointment);

    // Emitimos el broadcast para que la TV (PWA) lo reciba en tiempo real
    if (this.barberGateway && this.barberGateway.server) {
      this.barberGateway.server.emit('new_appointment_broadcast', {
        id: saved.id,
        date: saved.fechaCita,
        time: saved.horaCita,
        barber: saved.nombreBarbero || 'Sin asignar',
        client: saved.nombreCompleto,
        status: saved.estado
      });
    }

    return saved;
  }

  async findClientAppointments(userId: number): Promise<Appointment[]> {
    if (!userId) {
      return [];
    }
    try {
      const user = await this.usersService.findById(userId);
      
      if (!user.email) {
        return [];
      }

      // Buscar citas únicamente por correo electrónico para ser precisos
      return await this.appointmentsRepository.find({
        where: { correo: user.email },
        order: {
          fechaCita: 'DESC',
          horaCita: 'DESC'
        }
      });
    } catch (e) {
      console.error('Error finding client appointments:', e);
      return [];
    }
  }

  async cancelClientAppointment(appointmentId: number, userId: number): Promise<Appointment> {
    const user = await this.usersService.findById(userId);
    const appointment = await this.findOne(appointmentId);
    
    // Verificar que la cita pertenezca al usuario (por correo o teléfono)
    if (appointment.correo !== user.email && appointment.telefono !== user.telefono) {
      throw new ConflictException('No tienes permiso para cancelar esta cita.');
    }
    
    // Verificar que la cita esté en estado pendiente
    if (appointment.estado !== AppointmentStatus.Pendiente) {
      throw new ConflictException('Solo se pueden cancelar citas en estado pendiente.');
    }
    
    appointment.estado = AppointmentStatus.Cancelada;
    const saved = await this.appointmentsRepository.save(appointment);

    if (this.barberGateway && this.barberGateway.server) {
      this.barberGateway.server.emit('cancel_appointment_broadcast', {
        id: saved.id
      });
      this.barberGateway.server.emit('appointment_status_changed', {
        id: saved.id,
        correo: saved.correo,
        telefono: saved.telefono,
        nombreCompleto: saved.nombreCompleto,
        servicio: saved.servicio,
        fechaCita: saved.fechaCita,
        horaCita: saved.horaCita,
        anteriorEstado: AppointmentStatus.Pendiente,
        estado: saved.estado,
        nombreBarbero: saved.nombreBarbero || 'Sin asignar',
      });
    }
    
    return saved;
  }

  async findAll(
    options: FindAppointmentsOptions = {},
  ): Promise<PaginatedResult<Appointment>> {
    const page =
      Number.isFinite(options.page) && Number(options.page) > 0
        ? Number(options.page)
        : 1;
    const limitCandidate = Number.isFinite(options.limit)
      ? Number(options.limit)
      : 10;
    const limit = Math.min(Math.max(limitCandidate, 1), 50);

    const sortMap: Record<string, string> = {
      creadoEn: 'appointment.creadoEn',
      fechaCita: 'appointment.fechaCita',
      estado: 'appointment.estado',
      nombreCompleto: 'appointment.nombreCompleto',
      servicio: 'appointment.servicio',
    };

    const sortBy = sortMap[options.sortBy ?? ''] ?? 'appointment.creadoEn';
    const sortDir: 'ASC' | 'DESC' =
      (options.sortDir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = this.appointmentsRepository.createQueryBuilder('appointment');

    if (options.fecha) {
      query.andWhere('appointment.fechaCita = :fecha', {
        fecha: options.fecha,
      });
    }

    if (options.estado) {
      query.andWhere('appointment.estado = :estado', {
        estado: options.estado,
      });
    }

    if (options.search) {
      const search = `%${options.search.trim().toLowerCase()}%`;
      query.andWhere(
        `(LOWER(appointment.nombreCompleto) LIKE :search
          OR LOWER(appointment.telefono) LIKE :search
          OR LOWER(COALESCE(appointment.correo, '')) LIKE :search
          OR LOWER(appointment.servicio) LIKE :search)`,
        { search },
      );
    }

    query.orderBy(sortBy, sortDir);
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita con id ${id} no encontrada`);
    }

    return appointment;
  }

  async findByDate(fecha: string): Promise<Appointment[]> {
    return await this.appointmentsRepository.find({
      where: { fechaCita: fecha },
      order: { horaCita: 'ASC' },
    });
  }

  async updateStatus(id: number, estado: string, nombreBarbero?: string): Promise<Appointment> {
    const appointment = await this.findOne(id);
    const anteriorEstado = appointment.estado;
    appointment.estado = estado;
    if (nombreBarbero) {
      appointment.nombreBarbero = nombreBarbero;
    }
    const saved = await this.appointmentsRepository.save(appointment);

    if (this.barberGateway && this.barberGateway.server) {
      this.barberGateway.server.emit('appointment_status_changed', {
        id: saved.id,
        correo: saved.correo,
        telefono: saved.telefono,
        nombreCompleto: saved.nombreCompleto,
        servicio: saved.servicio,
        fechaCita: saved.fechaCita,
        horaCita: saved.horaCita,
        anteriorEstado,
        estado: saved.estado,
        nombreBarbero: saved.nombreBarbero || 'Sin asignar',
      });
    }

    return saved;
  }

  async update(
    id: number,
    updateAppointmentDto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);

    if (updateAppointmentDto.fechaCita || updateAppointmentDto.horaCita) {
      const fecha = updateAppointmentDto.fechaCita ?? appointment.fechaCita;
      const hora = updateAppointmentDto.horaCita ?? appointment.horaCita;

      const existing = await this.appointmentsRepository.findOne({
        where: {
          fechaCita: fecha,
          horaCita: hora,
          estado: Not(AppointmentStatus.Cancelada),
        },
      });

      if (existing && existing.id !== appointment.id) {
        throw new ConflictException('La hora seleccionada ya esta ocupada');
      }
    }

    if (updateAppointmentDto.notas) {
      const match = updateAppointmentDto.notas.match(/uploads\/audio\/[^?#\s]+/);
      if (match) {
        updateAppointmentDto.notas = match[0];
      }
    }

    const anteriorEstado = appointment.estado;
    Object.assign(appointment, updateAppointmentDto);
    const saved = await this.appointmentsRepository.save(appointment);

    if (this.barberGateway && this.barberGateway.server && anteriorEstado !== saved.estado) {
      this.barberGateway.server.emit('appointment_status_changed', {
        id: saved.id,
        correo: saved.correo,
        telefono: saved.telefono,
        nombreCompleto: saved.nombreCompleto,
        servicio: saved.servicio,
        fechaCita: saved.fechaCita,
        horaCita: saved.horaCita,
        anteriorEstado,
        estado: saved.estado,
        nombreBarbero: saved.nombreBarbero || 'Sin asignar',
      });
    }

    return saved;
  }

  async remove(id: number): Promise<void> {
    const appointment = await this.findOne(id);
    await this.appointmentsRepository.remove(appointment);
  }

  generateAudioPresignedUrl(fileName?: string, baseUrl?: string) {
    const ext = fileName && fileName.includes('.') ? path.extname(fileName) : '.m4a';
    const uniqueName = `audio_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const expires = Date.now() + 15 * 60 * 1000; // Válida por 15 minutos

    const secret = process.env.SESSION_SECRET || 'audio_upload_secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${uniqueName}:${expires}`)
      .digest('hex');

    const cleanBaseUrl = (baseUrl || 'http://localhost:3000').replace(/\/$/, '');
    
    // uploadUrl es la URL preasignada a donde la app móvil subirá el audio con PUT
    const uploadUrl = `${cleanBaseUrl}/api/appointments/upload-audio?fileName=${encodeURIComponent(uniqueName)}&expires=${expires}&signature=${signature}`;
    
    // fileUrl es la URL absoluta para reproducción directa
    const fileUrl = `${cleanBaseUrl}/uploads/audio/${uniqueName}`;
    // relativePath es la ruta relativa recomendada para almacenar en la BD
    const relativePath = `uploads/audio/${uniqueName}`;

    return {
      uploadUrl,
      fileUrl,
      relativePath,
      fileName: uniqueName,
      expires,
    };
  }

  async saveUploadedAudio(
    fileName: string,
    expires: string,
    signature: string,
    fileBuffer: Buffer,
  ) {
    if (!fileName || !expires || !signature) {
      throw new BadRequestException('Faltan parámetros de la URL preasignada');
    }

    if (Date.now() > Number(expires)) {
      throw new UnauthorizedException('La URL preasignada ha expirado');
    }

    const secret = process.env.SESSION_SECRET || 'audio_upload_secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${fileName}:${expires}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Firma de URL preasignada inválida');
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('No se recibió contenido de audio');
    }

    const safeFileName = path.basename(fileName);
    const uploadsDir = path.join(process.cwd(), 'uploads', 'audio');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, safeFileName);
    await fs.promises.writeFile(filePath, fileBuffer);

    return {
      success: true,
      fileName: safeFileName,
      size: fileBuffer.length,
    };
  }
}
