import 'express-session';
import { UserRole } from '../users/entities/user.entity';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    role?: UserRole;
    loginAt?: number;
  }
}
