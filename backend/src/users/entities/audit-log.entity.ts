import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario', length: 120 })
  usuario: string;

  @Column({ name: 'fecha', type: 'date', default: () => 'CURRENT_DATE' })
  fecha: string;

  @Column({ name: 'hora', type: 'time', default: () => 'CURRENT_TIME' })
  hora: string;

  @Column({ name: 'ip', length: 45 })
  ip: string;

  @Column({ name: 'accion', length: 255 })
  accion: string;
}
