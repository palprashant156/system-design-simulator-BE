import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulationController } from './simulation.controller';
import { SimulationGateway } from './gateways/simulation.gateway';

@Module({
  controllers: [SimulationController],
  providers: [SimulationService, SimulationGateway],
  exports: [SimulationService, SimulationGateway],
})
export class SimulationModule {}
