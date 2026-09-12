import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@CurrentUser() user: { userId: string }) {
    return this.usersService.findMe(user.userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMe(user.userId, dto);
  }
}
