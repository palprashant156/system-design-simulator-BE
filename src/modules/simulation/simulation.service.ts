import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SimulationStatus, NodeStatus } from '@prisma/client';

@Injectable()
export class SimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async runSimulation(projectId: string, userId: string, config: { rps: number; concurrentUsers: number; duration: number; failures?: any }) {
    // Validate project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Create a new simulation record
    const simulation = await this.prisma.simulation.create({
      data: {
        projectId,
        config: config as any,
        status: SimulationStatus.PENDING,
      },
    });

    // In a real application, we would enqueue a BullMQ job here.
    // For the skeleton, we will mock running it synchronously and completing it.
    await this.prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        status: SimulationStatus.RUNNING,
      },
    });

    // Mock results for each node in the diagram
    const nodes = await this.prisma.diagramNode.findMany({
      where: { projectId },
    });

    const resultsData = nodes.map((node) => {
      // Calculate mock latency based on component type
      let latencyMs = 2.0; // Baseline
      if (node.type === 'database' || node.type === 'postgresql' || node.type === 'mysql') {
        latencyMs = 15.0;
      } else if (node.type === 'cache' || node.type === 'redis') {
        latencyMs = 0.8;
      } else if (node.type === 'microservice') {
        latencyMs = 5.0;
      }

      return {
        simulationId: simulation.id,
        nodeId: node.id,
        nodeType: node.type,
        status: NodeStatus.HEALTHY,
        latencyMs,
        throughputRps: config.rps,
        errorRate: 0.0,
        cpuUsage: 12.5,
        memoryUsage: 35.0,
        isBottleneck: false,
      };
    });

    if (resultsData.length > 0) {
      await this.prisma.simulationResult.createMany({
        data: resultsData,
      });
    }

    const completedSim = await this.prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        status: SimulationStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        results: true,
      },
    });

    return completedSim;
  }

  async getSimulationHistory(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.prisma.simulation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        results: true,
      },
    });
  }

  async getSimulationResult(simulationId: string, userId: string) {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id: simulationId },
      include: {
        project: true,
        results: true,
      },
    });

    if (!simulation || simulation.project.userId !== userId) {
      throw new NotFoundException(`Simulation with ID ${simulationId} not found`);
    }

    return simulation;
  }
}
