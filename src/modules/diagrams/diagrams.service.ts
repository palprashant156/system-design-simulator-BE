import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDiagram(
    projectId: string,
    userId: string,
    data: {
      nodes: Array<{ id: string; type: string; label: string; positionX: number; positionY: number; data?: any }>;
      edges: Array<{ id: string; source: string; target: string; label?: string }>;
    },
  ) {
    // Validate project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Execute in a transaction to clear and recreate nodes and edges
    return this.prisma.$transaction(async (tx) => {
      // Delete existing nodes and edges
      await tx.diagramNode.deleteMany({ where: { projectId } });
      await tx.diagramEdge.deleteMany({ where: { projectId } });

      // Create new nodes
      if (data.nodes.length > 0) {
        await tx.diagramNode.createMany({
          data: data.nodes.map((node) => ({
            id: node.id,
            projectId,
            type: node.type,
            label: node.label,
            positionX: node.positionX,
            positionY: node.positionY,
            data: node.data || {},
          })),
        });
      }

      // Create new edges
      if (data.edges.length > 0) {
        await tx.diagramEdge.createMany({
          data: data.edges.map((edge) => ({
            id: edge.id,
            projectId,
            source: edge.source,
            target: edge.target,
            label: edge.label,
          })),
        });
      }

      return { success: true, nodeCount: data.nodes.length, edgeCount: data.edges.length };
    });
  }

  async getDiagram(projectId: string, userId: string) {
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

    return {
      nodes: project.nodes,
      edges: project.edges,
    };
  }
}
