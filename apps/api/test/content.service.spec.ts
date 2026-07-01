import { describe, expect, it, vi } from 'vitest';
import { CompaniesService } from '../src/companies/companies.service';
import { TopicsService } from '../src/topics/topics.service';

describe('content services', () => {
  it('creates, updates, and deletes a topic', async () => {
    const topic = {
      create: vi.fn().mockResolvedValue({ id: 'topic-1' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'topic-1' }),
      update: vi.fn().mockResolvedValue({ id: 'topic-1', name: 'Databases' }),
      delete: vi.fn().mockResolvedValue({ id: 'topic-1' }),
    };
    const service = new TopicsService({ topic } as never);

    await service.create({ name: 'Database' });
    await service.update('topic-1', { name: 'Databases' });
    await service.remove('topic-1');

    expect(topic.create).toHaveBeenCalledWith({ data: { name: 'Database' } });
    expect(topic.update).toHaveBeenCalledWith({
      where: { id: 'topic-1' },
      data: { name: 'Databases' },
    });
    expect(topic.delete).toHaveBeenCalledWith({ where: { id: 'topic-1' } });
  });

  it('creates, updates, and deletes a company', async () => {
    const company = {
      create: vi.fn().mockResolvedValue({ id: 'company-1' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'company-1' }),
      update: vi.fn().mockResolvedValue({ id: 'company-1', name: 'Example Co' }),
      delete: vi.fn().mockResolvedValue({ id: 'company-1' }),
    };
    const service = new CompaniesService({ company } as never);

    await service.create({ name: 'Example' });
    await service.update('company-1', { name: 'Example Co' });
    await service.remove('company-1');

    expect(company.create).toHaveBeenCalledWith({ data: { name: 'Example' } });
    expect(company.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      data: { name: 'Example Co' },
    });
    expect(company.delete).toHaveBeenCalledWith({ where: { id: 'company-1' } });
  });
});
