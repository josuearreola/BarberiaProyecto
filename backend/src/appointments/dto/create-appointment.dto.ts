import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  nombreCompleto: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  telefono: string;

  @IsEmail({}, { message: 'El correo debe ser válido' })
  @IsOptional()
  correo?: string;

  @IsString()
  @IsNotEmpty({ message: 'El servicio es requerido' })
  servicio: string;

  @IsDateString({}, { message: 'La fecha debe ser válida' })
  @IsNotEmpty({ message: 'La fecha de la cita es requerida' })
  fechaCita: string;

  @IsString()
  @IsNotEmpty({ message: 'La hora de la cita es requerida' })
  horaCita: string;

  @IsString()
  @IsOptional()
  notas?: string;
}