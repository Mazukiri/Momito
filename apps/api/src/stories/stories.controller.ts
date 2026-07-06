import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { CreateStoryDto } from './dto/create-story.dto';
import { LinkStoryPromptDto } from './dto/link-story-prompt.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoriesService } from './stories.service';

@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.stories.list(user.id); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.stories.get(id, user.id); }
  @Post() create(@Body() dto: CreateStoryDto, @CurrentUser() user: AuthenticatedUser) { return this.stories.create(dto, user.id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoryDto, @CurrentUser() user: AuthenticatedUser) { return this.stories.update(id, dto, user.id); }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.stories.remove(id, user.id); }

  @Post(':id/prompts')
  linkPrompt(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkStoryPromptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stories.linkPrompt(id, dto.questionId, user.id);
  }

  @Delete(':id/prompts/:questionId')
  unlinkPrompt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stories.unlinkPrompt(id, questionId, user.id);
  }
}
