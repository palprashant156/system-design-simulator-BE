import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

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
    const templates = [
      {
        name: 'Netflix Architecture',
        description:
          'Global video streaming system featuring CDN, API Gateway, Microservices, and Redis caching.',
        category: 'Streaming',
        nodes: [
          {
            id: 'node-1',
            type: 'cdn',
            label: 'Global CDN',
            positionX: 100,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-2',
            type: 'api-gateway',
            label: 'Zuul API Gateway',
            positionX: 300,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-3',
            type: 'microservice',
            label: 'Playback Service',
            positionX: 550,
            positionY: 100,
            data: {},
          },
          {
            id: 'node-4',
            type: 'microservice',
            label: 'User Service',
            positionX: 550,
            positionY: 300,
            data: {},
          },
          {
            id: 'node-5',
            type: 'redis',
            label: 'Redis Cache',
            positionX: 800,
            positionY: 100,
            data: {},
          },
          {
            id: 'node-6',
            type: 'postgresql',
            label: 'User DB (PostgreSQL)',
            positionX: 800,
            positionY: 300,
            data: {},
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'HTTPS' },
          { id: 'edge-2', source: 'node-2', target: 'node-3', label: 'gRPC' },
          { id: 'edge-3', source: 'node-2', target: 'node-4', label: 'gRPC' },
          {
            id: 'edge-4',
            source: 'node-3',
            target: 'node-5',
            label: 'Read/Write',
          },
          { id: 'edge-5', source: 'node-4', target: 'node-6', label: 'SQL' },
        ],
      },
      {
        name: 'Uber Architecture',
        description:
          'High-concurrency ride-hailing architecture with Location Tracking, Kafka Events, and Redis Geo-spatial cache.',
        category: 'Location/Transport',
        nodes: [
          {
            id: 'node-1',
            type: 'api-gateway',
            label: 'API Gateway',
            positionX: 100,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-2',
            type: 'load-balancer',
            label: 'NLB',
            positionX: 300,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-3',
            type: 'microservice',
            label: 'Location Ingestion Service',
            positionX: 550,
            positionY: 150,
            data: {},
          },
          {
            id: 'node-4',
            type: 'redis',
            label: 'Redis Geospatial Index',
            positionX: 800,
            positionY: 150,
            data: {},
          },
          {
            id: 'node-5',
            type: 'kafka',
            label: 'Kafka Event Stream',
            positionX: 800,
            positionY: 300,
            data: {},
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'TCP' },
          { id: 'edge-2', source: 'node-2', target: 'node-3', label: 'gRPC' },
          { id: 'edge-3', source: 'node-3', target: 'node-4', label: 'GEOADD' },
          {
            id: 'edge-4',
            source: 'node-3',
            target: 'node-5',
            label: 'Publish',
          },
        ],
      },
      {
        name: 'YouTube Architecture',
        description:
          'Global video distribution with high read-throughput, CDNs, and transcoding pipeline.',
        category: 'Streaming',
        nodes: [
          {
            id: 'node-1',
            type: 'cdn',
            label: 'Video CDN',
            positionX: 100,
            positionY: 100,
            data: {},
          },
          {
            id: 'node-2',
            type: 'api-gateway',
            label: 'API Gateway',
            positionX: 300,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-3',
            type: 'load-balancer',
            label: 'Load Balancer',
            positionX: 500,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-4',
            type: 'microservice',
            label: 'Video Upload Service',
            positionX: 750,
            positionY: 100,
            data: {},
          },
          {
            id: 'node-5',
            type: 'search-service',
            label: 'Search & Recommend',
            positionX: 750,
            positionY: 300,
            data: {},
          },
          {
            id: 'node-6',
            type: 'object-storage',
            label: 'S3 Video Storage',
            positionX: 1000,
            positionY: 50,
            data: {},
          },
          {
            id: 'node-7',
            type: 'postgresql',
            label: 'Metadata DB',
            positionX: 1000,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-8',
            type: 'redis',
            label: 'Recommendations Cache',
            positionX: 1000,
            positionY: 350,
            data: {},
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'HTTPS' },
          { id: 'edge-2', source: 'node-2', target: 'node-3', label: 'TCP' },
          { id: 'edge-3', source: 'node-3', target: 'node-4', label: 'Upload' },
          { id: 'edge-4', source: 'node-3', target: 'node-5', label: 'Search' },
          { id: 'edge-5', source: 'node-4', target: 'node-6', label: 'Write' },
          { id: 'edge-6', source: 'node-4', target: 'node-7', label: 'SQL' },
          { id: 'edge-7', source: 'node-5', target: 'node-7', label: 'SQL' },
          { id: 'edge-8', source: 'node-5', target: 'node-8', label: 'Read' },
        ],
      },
      {
        name: 'WhatsApp Architecture',
        description:
          'Real-time messaging using WebSockets, Erlang backend, and Mnesia for presence and metadata.',
        category: 'Messaging',
        nodes: [
          {
            id: 'node-1',
            type: 'api-gateway',
            label: 'WebSocket Gateway',
            positionX: 100,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-2',
            type: 'microservice',
            label: 'Chat Service',
            positionX: 350,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-3',
            type: 'microservice',
            label: 'Group Service',
            positionX: 350,
            positionY: 350,
            data: {},
          },
          {
            id: 'node-4',
            type: 'redis',
            label: 'Presence Cache',
            positionX: 600,
            positionY: 100,
            data: {},
          },
          {
            id: 'node-5',
            type: 'database',
            label: 'Mnesia DB',
            positionX: 600,
            positionY: 250,
            data: {},
          },
          {
            id: 'node-6',
            type: 'object-storage',
            label: 'Media Blob Storage',
            positionX: 600,
            positionY: 400,
            data: {},
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'WSS' },
          { id: 'edge-2', source: 'node-1', target: 'node-3', label: 'WSS' },
          {
            id: 'edge-3',
            source: 'node-2',
            target: 'node-4',
            label: 'Read/Write',
          },
          { id: 'edge-4', source: 'node-2', target: 'node-5', label: 'SQL' },
          { id: 'edge-5', source: 'node-3', target: 'node-5', label: 'SQL' },
          { id: 'edge-6', source: 'node-2', target: 'node-6', label: 'Write' },
        ],
      },
      {
        name: 'Instagram Architecture',
        description:
          'Social media image sharing platform with CDNs, Timeline generation, and Graph databases.',
        category: 'Social Media',
        nodes: [
          {
            id: 'node-1',
            type: 'cdn',
            label: 'Image CDN',
            positionX: 100,
            positionY: 100,
            data: {},
          },
          {
            id: 'node-2',
            type: 'load-balancer',
            label: 'ALB',
            positionX: 300,
            positionY: 200,
            data: {},
          },
          {
            id: 'node-3',
            type: 'microservice',
            label: 'Timeline Service',
            positionX: 550,
            positionY: 150,
            data: {},
          },
          {
            id: 'node-4',
            type: 'microservice',
            label: 'Upload Service',
            positionX: 550,
            positionY: 300,
            data: {},
          },
          {
            id: 'node-5',
            type: 'postgresql',
            label: 'PostgreSQL DB',
            positionX: 800,
            positionY: 150,
            data: {},
          },
          {
            id: 'node-6',
            type: 'redis',
            label: 'Redis Cache',
            positionX: 800,
            positionY: 50,
            data: {},
          },
          {
            id: 'node-7',
            type: 'object-storage',
            label: 'S3 Image Storage',
            positionX: 800,
            positionY: 300,
            data: {},
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'HTTPS' },
          { id: 'edge-2', source: 'node-2', target: 'node-3', label: 'TCP' },
          { id: 'edge-3', source: 'node-2', target: 'node-4', label: 'TCP' },
          { id: 'edge-4', source: 'node-3', target: 'node-5', label: 'SQL' },
          { id: 'edge-5', source: 'node-3', target: 'node-6', label: 'Read' },
          { id: 'edge-6', source: 'node-4', target: 'node-7', label: 'Write' },
          { id: 'edge-7', source: 'node-4', target: 'node-5', label: 'SQL' },
        ],
      },
    ];

    for (const t of templates) {
      const existing = await this.prisma.template.findFirst({
        where: { name: t.name },
      });
      if (!existing) {
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

    const nodeIdMap = new Map<string, string>();
    const newNodes = nodes.map((n) => {
      const newId = randomUUID();
      nodeIdMap.set(n.id, newId);
      return { ...n, id: newId };
    });

    const newEdges = edges.map((e) => ({
      ...e,
      id: randomUUID(),
      source: nodeIdMap.get(e.source) || e.source,
      target: nodeIdMap.get(e.target) || e.target,
    }));

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
      if (newNodes.length > 0) {
        await tx.diagramNode.createMany({
          data: newNodes.map((n) => ({
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
      if (newEdges.length > 0) {
        await tx.diagramEdge.createMany({
          data: newEdges.map((e) => ({
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
