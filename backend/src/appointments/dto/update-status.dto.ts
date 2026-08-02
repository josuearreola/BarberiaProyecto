import { IsIn, IsString, IsOptional } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class UpdateStatusDto {
  @IsIn(Object.values(AppointmentStatus))
  estado: AppointmentStatus;

  @IsString()
  @IsOptional()
  nombreBarbero?: string;
}
