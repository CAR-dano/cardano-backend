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
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'User lacks required role.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async findAll() {
    const packagesList = await this.service.findAll();
    return new CreditPackageListResponseDto(
      packagesList.map((p) => new CreditPackageResponseDto(p)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get credit package by ID' })
  @ApiOkResponse({ description: 'Package found.', type: CreditPackageResponseDto })
  @ApiNotFoundResponse({ description: 'Package not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'User lacks required role.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async findOne(@Param('id') id: string) {
    const pkg = await this.service.findOne(id);
    return pkg ? new CreditPackageResponseDto(pkg) : null;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new credit package' })
  @ApiCreatedResponse({ description: 'Credit package created', type: CreditPackageResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or bad payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'User lacks required role.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async create(@Body() dto: CreateCreditPackageDto) {
    const created = await this.service.create(dto);
    return new CreditPackageResponseDto(created);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update credit package (partial)' })
  @ApiOkResponse({ description: 'Credit package updated', type: CreditPackageResponseDto })
  @ApiBadRequestResponse({ description: 'No fields provided or validation failed.' })
  @ApiNotFoundResponse({ description: 'Package not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'User lacks required role.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async update(@Param('id') id: string, @Body() dto: UpdateCreditPackageDto) {
    const updated = await this.service.update(id, dto);
    return new CreditPackageResponseDto(updated);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Toggle active state (activate if inactive, and vice versa)' })
  @ApiOkResponse({ description: 'Toggled active state', type: CreditPackageResponseDto })
  @ApiNotFoundResponse({ description: 'Package not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'User lacks required role.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async toggleActive(@Param('id') id: string) {
    const updated = await this.service.toggleActive(id);
    return new CreditPackageResponseDto(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a credit package' })
  @ApiNoContentResponse({ description: 'Credit package deleted' })
  @ApiNotFoundResponse({ description: 'Package not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'User lacks required role.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
