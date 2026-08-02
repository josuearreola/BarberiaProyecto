import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Servicio } from './entities/servicio.entity';

@Injectable()
export class ServiciosService {
  constructor(
    @InjectRepository(Servicio)
    private readonly serviciosRepository: Repository<Servicio>,
  ) {}

  async findAllActive(): Promise<Servicio[]> {
    return this.serviciosRepository.find({
      where: { activo: true },
      order: { precio: 'ASC' },
    });
  }
}
