import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SimulationService } from './simulation.service';
import { SimulationController } from './simulation.controller';
import { SimulationGateway } from './gateways/simulation.gateway';
import { SimulationProcessor } from './processors/simulation.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'simulation',
    }),
  ],
  controllers: [SimulationController],
  providers: [SimulationService, SimulationGateway, SimulationProcessor],
  exports: [SimulationService, SimulationGateway],
})
export class SimulationModule {}
