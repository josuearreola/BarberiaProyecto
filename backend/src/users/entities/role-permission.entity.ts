import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('role_permissions')
@Unique(['role', 'permission'])
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role', length: 50 })
  role: string;

  @Column({ name: 'permission', length: 100 })
  permission: string;
}
