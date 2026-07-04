import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get()
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  findAll(
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.appointmentsService.findAll({
      fecha,
      estado,
      search,
      sortBy,
      sortDir,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get(':id')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(+id);
  }

  @Get('fecha/:fecha')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  findByDate(@Param('fecha') fecha: string) {
    return this.appointmentsService.findByDate(fecha);
  }

  @Patch(':id/estado')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.appointmentsService.updateStatus(+id, body.estado);
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(+id, updateAppointmentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(+id);
  }
}
