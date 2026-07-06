import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DiagramsService } from './diagrams.service';

@ApiTags('Diagrams')
@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Post(':projectId/save')
  @ApiOperation({ summary: 'Save the node and edge configurations of a project' })
  saveDiagram(@Param('projectId') projectId: string, @Body() body: any) {
    return this.diagramsService.saveDiagram(projectId, body);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Load the node and edge configurations of a project' })
  getDiagram(@Param('projectId') projectId: string) {
    return this.diagramsService.getDiagram(projectId);
  }
}
