import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promocion } from './entities/promocion.entity';

@Injectable()
export class PromocionesService {
  constructor(
    @InjectRepository(Promocion)
    private readonly promocionesRepository: Repository<Promocion>,
  ) {}

  async findAllActive(): Promise<Promocion[]> {
    return this.promocionesRepository.find({
      where: { activa: true },
      order: { creadoEn: 'DESC' },
    });
  }
}
