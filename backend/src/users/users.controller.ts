import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole, UserStatus } from './entities/user.entity';
import { UsersService } from './users.service';
import { AuditLogService } from './audit-log.service';

@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('estado') estado?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    const normalizedRole =
      role === UserRole.Admin || role === UserRole.Cliente ? role : undefined;
    const normalizedEstado =
      estado === UserStatus.Activo || estado === UserStatus.Inactivo
        ? estado
        : undefined;

    return this.usersService.findAll({
      search,
      role: normalizedRole,
      estado: normalizedEstado,
      sortBy,
      sortDir,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(+id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Post(':id/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Param('id') id: string, @Body() body: { contrasena: string }) {
    await this.usersService.updatePassword(+id, body.contrasena);
    return { ok: true };
  }

  @Get('roles/permissions')
  async getPermissions() {
    return this.usersService.getAllPermissionsMap();
  }

  @Post('roles/permissions')
  async addPermission(@Body() body: { role: string; permission: string }) {
    return this.usersService.addRolePermission(body.role, body.permission);
  }

  @Delete('roles/permissions')
  async removePermission(@Query('role') role: string, @Query('permission') permission: string) {
    await this.usersService.removeRolePermission(role, permission);
    return { ok: true };
  }

  @Get('audit-logs/history')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogService.findAll(Number(page || 1), Number(limit || 50), search);
  }
}
