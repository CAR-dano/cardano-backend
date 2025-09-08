import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreditPackagesService } from './credit-packages.service';
import { CreateCreditPackageDto } from './dto/create-credit-package.dto';
import { UpdateCreditPackageDto } from './dto/update-credit-package.dto';
import { CreditPackageResponseDto } from './dto/credit-package-response.dto';
import { CreditPackageListResponseDto } from './dto/credit-package-list-response.dto';
import { CreditPackageItemResponseDto } from './dto/credit-package-item-response.dto';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { ApiAuthErrors, ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';

@ApiTags('Credit Packages')
@Controller('admin/credit-packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@ApiBearerAuth('JwtAuthGuard')
export class CreditPackagesController {
  constructor(private readonly service: CreditPackagesService) {}

  @Get()
  @ApiOperation({ summary: 'List all credit packages (active & inactive)' })
  @ApiOkResponse({ description: 'Packages list returned.', type: CreditPackageListResponseDto })
  @ApiAuthErrors()
  async findAll() {
    const packagesList = await this.service.findAll();
    return new CreditPackageListResponseDto(
      packagesList.map((p) => new CreditPackageResponseDto(p)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get credit package by ID' })
  @ApiOkResponse({ description: 'Credit package found.', type: CreditPackageItemResponseDto })
  @ApiNotFoundResponse({ description: 'Credit package not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async findOne(@Param('id') id: string) {
    const pkg = await this.service.findOne(id);
    if (!pkg) throw new NotFoundException('Credit package not found');
    return new CreditPackageItemResponseDto(new CreditPackageResponseDto(pkg));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new credit package' })
  @ApiCreatedResponse({ description: 'Credit package created', type: CreditPackageItemResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or bad payload.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async create(@Body() dto: CreateCreditPackageDto) {
    const created = await this.service.create(dto);
    return new CreditPackageItemResponseDto(new CreditPackageResponseDto(created));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update credit package (partial)' })
  @ApiOkResponse({ description: 'Credit package updated', type: CreditPackageItemResponseDto })
  @ApiBadRequestResponse({ description: 'No fields provided or validation failed.', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Credit package not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async update(@Param('id') id: string, @Body() dto: UpdateCreditPackageDto) {
    const updated = await this.service.update(id, dto);
    return new CreditPackageItemResponseDto(new CreditPackageResponseDto(updated));
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Toggle active state (activate if inactive, and vice versa)' })
  @ApiOkResponse({ description: 'Toggled active state', type: CreditPackageItemResponseDto })
  @ApiNotFoundResponse({ description: 'Credit package not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async toggleActive(@Param('id') id: string) {
    const updated = await this.service.toggleActive(id);
    return new CreditPackageItemResponseDto(new CreditPackageResponseDto(updated));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a credit package' })
  @ApiNoContentResponse({ description: 'Credit package deleted' })
  @ApiNotFoundResponse({ description: 'Credit package not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
