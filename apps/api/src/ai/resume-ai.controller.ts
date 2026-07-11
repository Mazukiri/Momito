import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { ResumeAiAnalyzeDto } from './dto/resume-ai-analyze.dto';
import { ResumeAiJdDto } from './dto/resume-ai-jd.dto';
import { ResumeAiThemesDto } from './dto/resume-ai-themes.dto';
import { ResumeAiOrchestrator } from './resume-ai.orchestrator';

// MOM-136/137/138. Every route returns the {ok:true,result} | {ok:false,reason}
// envelope — with no ANTHROPIC_API_KEY these answer 200 {ok:false}, so the UI
// renders a "not configured" banner instead of an error page.
@Controller('resumes/:id/ai')
export class ResumeAiController {
  constructor(private readonly orchestrator: ResumeAiOrchestrator) {}

  // MOM-136: per-bullet impact/seniority analysis of the version.
  // MOM-149: optionally judged against a specific application's JD + company focus areas.
  @Post('analyze')
  analyze(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResumeAiAnalyzeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orchestrator.analyze(id, user.id, dto.jobApplicationId);
  }

  // MOM-151: turn the analysis's missing themes into study tasks (deduped, no model call).
  @Post('themes-to-tasks')
  themesToTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResumeAiThemesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orchestrator.themesToTasks(id, user.id, dto.themes);
  }

  // MOM-137: JD-tailored bullet rewrites; persisted to the version's aiSuggestions.
  // MOM-153: the JD may be pasted OR taken from the targeted/linked application.
  @Post('rewrite')
  rewrite(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResumeAiJdDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.rewrite(id, user.id, dto);
  }

  // MOM-138: cover-letter draft grounded in this version, with a visa-framing paragraph.
  // MOM-153: the visa paragraph is calibrated to the employer's known sponsorship posture.
  @Post('cover-letter')
  coverLetter(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResumeAiJdDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.coverLetter(id, user.id, dto);
  }
}
