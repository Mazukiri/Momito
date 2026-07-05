import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateAnswerDto } from '../src/sessions/dto/create-answer.dto';

describe('CreateAnswerDto reflection fields (MOM-028)', () => {
  it('accepts miss tags drawn from the plan §5.4 taxonomy', async () => {
    const dto = plainToInstance(CreateAnswerDto, {
      questionId: '11111111-1111-4111-8111-111111111111',
      answerText: 'answer',
      missTags: ['misread', 'time_pressure'],
      reflectionNote: 'Ran out of time before checking edge cases.',
      language: 'python',
      complexity: 'O(n log n)',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a miss tag outside the known taxonomy', async () => {
    const dto = plainToInstance(CreateAnswerDto, {
      questionId: '11111111-1111-4111-8111-111111111111',
      answerText: 'answer',
      missTags: ['gave_up'],
    });

    const errors = await validate(dto);

    expect(errors.find(({ property }) => property === 'missTags')).toBeDefined();
  });

  it('rejects a reflection note over the length limit', async () => {
    const dto = plainToInstance(CreateAnswerDto, {
      questionId: '11111111-1111-4111-8111-111111111111',
      answerText: 'answer',
      reflectionNote: 'x'.repeat(2001),
    });

    const errors = await validate(dto);

    expect(errors.find(({ property }) => property === 'reflectionNote')).toBeDefined();
  });
});
