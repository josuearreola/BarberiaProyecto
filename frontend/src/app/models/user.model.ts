export type UserRole = 'admin' | 'cliente';
export type UserStatus = 'activo' | 'inactivo';

export interface User {
  id: number;
  usuario: string;
  telefono: string;
  email: string;
  role: UserRole;
  estado: UserStatus;
  creadoEn: string;
  actualizadoEn: string;
}
