import { Controller, Get } from '@nestjs/common';
import { PromocionesService } from './promociones.service';

@Controller('promociones')
export class PromocionesController {
  constructor(private readonly promocionesService: PromocionesService) {}

  @Get()
  findAll() {
    return this.promocionesService.findAllActive();
  }
}
