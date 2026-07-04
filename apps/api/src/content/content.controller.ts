import { Controller, Get } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('coverage')
  coverage() {
    return this.content.coverage();
  }
}
