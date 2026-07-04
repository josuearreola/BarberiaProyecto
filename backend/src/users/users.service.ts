import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

const bcryptClient = bcrypt as {
  hash(password: string, rounds: number): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
};

export interface FindUsersOptions {
  search?: string;
  role?: UserRole;
  estado?: UserStatus;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateUserData {
  usuario: string;
  telefono: string;
  email: string;
  password: string;
  role?: UserRole;
  estado?: UserStatus;
}

export interface CreateUserWithHashData {
  usuario: string;
  telefono: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  estado?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    return this.createInternal(data);
  }

  async createWithPasswordHash(data: CreateUserWithHashData): Promise<User> {
    return this.createInternal(data);
  }

  private async createInternal(
    data: CreateUserData | CreateUserWithHashData,
  ): Promise<User> {
    const existingEmail = await this.usersRepository.findOne({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new ConflictException('El email ya esta registrado');
    }

    const existingUser = await this.usersRepository.findOne({
      where: { usuario: data.usuario },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya esta registrado');
    }

    const passwordHash =
      'password' in data
        ? await this.hashPassword(data.password)
        : data.passwordHash;

    const user = this.usersRepository.create({
      usuario: data.usuario,
      telefono: data.telefono,
      email: data.email,
      passwordHash,
      role: data.role ?? UserRole.Cliente,
      estado: data.estado ?? UserStatus.Activo,
    });

    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    const safeRounds =
      Number.isFinite(saltRounds) && saltRounds >= 8 ? saltRounds : 10;

    return bcryptClient.hash(password, safeRounds);
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async findAll(
    options: FindUsersOptions = {},
  ): Promise<PaginatedResult<User>> {
    const page =
      Number.isFinite(options.page) && Number(options.page) > 0
        ? Number(options.page)
        : 1;
    const limitCandidate = Number.isFinite(options.limit)
      ? Number(options.limit)
      : 10;
    const limit = Math.min(Math.max(limitCandidate, 1), 50);

    const sortMap: Record<string, string> = {
      creadoEn: 'user.creadoEn',
      usuario: 'user.usuario',
      email: 'user.email',
      role: 'user.role',
      estado: 'user.estado',
    };

    const sortBy = sortMap[options.sortBy ?? ''] ?? 'user.creadoEn';
    const sortDir: 'ASC' | 'DESC' =
      (options.sortDir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = this.usersRepository.createQueryBuilder('user');

    if (
      options.role &&
      (options.role === UserRole.Admin || options.role === UserRole.Cliente)
    ) {
      query.andWhere('user.role = :role', { role: options.role });
    }

    if (
      options.estado &&
      (options.estado === UserStatus.Activo ||
        options.estado === UserStatus.Inactivo)
    ) {
      query.andWhere('user.estado = :estado', { estado: options.estado });
    }

    if (options.search) {
      const search = `%${options.search.trim().toLowerCase()}%`;
      query.andWhere(
        `(LOWER(user.usuario) LIKE :search
          OR LOWER(user.email) LIKE :search
          OR LOWER(user.telefono) LIKE :search)`,
        { search },
      );
    }

    query.orderBy(sortBy, sortDir);
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    };
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }

    const matches = await bcryptClient.compare(password, user.passwordHash);
    if (!matches) {
      return null;
    }

    return this.sanitize(user);
  }

  async update(id: number, data: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (data.email && data.email !== user.email) {
      const existingEmail = await this.usersRepository.findOne({
        where: { email: data.email },
      });
      if (existingEmail && existingEmail.id !== user.id) {
        throw new ConflictException('El email ya esta registrado');
      }
    }

    if (data.usuario && data.usuario !== user.usuario) {
      const existingUser = await this.usersRepository.findOne({
        where: { usuario: data.usuario },
      });
      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictException('El usuario ya esta registrado');
      }
    }

    Object.assign(user, data);
    const updated = await this.usersRepository.save(user);
    return this.sanitize(updated);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.remove(user);
  }

  sanitize(user: User): User {
    return {
      id: user.id,
      usuario: user.usuario,
      telefono: user.telefono,
      email: user.email,
      role: user.role,
      estado: user.estado,
      creadoEn: user.creadoEn,
      actualizadoEn: user.actualizadoEn,
    } as User;
  }
}
