import { IsIn } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class UpdateStatusDto {
  @IsIn(Object.values(AppointmentStatus))
  estado: AppointmentStatus;
}
