import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole, UserStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  usuario: string;

  @IsString()
  @MinLength(10)
  telefono: string;

  @IsEmail({}, { message: 'El email debe ser valido' })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(Object.values(UserRole))
  @IsOptional()
  role?: UserRole;

  @IsIn(Object.values(UserStatus))
  @IsOptional()
  estado?: UserStatus;
}
