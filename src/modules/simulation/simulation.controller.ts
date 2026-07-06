import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SimulationService } from './simulation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('Simulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post(':projectId/run')
  @ApiOperation({ summary: 'Trigger a new simulation run for a project' })
  @ApiResponse({ status: 201, description: 'Simulation enqueued and completed' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  runSimulation(
    @Param('projectId') projectId: string,
    @User('userId') userId: string,
    @Body()
    body: {
      rps: number;
      concurrentUsers: number;
      duration: number;
      failures?: any;
    },
  ) {
    return this.simulationService.runSimulation(projectId, userId, body);
  }

  @Get(':projectId/history')
  @ApiOperation({ summary: 'Get simulation history for a project' })
  @ApiResponse({ status: 200, description: 'Simulation history retrieved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  getSimulationHistory(@Param('projectId') projectId: string, @User('userId') userId: string) {
    return this.simulationService.getSimulationHistory(projectId, userId);
  }

  @Get(':simulationId/results')
  @ApiOperation({ summary: 'Retrieve results for a specific simulation run' })
  @ApiResponse({ status: 200, description: 'Simulation results retrieved' })
  @ApiResponse({ status: 404, description: 'Simulation run not found' })
  getSimulationResult(@Param('simulationId') simulationId: string, @User('userId') userId: string) {
    return this.simulationService.getSimulationResult(simulationId, userId);
  }
}
