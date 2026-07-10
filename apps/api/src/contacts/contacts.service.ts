import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Contact } from '@prisma/client';
import { ContactRelationship, ContactResponse } from '@momito/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  // MOM-119 uses this for the standalone contacts list; grouped by the caller.
  async list(userId: string): Promise<ContactResponse[]> {
    const contacts = await this.prisma.contact.findMany({
      where: { userId },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    return contacts.map((contact) => this.serialize(contact));
  }

  async listForJob(jobId: string, userId: string): Promise<ContactResponse[]> {
    await this.ensureJob(jobId, userId);
    const contacts = await this.prisma.contact.findMany({
      where: { userId, jobApplicationId: jobId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return contacts.map((contact) => this.serialize(contact));
  }

  // Standalone create (POST /contacts). May attach to a job via dto.jobApplicationId.
  async create(dto: CreateContactDto, userId: string): Promise<ContactResponse> {
    if (dto.jobApplicationId) await this.ensureJob(dto.jobApplicationId, userId);
    const contact = await this.prisma.contact.create({ data: this.toCreateData(dto, dto.jobApplicationId ?? null, userId) });
    return this.serialize(contact);
  }

  // Nested create (POST /jobs/:jobId/contacts) — the job comes from the path and
  // wins over any body jobApplicationId.
  async createForJob(jobId: string, dto: CreateContactDto, userId: string): Promise<ContactResponse> {
    await this.ensureJob(jobId, userId);
    const contact = await this.prisma.contact.create({ data: this.toCreateData(dto, jobId, userId) });
    return this.serialize(contact);
  }

  async update(id: string, dto: UpdateContactDto, userId: string): Promise<ContactResponse> {
    if (dto.jobApplicationId) await this.ensureJob(dto.jobApplicationId, userId);
    const result = await this.prisma.contact.updateMany({
      where: { id, userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.email !== undefined && { email: this.clean(dto.email) }),
        ...(dto.linkedinUrl !== undefined && { linkedinUrl: this.clean(dto.linkedinUrl) }),
        ...(dto.company !== undefined && { company: this.clean(dto.company) }),
        ...(dto.relationship !== undefined && { relationship: dto.relationship }),
        ...(dto.notes !== undefined && { notes: this.clean(dto.notes) }),
        ...(dto.jobApplicationId !== undefined && { jobApplicationId: dto.jobApplicationId }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Contact not found');
    const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id } });
    return this.serialize(contact);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.prisma.contact.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Contact not found');
  }

  private toCreateData(dto: CreateContactDto, jobApplicationId: string | null, userId: string) {
    if (!dto.name?.trim()) throw new BadRequestException('Contact name is required');
    return {
      userId,
      jobApplicationId,
      name: dto.name.trim(),
      email: this.clean(dto.email),
      linkedinUrl: this.clean(dto.linkedinUrl),
      company: this.clean(dto.company),
      relationship: dto.relationship ?? null,
      notes: this.clean(dto.notes),
    };
  }

  private serialize(contact: Contact): ContactResponse {
    return {
      id: contact.id,
      userId: contact.userId,
      jobApplicationId: contact.jobApplicationId,
      name: contact.name,
      email: contact.email,
      linkedinUrl: contact.linkedinUrl,
      company: contact.company,
      relationship: (contact.relationship as ContactRelationship | null) ?? null,
      notes: contact.notes,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  private async ensureJob(jobId: string, userId: string) {
    const job = await this.prisma.jobApplication.findFirst({ where: { id: jobId, userId }, select: { id: true } });
    if (!job) throw new NotFoundException('Job not found');
  }

  private clean(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
