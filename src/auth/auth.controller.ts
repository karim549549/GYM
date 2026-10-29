import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentAccessToken } from '../common/decorators/current-access-token.decorator';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendDto } from './dto/resend.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyDto } from './dto/verify.dto';
import type { AuthSession } from './interfaces/auth-session.interface';
import type { MeResponse } from './interfaces/me-response.interface';
import type { Principal } from './interfaces/principal.interface';
import type { SignInResult } from './interfaces/sign-in.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(202)
  register(@Body() dto: RegisterDto): Promise<void> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyDto): Promise<SignInResult> {
    return this.auth.verify(dto);
  }

  @Public()
  @Post('resend')
  @HttpCode(204)
  resend(@Body() dto: ResendDto): Promise<void> {
    return this.auth.resend(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<SignInResult> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(202)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto): Promise<AuthSession> {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@CurrentAccessToken() accessToken: string): Promise<void> {
    return this.auth.logout(accessToken);
  }

  @Post('logout/all')
  @HttpCode(204)
  logoutEverywhere(@CurrentAccessToken() accessToken: string): Promise<void> {
    return this.auth.logoutEverywhere(accessToken);
  }

  @Get('me')
  me(@CurrentPrincipal() principal: Principal): MeResponse {
    return this.auth.describe(principal);
  }
}
