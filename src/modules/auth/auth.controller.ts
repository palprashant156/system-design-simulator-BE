import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  register() {
    return this.authService.register();
  }

  @Post('login')
  @ApiOperation({ summary: 'Sign in to a user account' })
  login() {
    return this.authService.login();
  }
}
