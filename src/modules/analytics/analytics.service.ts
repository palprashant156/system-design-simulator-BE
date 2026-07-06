import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrends(projectId: string, userId: string) {
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Retrieve simulations for the project with their results
    const simulations = await this.prisma.simulation.findMany({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { createdAt: 'asc' },
      include: {
        results: true,
      },
    });

    // Transform into time-series trend data
    const timeSeries = simulations.map((sim) => {
      const results = sim.results;
      const count = results.length || 1;

      const totalLatency = results.reduce((acc, r) => acc + r.latencyMs, 0);
      const maxLatency = results.reduce((max, r) => Math.max(max, r.latencyMs), 0);
      const avgLatency = totalLatency / count;

      const totalThroughput = results.reduce((acc, r) => acc + r.throughputRps, 0);
      const avgThroughput = totalThroughput / count;

      const totalErrorRate = results.reduce((acc, r) => acc + r.errorRate, 0);
      const avgErrorRate = totalErrorRate / count;

      const bottleneckCount = results.filter((r) => r.isBottleneck).length;

      return {
        simulationId: sim.id,
        timestamp: sim.createdAt,
        config: sim.config,
        avgLatencyMs: Math.round(avgLatency * 100) / 100,
        maxLatencyMs: Math.round(maxLatency * 100) / 100,
        avgThroughputRps: Math.round(avgThroughput * 100) / 100,
        avgErrorRate: Math.round(avgErrorRate * 100) / 100,
        bottleneckCount,
      };
    });

    // Calculate component bottleneck frequency
    const bottleneckFrequency: Record<string, { nodeType: string; count: number }> = {};
    for (const sim of simulations) {
      for (const res of sim.results) {
        if (res.isBottleneck) {
          if (!bottleneckFrequency[res.nodeId]) {
            bottleneckFrequency[res.nodeId] = { nodeType: res.nodeType, count: 0 };
          }
          bottleneckFrequency[res.nodeId].count += 1;
        }
      }
    }

    return {
      projectId,
      totalSimulations: simulations.length,
      timeSeries,
      bottleneckFrequency,
    };
  }
}
