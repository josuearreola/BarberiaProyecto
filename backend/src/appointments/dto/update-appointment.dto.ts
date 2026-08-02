import { IsString, IsOptional, IsEmail, IsDateString, IsIn } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class UpdateAppointmentDto {
  @IsString()
  @IsOptional()
  nombreCompleto?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsEmail({}, { message: 'El correo debe ser valido' })
  @IsOptional()
  correo?: string;

  @IsString()
  @IsOptional()
  servicio?: string;

  @IsDateString({}, { message: 'La fecha debe ser valida' })
  @IsOptional()
  fechaCita?: string;

  @IsString()
  @IsOptional()
  horaCita?: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsIn(Object.values(AppointmentStatus))
  @IsOptional()
  estado?: AppointmentStatus;

  @IsString()
  @IsOptional()
  nombreBarbero?: string;
}
