import { Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profiles.uploadCv(file, user.id);
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.get(user.id);
  }

  @Patch()
  update(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profiles.update(user.id, dto);
  }
}
