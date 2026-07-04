import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El email debe ser valido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contrasena es requerida' })
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres' })
  password: string;
}
