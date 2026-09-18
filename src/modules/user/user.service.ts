import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/user.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { EstadoUsuario } from './estado-usuario.enum';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Rol } from '../roles/entities/rol.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';

@Injectable() 
export class UsuariosService {
  constructor(
    // Inyección de Dependencias del Repositorio de TypeORM (tu "DAO")
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  // --- 1. CREAR USUARIO (Con Hash de Contraseña) ---
  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    const { correo, password, idRol, idEmpleado } = createUsuarioDto;

    // Verificar correo duplicado
    const usuarioExistente = await this.usuarioRepository.findOne({
      where: { correo },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        `El correo ${correo} ya se encuentra registrado`,
      );
    }

    try {
      // Hash bcrypt con 10 rondas
      const passwordHash = await bcrypt.hash(password, 10);

      // IMPORTANTE:
      // EstadoUsuario.ACTIVO y no 'ACTIVO'
      const nuevoUsuario: Usuario = this.usuarioRepository.create({
        correo,
        passwordHash,
        idRol,
        idEmpleado: idEmpleado ?? null,
        estado: EstadoUsuario.ACTIVO,
        isActive: true,
      });

      const usuarioGuardado: Usuario =
        await this.usuarioRepository.save(nuevoUsuario);

      delete (usuarioGuardado as Partial<Usuario>).passwordHash;

      return usuarioGuardado;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al crear el usuario en la base de datos',
      );
    }
  }

  // --- 2. LISTAR TODOS LOS USUARIOS ---
  async findAll(): Promise<Usuario[]> {
    return await this.usuarioRepository.find({
      // Como 'rol' tiene eager: true en la Entity, traerá automáticamente los datos del Rol
    });
  }

  // --- 3. BUSCAR UN USUARIO POR ID ---
  async findOne(id: number, includeInactive = false): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: includeInactive ? { idUsuario: id } : { idUsuario: id, isActive: true },
    });

    if (!usuario) {
      throw new NotFoundException(
        `El usuario con ID ${id} no existe o está inactivo`,
      );
    }

    return usuario;
  }

  // --- 4. BUSCAR POR EMAIL (Uso interno para Auth) ---
  async findByEmail(correo: string): Promise<Usuario | null> {
    return await this.usuarioRepository.findOne({
      where: { correo, isActive: true },
    });
  }

  // --- 5. DESACTIVAR USUARIO (Soft Delete) ---
  async remove(id: number): Promise<{ message: string }> {
    const usuario = await this.findOne(id);

    usuario.isActive = false;
    usuario.estado = EstadoUsuario.INACTIVO;

    await this.usuarioRepository.save(usuario);

    return { message: `Usuario con ID ${id} desactivado correctamente` };
  }

  async update(id: number, dto: UpdateUsuarioDto): Promise<Usuario> {
    await this.findOne(id, true);
    const changes: UpdateUsuarioDto & { estado?: EstadoUsuario } = {};
    if (dto.isActive !== undefined) {
      changes.isActive = dto.isActive;
      changes.estado = dto.isActive ? EstadoUsuario.ACTIVO : EstadoUsuario.INACTIVO;
    }
    if (dto.correo !== undefined) {
      const existing = await this.usuarioRepository.findOne({
        where: { correo: dto.correo },
      });
      if (existing && existing.idUsuario !== id) {
        throw new ConflictException('El correo ya se encuentra registrado');
      }
      changes.correo = dto.correo;
    }
    if (dto.idRol !== undefined) {
      const rol = await this.usuarioRepository.manager
        .getRepository(Rol)
        .findOne({
          where: { idRol: dto.idRol, isActive: true },
        });
      if (!rol) throw new NotFoundException('Rol no encontrado o inactivo');
      changes.idRol = dto.idRol;
    }
    if (dto.idEmpleado !== undefined) {
      if (dto.idEmpleado !== null) {
        const empleado = await this.usuarioRepository.manager
          .getRepository(Empleado)
          .findOne({
            where: { idEmpleado: dto.idEmpleado, isActive: true },
          });
        if (!empleado)
          throw new NotFoundException('Empleado no encontrado o inactivo');
        const existing = await this.usuarioRepository.findOne({
          where: { idEmpleado: dto.idEmpleado },
        });
        if (existing && existing.idUsuario !== id) {
          throw new ConflictException(
            'El empleado ya tiene un usuario asignado',
          );
        }
      }
      changes.idEmpleado = dto.idEmpleado;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para actualizar',
      );
    }
    try {
      await this.usuarioRepository.update(id, changes);
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } }).driverError?.code ===
        'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(
          'El correo o empleado ya está asignado a otro usuario',
        );
      }
      throw error;
    }
    return this.findOne(id, true);
  }

  async changePassword(
    id: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.findOne(id);
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException('La contraseña no puede exceder 72 bytes');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.usuarioRepository.update(id, { passwordHash });
    return { message: 'Contraseña actualizada correctamente' };
  }
}
