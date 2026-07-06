import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StoriesService } from '../src/stories/stories.service';

const baseStory = {
  id: 'story-1',
  userId: 'user-1',
  title: 'Led a migration under a hard deadline',
  situation: 'Legacy system at risk',
  task: 'Migrate without downtime',
  action: 'Staged rollout with feature flags',
  result: 'Zero-downtime migration',
  metrics: '99.99% uptime maintained',
  competencyTags: ['ownership'],
  followUpQuestions: ['What would you do differently?'],
  createdAt: new Date(),
  updatedAt: new Date(),
  companies: [],
  prompts: [],
};

describe('StoriesService', () => {
  it('scopes list to the authenticated user', async () => {
    const findMany = vi.fn().mockResolvedValue([baseStory]);
    const service = new StoriesService({ story: { findMany } } as never);

    await service.list('user-1');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
  });

  it('throws NotFoundException when getting another user\'s story', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new StoriesService({ story: { findFirst } } as never);

    await expect(service.get('story-1', 'user-2')).rejects.toEqual(new NotFoundException('Story not found'));
  });

  it('creates a story with deduplicated company links', async () => {
    const create = vi.fn().mockResolvedValue(baseStory);
    const service = new StoriesService({ story: { create } } as never);

    await service.create({
      title: baseStory.title,
      situation: baseStory.situation,
      task: baseStory.task,
      action: baseStory.action,
      result: baseStory.result,
      companyIds: ['c1', 'c1', 'c2'],
    }, 'user-1');

    expect(create.mock.calls[0][0].data.companies).toEqual({
      create: [{ companyId: 'c1' }, { companyId: 'c2' }],
    });
    expect(create.mock.calls[0][0].data.user).toEqual({ connect: { id: 'user-1' } });
  });

  it('deletes the story and its ReviewState in one transaction, scoped to the owner', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'story-1' });
    const reviewStateDeleteMany = vi.fn();
    const storyDelete = vi.fn();
    const transaction = vi.fn(async (ops) => ops);
    const service = new StoriesService({
      story: { findFirst, delete: storyDelete },
      reviewState: { deleteMany: reviewStateDeleteMany },
      $transaction: transaction,
    } as never);

    await service.remove('story-1', 'user-1');

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'story-1', userId: 'user-1' } }));
    expect(reviewStateDeleteMany).toHaveBeenCalledWith({ where: { objectType: 'story', objectId: 'story-1' } });
    expect(storyDelete).toHaveBeenCalledWith({ where: { id: 'story-1' } });
  });

  it('does not delete a story owned by another user', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new StoriesService({ story: { findFirst } } as never);

    await expect(service.remove('story-1', 'user-2')).rejects.toEqual(new NotFoundException('Story not found'));
  });

  it('links a story to a behavioral prompt', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'story-1' });
    const questionFindUnique = vi.fn().mockResolvedValue({ id: 'q1', type: 'behavioral' });
    const storyPromptFindUnique = vi.fn().mockResolvedValue(null);
    const storyPromptCreate = vi.fn();
    const findUniqueOrThrow = vi.fn().mockResolvedValue(baseStory);
    const service = new StoriesService({
      story: { findFirst, findUniqueOrThrow },
      question: { findUnique: questionFindUnique },
      storyPrompt: { findUnique: storyPromptFindUnique, create: storyPromptCreate },
    } as never);

    await service.linkPrompt('story-1', 'q1', 'user-1');

    expect(storyPromptCreate).toHaveBeenCalledWith({ data: { storyId: 'story-1', questionId: 'q1' } });
  });

  it('is idempotent when the link already exists', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'story-1' });
    const questionFindUnique = vi.fn().mockResolvedValue({ id: 'q1', type: 'behavioral' });
    const storyPromptFindUnique = vi.fn().mockResolvedValue({ storyId: 'story-1', questionId: 'q1' });
    const storyPromptCreate = vi.fn();
    const findUniqueOrThrow = vi.fn().mockResolvedValue(baseStory);
    const service = new StoriesService({
      story: { findFirst, findUniqueOrThrow },
      question: { findUnique: questionFindUnique },
      storyPrompt: { findUnique: storyPromptFindUnique, create: storyPromptCreate },
    } as never);

    await service.linkPrompt('story-1', 'q1', 'user-1');

    expect(storyPromptCreate).not.toHaveBeenCalled();
  });

  it('rejects linking to a non-behavioral question', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'story-1' });
    const questionFindUnique = vi.fn().mockResolvedValue({ id: 'q1', type: 'dsa' });
    const service = new StoriesService({
      story: { findFirst },
      question: { findUnique: questionFindUnique },
    } as never);

    await expect(service.linkPrompt('story-1', 'q1', 'user-1')).rejects.toEqual(
      new BadRequestException('Stories can only be linked to behavioral prompts'),
    );
  });

  it('rejects linking to a nonexistent question', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'story-1' });
    const questionFindUnique = vi.fn().mockResolvedValue(null);
    const service = new StoriesService({
      story: { findFirst },
      question: { findUnique: questionFindUnique },
    } as never);

    await expect(service.linkPrompt('story-1', 'q1', 'user-1')).rejects.toEqual(new NotFoundException('Question not found'));
  });

  it('unlinks a story from a prompt, scoped to the owner', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'story-1' });
    const deleteMany = vi.fn();
    const findUniqueOrThrow = vi.fn().mockResolvedValue(baseStory);
    const service = new StoriesService({
      story: { findFirst, findUniqueOrThrow },
      storyPrompt: { deleteMany },
    } as never);

    await service.unlinkPrompt('story-1', 'q1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({ where: { storyId: 'story-1', questionId: 'q1' } });
  });
});
