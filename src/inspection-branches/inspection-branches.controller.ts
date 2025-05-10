import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InspectionBranchesService } from './inspection-branches.service';
import { CreateInspectionBranchCityDto } from './dto/create-inspection-branch-city.dto';
import { UpdateInspectionBranchCityDto } from './dto/update-inspection-branch-city.dto';
import { InspectionBranchCityResponseDto } from './dto/inspection-branch-city-response.dto';

@ApiTags('Inspection Branches')
@Controller('inspection-branches')
export class InspectionBranchesController {
  constructor(
    private readonly inspectionBranchesService: InspectionBranchesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new inspection branch city' })
  @ApiBody({ type: CreateInspectionBranchCityDto })
  @ApiResponse({
    status: 201,
    description: 'The inspection branch city has been successfully created.',
    type: InspectionBranchCityResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async create(
    @Body() createInspectionBranchCityDto: CreateInspectionBranchCityDto,
  ) {
    return await this.inspectionBranchesService.create(
      createInspectionBranchCityDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all inspection branch cities' })
  @ApiResponse({
    status: 200,
    description: 'List of all inspection branch cities.',
    type: [InspectionBranchCityResponseDto],
  })
  async findAll() {
    return await this.inspectionBranchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an inspection branch city by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiResponse({
    status: 200,
    description: 'The inspection branch city details.',
    type: InspectionBranchCityResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Inspection branch city not found.',
  })
  async findOne(@Param('id') id: string) {
    return this.inspectionBranchesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an inspection branch city by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiBody({ type: UpdateInspectionBranchCityDto })
  @ApiResponse({
    status: 200,
    description: 'The inspection branch city has been successfully updated.',
    type: InspectionBranchCityResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({
    status: 404,
    description: 'Inspection branch city not found.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateInspectionBranchCityDto: UpdateInspectionBranchCityDto,
  ) {
    return await this.inspectionBranchesService.update(
      id,
      updateInspectionBranchCityDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an inspection branch city by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiResponse({
    status: 200,
    description: 'The inspection branch city has been successfully deleted.',
  })
  @ApiResponse({
    status: 404,
    description: 'Inspection branch city not found.',
  })
  async remove(@Param('id') id: string) {
    return await this.inspectionBranchesService.remove(id);
  }
}
