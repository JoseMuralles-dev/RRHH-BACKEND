import { Controller, Post, Body, HttpCode, HttpStatus, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('mi-perfil')
  @UseGuards(JwtAuthGuard)
  perfilPersonal(@Req() request: { user: { idUsuario: number } }) {
    return this.authService.perfilPersonal(request.user.idUsuario);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  perfil(@Req() request: { user: { idUsuario: number } }) {
    return this.authService.perfil(request.user.idUsuario);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  
}
