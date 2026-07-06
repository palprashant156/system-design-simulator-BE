import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedBuiltInTemplates();
  }

  /**
   * Automatically seed standard system architecture templates if database is empty
   */
  private async seedBuiltInTemplates() {
    const count = await this.prisma.template.count();
    if (count > 0) return;

    const templates = [
      {
        name: 'Netflix Architecture',
        description: 'Global video streaming system featuring CDN, API Gateway, Microservices, and Redis caching.',
        category: 'Streaming',
        nodes: [
          { id: 'node-1', type: 'cdn', label: 'Global CDN', positionX: 100, positionY: 200, data: {} },
          { id: 'node-2', type: 'api-gateway', label: 'Zuul API Gateway', positionX: 300, positionY: 200, data: {} },
          { id: 'node-3', type: 'microservice', label: 'Playback Service', positionX: 550, positionY: 100, data: {} },
          { id: 'node-4', type: 'microservice', label: 'User Service', positionX: 550, positionY: 300, data: {} },
          { id: 'node-5', type: 'redis', label: 'Redis Cache', positionX: 800, positionY: 100, data: {} },
          { id: 'node-6', type: 'postgresql', label: 'User DB (PostgreSQL)', positionX: 800, positionY: 300, data: {} },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'HTTPS' },
          { id: 'edge-2', source: 'node-2', target: 'node-3', label: 'gRPC' },
          { id: 'edge-3', source: 'node-2', target: 'node-4', label: 'gRPC' },
          { id: 'edge-4', source: 'node-3', target: 'node-5', label: 'Read/Write' },
          { id: 'edge-5', source: 'node-4', target: 'node-6', label: 'SQL' },
        ],
      },
      {
        name: 'Uber Architecture',
        description: 'High-concurrency ride-hailing architecture with Location Tracking, Kafka Events, and Redis Geo-spatial cache.',
        category: 'Location/Transport',
        nodes: [
          { id: 'node-1', type: 'api-gateway', label: 'API Gateway', positionX: 100, positionY: 200, data: {} },
          { id: 'node-2', type: 'load-balancer', label: 'NLB', positionX: 300, positionY: 200, data: {} },
          { id: 'node-3', type: 'microservice', label: 'Location Ingestion Service', positionX: 550, positionY: 150, data: {} },
          { id: 'node-4', type: 'redis', label: 'Redis Geospatial Index', positionX: 800, positionY: 150, data: {} },
          { id: 'node-5', type: 'kafka', label: 'Kafka Event Stream', positionX: 800, positionY: 300, data: {} },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'TCP' },
          { id: 'edge-2', source: 'node-2', target: 'node-3', label: 'gRPC' },
          { id: 'edge-3', source: 'node-3', target: 'node-4', label: 'GEOADD' },
          { id: 'edge-4', source: 'node-3', target: 'node-5', label: 'Publish' },
        ],
      },
    ];

    for (const t of templates) {
      await this.prisma.template.create({
        data: {
          name: t.name,
          description: t.description,
          category: t.category,
          nodes: t.nodes as any,
          edges: t.edges as any,
          isPublic: true,
        },
      });
    }
  }

  async findAll() {
    return this.prisma.template.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  /**
   * Fork a template into a user's account by creating a new Project and copying diagram nodes & edges.
   */
  async forkTemplate(templateId: string, userId: string) {
    const template = await this.findOne(templateId);

    const nodes = (template.nodes as any[]) || [];
    const edges = (template.edges as any[]) || [];

    return this.prisma.$transaction(async (tx) => {
      // 1. Create project
      const project = await tx.project.create({
        data: {
          name: `${template.name} (Fork)`,
          description: template.description,
          userId,
        },
      });

      // 2. Create nodes
      if (nodes.length > 0) {
        await tx.diagramNode.createMany({
          data: nodes.map((n) => ({
            id: n.id,
            projectId: project.id,
            type: n.type,
            label: n.label,
            positionX: n.positionX,
            positionY: n.positionY,
            data: n.data || {},
          })),
        });
      }

      // 3. Create edges
      if (edges.length > 0) {
        await tx.diagramEdge.createMany({
          data: edges.map((e) => ({
            id: e.id,
            projectId: project.id,
            source: e.source,
            target: e.target,
            label: e.label,
          })),
        });
      }

      return project;
    });
  }
}
