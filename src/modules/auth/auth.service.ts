import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { LoginDto } from './dto/login.dto';
import { Usuario } from '../user/entities/user.entity';
import { EstadoUsuario } from '../user/estado-usuario.enum';

@Injectable()
export class AuthService {

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { correo, password } = loginDto;

    const usuario = await this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .where('usuario.correo = :correo', { correo })
      .andWhere('usuario.isActive = :isActive', {
        isActive: true,
      })
      .getOne();

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    const passwordValido = await bcrypt.compare(
      password,
      usuario.passwordHash,
    );

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: usuario.idUsuario,
      correo: usuario.correo,
      idEmpleado: usuario.idEmpleado ?? null,
      idRol: usuario.idRol,
      nivelJerarquico: usuario.rol.nivelJerarquico,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),

      usuario: {
        idUsuario: usuario.idUsuario,
        correo: usuario.correo,
        idEmpleado: usuario.idEmpleado ?? null,
        rol: usuario.rol.codigoRol,
        nivel: usuario.rol.nivelJerarquico,
      },
    };
  }
}