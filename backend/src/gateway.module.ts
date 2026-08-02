import { Module } from '@nestjs/common';
import { BarberGateway } from './barber.gateway';

@Module({
  providers: [BarberGateway],
  exports: [BarberGateway],
})
export class GatewayModule {}
