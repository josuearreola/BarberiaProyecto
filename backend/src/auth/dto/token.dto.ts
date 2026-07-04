import { IsNotEmpty, IsString } from 'class-validator';

export class TokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es requerido' })
  token: string;
}
