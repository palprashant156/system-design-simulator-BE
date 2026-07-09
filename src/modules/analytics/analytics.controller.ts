import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':projectId/trends')
  @ApiOperation({
    summary:
      'Get simulation performance trends and bottleneck analytics over time',
  })
  @ApiResponse({ status: 200, description: 'Analytics trend data retrieved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  getTrends(
    @Param('projectId') projectId: string,
    @User('userId') userId: string,
  ) {
    return this.analyticsService.getTrends(projectId, userId);
  }
}
