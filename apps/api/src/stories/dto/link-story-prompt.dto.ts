import { IsUUID } from 'class-validator';

export class LinkStoryPromptDto {
  @IsUUID() questionId!: string;
}
