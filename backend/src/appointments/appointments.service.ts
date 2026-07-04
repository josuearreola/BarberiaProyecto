import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

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

    const appointment =
      this.appointmentsRepository.create(createAppointmentDto);
    return await this.appointmentsRepository.save(appointment);
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

  async updateStatus(id: number, estado: string): Promise<Appointment> {
    const appointment = await this.findOne(id);
    appointment.estado = estado;
    return await this.appointmentsRepository.save(appointment);
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

    Object.assign(appointment, updateAppointmentDto);
    return await this.appointmentsRepository.save(appointment);
  }

  async remove(id: number): Promise<void> {
    const appointment = await this.findOne(id);
    await this.appointmentsRepository.remove(appointment);
  }
}
