import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/user.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { EstadoUsuario } from './estado-usuario.enum';

@Injectable() // Equivale a @Service en Spring Boot
export class UsuariosService {
  constructor(
    // Inyección de Dependencias del Repositorio de TypeORM (tu "DAO")
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  // --- 1. CREAR USUARIO (Con Hash de Contraseña) ---
 async create(
  createUsuarioDto: CreateUsuarioDto,
): Promise<Usuario> {

  const {
    correo,
    password,
    idRol,
    idEmpleado,
  } = createUsuarioDto;

  // Verificar correo duplicado
  const usuarioExistente =
    await this.usuarioRepository.findOne({
      where: { correo },
    });

  if (usuarioExistente) {
    throw new ConflictException(
      `El correo ${correo} ya se encuentra registrado`,
    );
  }

  try {

    // Hash bcrypt con 10 rondas
    const passwordHash = await bcrypt.hash(
      password,
      10,
    );

    // IMPORTANTE:
    // EstadoUsuario.ACTIVO y no 'ACTIVO'
    const nuevoUsuario: Usuario =
      this.usuarioRepository.create({
        correo,
        passwordHash,
        idRol,
        idEmpleado: idEmpleado ?? null,
        estado: EstadoUsuario.ACTIVO,
        isActive: true,
      });

    const usuarioGuardado: Usuario =
      await this.usuarioRepository.save(
        nuevoUsuario,
      );

    delete (usuarioGuardado as Partial<Usuario>)
      .passwordHash;

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
      where: { isActive: true },
      // Como 'rol' tiene eager: true en la Entity, traerá automáticamente los datos del Rol
    });
  }

  // --- 3. BUSCAR UN USUARIO POR ID ---
  async findOne(id: number): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: id, isActive: true },
    });

    if (!usuario) {
      throw new NotFoundException(`El usuario con ID ${id} no existe o está inactivo`);
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
}