import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UsersService } from './users.service';
import { AuditLogService } from './audit-log.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog, RolePermission]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService, AuditLogService],
  exports: [UsersService, AuditLogService, TypeOrmModule],
})
export class UsersModule {}
