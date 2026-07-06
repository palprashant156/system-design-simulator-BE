import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DiagramsService } from './diagrams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('Diagrams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Post(':projectId/save')
  @ApiOperation({ summary: 'Save full diagram layout (nodes and edges) for a project' })
  @ApiResponse({ status: 200, description: 'Diagram successfully saved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  saveDiagram(
    @Param('projectId') projectId: string,
    @User('userId') userId: string,
    @Body()
    body: {
      nodes: Array<{ id: string; type: string; label: string; positionX: number; positionY: number; data?: any }>;
      edges: Array<{ id: string; source: string; target: string; label?: string }>;
    },
  ) {
    return this.diagramsService.saveDiagram(projectId, userId, body);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Retrieve full diagram layout (nodes and edges) for a project' })
  @ApiResponse({ status: 200, description: 'Diagram loaded successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  getDiagram(@Param('projectId') projectId: string, @User('userId') userId: string) {
    return this.diagramsService.getDiagram(projectId, userId);
  }
}
