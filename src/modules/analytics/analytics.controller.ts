import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':projectId/trends')
  @ApiOperation({ summary: 'Get simulation performance trends and bottlenecks over time' })
  getTrends(@Param('projectId') projectId: string) {
    return this.analyticsService.getTrends(projectId);
  }
}
