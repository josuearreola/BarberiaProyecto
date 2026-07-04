import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  Admin = 'admin',
  Cliente = 'cliente',
}

export enum UserStatus {
  Activo = 'activo',
  Inactivo = 'inactivo',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario', length: 50, unique: true })
  usuario: string;

  @Column({ name: 'telefono', length: 20 })
  telefono: string;

  @Column({ name: 'email', length: 120, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'role', length: 20, default: UserRole.Cliente })
  role: UserRole;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.Activo,
  })
  estado: UserStatus;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
