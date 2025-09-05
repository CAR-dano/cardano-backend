import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreditPackagesService } from './credit-packages.service';
import { CreateCreditPackageDto } from './dto/create-credit-package.dto';
import { UpdateCreditPackageDto } from './dto/update-credit-package.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { CreditPackageResponseDto } from './dto/credit-package-response.dto';

@ApiTags('Credit Packages')
@Controller('admin/credit-packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@ApiBearerAuth('JwtAuthGuard')
export class CreditPackagesController {
  constructor(private readonly service: CreditPackagesService) {}

  @Get()
  @ApiOperation({ summary: 'List all credit packages (active & inactive)' })
  async findAll() {
    const packagesList = await this.service.findAll();
    return { packages: packagesList.map((p) => new CreditPackageResponseDto(p)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get credit package by ID' })
  async findOne(@Param('id') id: string) {
    const pkg = await this.service.findOne(id);
    return pkg ? new CreditPackageResponseDto(pkg) : null;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new credit package' })
  @ApiCreatedResponse({ description: 'Credit package created' })
  async create(@Body() dto: CreateCreditPackageDto) {
    const created = await this.service.create(dto);
    return new CreditPackageResponseDto(created);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update credit package (partial)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCreditPackageDto) {
    const updated = await this.service.update(id, dto);
    return new CreditPackageResponseDto(updated);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Set active state for a package (activate/deactivate)' })
  @ApiBody({ type: SetActiveDto })
  @ApiResponse({ status: 200, description: 'Updated active state' })
  async setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    const updated = await this.service.setActive(id, dto.isActive);
    return new CreditPackageResponseDto(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a credit package' })
  @ApiResponse({ status: 200, description: 'Credit package deleted' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { ok: true };
  }
}
