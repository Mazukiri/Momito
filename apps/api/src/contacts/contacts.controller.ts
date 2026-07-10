import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

// MOM-116/117: contacts are both standalone (/contacts) and job-scoped
// (/jobs/:jobId/contacts). One controller carries both route groups; the nested
// path lives here rather than in the jobs controller to keep contact logic together.
@Controller()
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get('contacts')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.contacts.list(user.id);
  }

  @Post('contacts')
  create(@Body() dto: CreateContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.create(dto, user.id);
  }

  @Patch('contacts/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.update(id, dto, user.id);
  }

  @Delete('contacts/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.remove(id, user.id);
  }

  @Get('jobs/:jobId/contacts')
  listForJob(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.listForJob(jobId, user.id);
  }

  @Post('jobs/:jobId/contacts')
  createForJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Body() dto: CreateContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.createForJob(jobId, dto, user.id);
  }
}
