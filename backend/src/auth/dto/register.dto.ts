import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El usuario es requerido' })
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'El telefono es requerido' })
  telefono: string;

  @IsEmail({}, { message: 'El email debe ser valido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres' })
  password: string;
}
