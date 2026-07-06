import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SimulationService } from './simulation.service';

@ApiTags('Simulation')
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post(':projectId/run')
  @ApiOperation({ summary: 'Trigger a new simulation run for a project' })
  runSimulation(@Param('projectId') projectId: string, @Body() body: any) {
    return this.simulationService.runSimulation(projectId, body);
  }

  @Get(':simulationId/results')
  @ApiOperation({ summary: 'Retrieve results for a specific simulation run' })
  getSimulationResults(@Param('simulationId') simulationId: string) {
    return this.simulationService.getSimulationResults(simulationId);
  }
}
