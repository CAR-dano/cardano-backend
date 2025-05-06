import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { InspectionBranchesService } from './inspection-branches.service';
import { CreateInspectionBranchCityDto } from './dto/create-inspection-branch-city.dto';
import { UpdateInspectionBranchCityDto } from './dto/update-inspection-branch-city.dto';

@Controller('inspection-branches')
export class InspectionBranchesController {
  constructor(
    private readonly inspectionBranchesService: InspectionBranchesService,
  ) {}

  @Post()
  async create(
    @Body() CreateInspectionBranchCityDto: CreateInspectionBranchCityDto,
  ) {
    return await this.inspectionBranchesService.create(
      CreateInspectionBranchCityDto,
    );
  }

  @Get()
  async findAll() {
    return await this.inspectionBranchesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.inspectionBranchesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() UpdateInspectionBranchCityDto: UpdateInspectionBranchCityDto,
  ) {
    return await this.inspectionBranchesService.update(
      id,
      UpdateInspectionBranchCityDto,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.inspectionBranchesService.remove(id);
  }
}
