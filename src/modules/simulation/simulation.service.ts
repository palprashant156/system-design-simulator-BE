import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async runSimulation(projectId: string, config: any) {
    return { simulationId: 'sim_skeleton_id', projectId, config, status: 'started' };
  }

  async getSimulationResults(simulationId: string) {
    return { simulationId, results: [] };
  }
}
