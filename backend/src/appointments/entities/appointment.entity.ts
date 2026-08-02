import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AppointmentStatus {
  Pendiente = 'pendiente',
  Confirmada = 'confirmada',
  Completada = 'completada',
  Cancelada = 'cancelada',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nombre_completo', length: 100 })
  nombreCompleto: string;

  @Column({ name: 'telefono', length: 20 })
  telefono: string;

  @Column({ name: 'correo', length: 100, nullable: true })
  correo: string;

  @Column({ name: 'servicio', length: 50 })
  servicio: string;

  @Column({ name: 'fecha_cita', type: 'date' })
  fechaCita: string;

  @Column({ name: 'hora_cita', length: 10 })
  horaCita: string;

  @Column({ name: 'estado', length: 20, default: AppointmentStatus.Pendiente })
  estado: string;

  @Column({ name: 'notas', type: 'text', nullable: true })
  notas: string;

  @Column({ name: 'nombre_barbero', length: 100, nullable: true })
  nombreBarbero: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}