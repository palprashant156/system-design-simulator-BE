import { Processor, Process } from '@nestjs/bull';
import * as Bull from 'bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SimulationGateway } from '../gateways/simulation.gateway';
import { SimulationStatus, NodeStatus } from '@prisma/client';

interface NodeData {
  id: string;
  type: string;
  label: string;
  positionX: number;
  positionY: number;
  data: any;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface SimulationJobData {
  simulationId: string;
  projectId: string;
  config: {
    rps: number;
    concurrentUsers: number;
    duration: number;
    failures?: Record<string, 'DOWN' | 'DEGRADED' | 'HIGH_LATENCY'>;
  };
  startNodes: string[];
  nodes: NodeData[];
  edges: EdgeData[];
}

@Processor('simulation')
export class SimulationProcessor {
  private readonly logger = new Logger(SimulationProcessor.name);

  // Baseline latency and throughput configurations for components
  private readonly baselineMetrics: Record<
    string,
    { latencyMs: number; maxThroughputRps: number }
  > = {
    'api-gateway': { latencyMs: 2.0, maxThroughputRps: 10000 },
    'load-balancer': { latencyMs: 1.0, maxThroughputRps: 20000 },
    microservice: { latencyMs: 8.0, maxThroughputRps: 2000 },
    database: { latencyMs: 15.0, maxThroughputRps: 500 },
    postgresql: { latencyMs: 12.0, maxThroughputRps: 600 },
    mysql: { latencyMs: 14.0, maxThroughputRps: 500 },
    redis: { latencyMs: 0.5, maxThroughputRps: 50000 },
    cache: { latencyMs: 0.8, maxThroughputRps: 30000 },
    kafka: { latencyMs: 4.0, maxThroughputRps: 15000 },
    rabbitmq: { latencyMs: 5.0, maxThroughputRps: 10000 },
    'message-queue': { latencyMs: 4.5, maxThroughputRps: 12000 },
    cdn: { latencyMs: 1.5, maxThroughputRps: 100000 },
    'authentication-service': { latencyMs: 6.0, maxThroughputRps: 3000 },
    'notification-service': { latencyMs: 10.0, maxThroughputRps: 1000 },
    'search-service': { latencyMs: 18.0, maxThroughputRps: 800 },
    'object-storage': { latencyMs: 25.0, maxThroughputRps: 2500 },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulationGateway: SimulationGateway,
    private readonly configService: ConfigService,
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  @Process('execute')
  async handleExecute(job: Bull.Job<SimulationJobData>) {
    const { simulationId, projectId, config, startNodes, nodes, edges } =
      job.data;
    this.logger.log(
      `Starting background simulation execution: ${simulationId}`,
    );

    try {
      // 1. Update status to RUNNING in Database
      await this.prisma.simulation.update({
        where: { id: simulationId },
        data: { status: SimulationStatus.RUNNING },
      });

      // 2. Emit simulation:started
      this.simulationGateway.emitSimulationStarted(projectId, {
        simulationId,
        projectId,
        config,
        status: SimulationStatus.RUNNING,
        timestamp: new Date().toISOString(),
      });

      // 3. Run traffic calculations with a delay to simulate visual streaming
      const simulationResults = await this.simulateTrafficFlowWithStreaming(
        projectId,
        nodes,
        edges,
        startNodes,
        config,
      );

      // 4. Save results to DB
      await this.prisma.simulationResult.createMany({
        data: simulationResults.map((res) => ({
          simulationId,
          nodeId: res.nodeId,
          nodeType: res.nodeType,
          status: res.status,
          latencyMs: res.latencyMs,
          throughputRps: res.throughputRps,
          errorRate: res.errorRate,
          cpuUsage: res.cpuUsage,
          memoryUsage: res.memoryUsage,
          isBottleneck: res.isBottleneck,
        })),
      });

      // 5. Update status to COMPLETED
      const completedSim = await this.prisma.simulation.update({
        where: { id: simulationId },
        data: {
          status: SimulationStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          results: true,
        },
      });

      // 6. Emit simulation:completed
      this.simulationGateway.emitSimulationCompleted(projectId, {
        simulationId,
        projectId,
        status: SimulationStatus.COMPLETED,
        completedAt: completedSim.completedAt,
        results: completedSim.results,
      });

      this.logger.log(
        `Background simulation execution completed: ${simulationId}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Background simulation execution failed: ${err.message}`,
        err.stack,
      );
      await this.prisma.simulation.update({
        where: { id: simulationId },
        data: {
          status: SimulationStatus.FAILED,
          completedAt: new Date(),
        },
      });
    }
  }

  private async simulateTrafficFlowWithStreaming(
    projectId: string,
    nodes: NodeData[],
    edges: EdgeData[],
    startNodes: string[],
    config: SimulationJobData['config'],
  ) {
    const nodeMap = new Map<string, NodeData>(nodes.map((n) => [n.id, n]));
    const adjList = new Map<string, string[]>();
    const revAdjList = new Map<string, string[]>();

    for (const node of nodes) {
      adjList.set(node.id, []);
      revAdjList.set(node.id, []);
    }

    for (const edge of edges) {
      if (adjList.has(edge.source) && adjList.has(edge.target)) {
        adjList.get(edge.source)!.push(edge.target);
        revAdjList.get(edge.target)!.push(edge.source);
      }
    }

    const results = new Map<
      string,
      {
        nodeId: string;
        nodeType: string;
        status: NodeStatus;
        latencyMs: number;
        throughputRps: number;
        errorRate: number;
        cpuUsage: number;
        memoryUsage: number;
        isBottleneck: boolean;
      }
    >();

    const incomingLoad = new Map<string, number>();
    const resolvedIncoming = new Map<string, number>();

    const initialLoad = config.rps;
    for (const startId of startNodes) {
      incomingLoad.set(startId, initialLoad / startNodes.length);
      resolvedIncoming.set(startId, 0);
    }

    const queue: string[] = [...startNodes];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const node = nodeMap.get(currId)!;
      const load = incomingLoad.get(currId) || 0;

      // Calculate single-node performance
      const baseline = this.baselineMetrics[node.type] || {
        latencyMs: 5.0,
        maxThroughputRps: 1000,
      };

      let latency = baseline.latencyMs;
      let errorRate = 0.0;
      let status: NodeStatus = NodeStatus.HEALTHY;

      // Apply Failure Injection
      const failure = config.failures?.[currId];
      if (failure) {
        if (failure === 'DOWN') {
          latency = 0;
          errorRate = 1.0;
          status = NodeStatus.FAILED;
        } else if (failure === 'DEGRADED') {
          latency = baseline.latencyMs * 4;
          errorRate = 0.15;
          status = NodeStatus.WARNING;
        } else if (failure === 'HIGH_LATENCY') {
          latency = baseline.latencyMs + 500; // Extra 500ms
          status = NodeStatus.CRITICAL;
        }
      }

      // Check for throughput bottlenecking
      const isBottleneck =
        status !== NodeStatus.FAILED && load > baseline.maxThroughputRps;
      if (isBottleneck) {
        const loadRatio = load / baseline.maxThroughputRps;
        latency += baseline.latencyMs * (loadRatio - 1) * 2;
        errorRate = Math.min(0.95, errorRate + (loadRatio - 1) * 0.1);
        status = loadRatio > 2 ? NodeStatus.CRITICAL : NodeStatus.WARNING;
      }

      // Calculate resources usage based on load ratio
      const loadRatio = Math.min(2.0, load / baseline.maxThroughputRps);
      const cpuUsage = Math.min(100.0, loadRatio * 85.0 + Math.random() * 10);
      const memoryUsage = Math.min(
        100.0,
        40.0 + loadRatio * 45.0 + Math.random() * 5,
      );

      const outputThroughput =
        status === NodeStatus.FAILED ? 0 : load * (1 - errorRate);

      const nodeResult = {
        nodeId: currId,
        nodeType: node.type,
        status,
        latencyMs: Math.round(latency * 100) / 100,
        throughputRps: Math.round(outputThroughput * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        isBottleneck,
      };

      // Save results for this node
      results.set(currId, nodeResult);

      // Emit real-time WebSockets events for node update
      this.simulationGateway.emitNodeUpdate(projectId, {
        nodeId: currId,
        status,
        isBottleneck,
      });

      // Emit metrics
      this.simulationGateway.emitMetrics(projectId, nodeResult);

      // Sleep configurable ms per node to visualize live traversal on the frontend React Flow canvas
      const stepDelay =
        this.configService.get<number>('simulation.stepDelayMs') || 500;
      await this.sleep(stepDelay);

      // Propagate traffic to outgoing nodes
      const outgoing = adjList.get(currId) || [];
      if (outgoing.length > 0) {
        const share = outputThroughput / outgoing.length;
        for (const nextId of outgoing) {
          incomingLoad.set(nextId, (incomingLoad.get(nextId) || 0) + share);
          resolvedIncoming.set(nextId, (resolvedIncoming.get(nextId) || 0) + 1);

          // Only enqueue if all incoming dependencies are resolved
          const requiredIncoming = (revAdjList.get(nextId) || []).length;
          if (resolvedIncoming.get(nextId) === requiredIncoming) {
            queue.push(nextId);
          }
        }
      }
    }

    // For any disconnected nodes, calculate zero stats
    for (const node of nodes) {
      if (!results.has(node.id)) {
        const discResult = {
          nodeId: node.id,
          nodeType: node.type,
          status: NodeStatus.FAILED,
          latencyMs: 0,
          throughputRps: 0,
          errorRate: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          isBottleneck: false,
        };
        results.set(node.id, discResult);
        this.simulationGateway.emitNodeUpdate(projectId, {
          nodeId: node.id,
          status: NodeStatus.FAILED,
          isBottleneck: false,
        });
        this.simulationGateway.emitMetrics(projectId, discResult);
      }
    }

    return Array.from(results.values());
  }
}
