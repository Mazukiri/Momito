import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}
  @Get() list() { return this.companies.list(); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.companies.get(id); }
  @Post() create(@Body() dto: CreateCompanyDto) { return this.companies.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) { return this.companies.update(id, dto); }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) { return this.companies.remove(id); }
}
