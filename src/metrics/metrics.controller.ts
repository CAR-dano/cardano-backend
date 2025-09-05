import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiOkResponse({ description: 'Prometheus metrics in text format' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}
