import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(usuario: string, accion: string, ip: string): Promise<AuditLog> {
    const now = new Date();
    
    // Formatear fecha como YYYY-MM-DD
    const fecha = now.toISOString().split('T')[0];
    
    // Formatear hora como HH:MM:SS
    const hora = now.toTimeString().split(' ')[0];

    const auditLog = this.auditLogRepository.create({
      usuario,
      accion,
      ip: ip || '127.0.0.1',
      fecha,
      hora,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async findAll(page = 1, limit = 50, search?: string): Promise<{ data: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('log');

    if (search) {
      const term = `%${search.trim().toLowerCase()}%`;
      query.where(
        'LOWER(log.usuario) LIKE :term OR LOWER(log.accion) LIKE :term OR LOWER(log.ip) LIKE :term',
        { term }
      );
    }

    query.orderBy('log.id', 'DESC')
         .skip((page - 1) * limit)
         .take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }
}
