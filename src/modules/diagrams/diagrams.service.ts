import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDiagram(projectId: string, data: any) {
    return { projectId, ...data, status: 'saved' };
  }

  async getDiagram(projectId: string) {
    return { projectId, nodes: [], edges: [] };
  }
}
