import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return [];
  }

  async findOne(id: string) {
    return { id };
  }

  async create(data: any) {
    return { id: 'new_project', ...data };
  }
}
