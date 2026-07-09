import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import * as Bull from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { SimulationStatus, NodeStatus } from '@prisma/client';
import { SimulationGateway } from './gateways/simulation.gateway';

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

interface SimulationConfig {
  rps: number;
  concurrentUsers: number;
  duration: number;
  failures?: Record<string, 'DOWN' | 'DEGRADED' | 'HIGH_LATENCY'>;
}

@Injectable()
export class SimulationService {
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
    @InjectQueue('simulation') private readonly simulationQueue: Bull.Queue,
  ) {}

  async runSimulation(
    projectId: string,
    userId: string,
    config: SimulationConfig,
  ) {
    // Validate project ownership and extract nodes and edges
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.nodes.length === 0) {
      throw new BadRequestException(
        'Cannot run simulation on an empty architecture diagram',
      );
    }

    // Map DB nodes and edges to interface structures
    const nodes: NodeData[] = project.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      positionX: n.positionX,
      positionY: n.positionY,
      data: n.data as any,
    }));

    const edges: EdgeData[] = project.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
    }));

    // Step 1: Validate Architecture (find disconnected nodes, cycles, and start nodes)
    const { startNodes, hasCycle, disconnectedNodes } =
      this.validateArchitecture(nodes, edges);

    if (hasCycle) {
      throw new BadRequestException(
        'Architecture simulation failed: Cycles detected in the request path.',
      );
    }

    if (startNodes.length === 0) {
      throw new BadRequestException(
        'Architecture simulation failed: No entrypoint node found (node with no incoming connections).',
      );
    }

    // Create a new simulation record as PENDING
    const simulation = await this.prisma.simulation.create({
      data: {
        projectId,
        config: config as any,
        status: SimulationStatus.PENDING,
      },
    });

    try {
      // Add the execution task to the asynchronous background queue
      await this.simulationQueue.add('execute', {
        simulationId: simulation.id,
        projectId,
        config,
        startNodes,
        nodes,
        edges,
      });

      return simulation;
    } catch (err: any) {
      await this.prisma.simulation.update({
        where: { id: simulation.id },
        data: {
          status: SimulationStatus.FAILED,
          completedAt: new Date(),
        },
      });
      throw new BadRequestException(
        `Failed to queue simulation: ${err.message}`,
      );
    }
  }

  /**
   * Performs DFS to find cycles and identify entrypoints (nodes with indegree = 0)
   */
  private validateArchitecture(nodes: NodeData[], edges: EdgeData[]) {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Init
    for (const node of nodes) {
      adjList.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // Populate adjacency list and indegrees
    for (const edge of edges) {
      const src = edge.source;
      const dest = edge.target;
      if (adjList.has(src) && adjList.has(dest)) {
        adjList.get(src)!.push(dest);
        inDegree.set(dest, (inDegree.get(dest) || 0) + 1);
      }
    }

    // Start nodes are those with in-degree of 0
    const startNodes = nodes
      .filter((node) => inDegree.get(node.id) === 0)
      .map((n) => n.id);

    // Cycle detection using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    let hasCycle = false;

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          hasCycle = true;
          break;
        }
      }
    }

    // Disconnected nodes (not reachable from any startNode)
    const reachable = new Set<string>();
    const q: string[] = [...startNodes];
    while (q.length > 0) {
      const curr = q.shift()!;
      if (!reachable.has(curr)) {
        reachable.add(curr);
        const neighbors = adjList.get(curr) || [];
        q.push(...neighbors);
      }
    }

    const disconnectedNodes = nodes
      .filter((n) => !reachable.has(n.id))
      .map((n) => n.id);

    return { startNodes, hasCycle, disconnectedNodes };
  }

  /**
   * Main simulation walker. Tracks throughput degradation and latency accumulation.
   * Emits simulation:node-update and simulation:metrics real-time events via Socket.IO gateway.
   */
  private simulateTrafficFlow(
    projectId: string,
    nodes: NodeData[],
    edges: EdgeData[],
    startNodes: string[],
    config: SimulationConfig,
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

      // Emit real-time WebSocket events for node update & metrics
      this.simulationGateway.emitNodeUpdate(projectId, {
        nodeId: currId,
        status,
        isBottleneck,
      });

      this.simulationGateway.emitMetrics(projectId, nodeResult);

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
      }
    }

    return Array.from(results.values());
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
      throw new NotFoundException(
        `Simulation with ID ${simulationId} not found`,
      );
    }

    return simulation;
  }
}
