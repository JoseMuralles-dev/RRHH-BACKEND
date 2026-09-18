import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Rol } from './entities/rol.entity';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {

  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async create(dto: CreateRolDto): Promise<Rol> {

    const existente = await this.rolRepository.findOne({
      where: {
        codigoRol: dto.codigoRol,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Ya existe un rol con ese código',
      );
    }

    const rol = this.rolRepository.create({
      ...dto,
      isActive: true,
    });

    return this.rolRepository.save(rol);
  }

  async findAll(): Promise<Rol[]> {
    return this.rolRepository.find({
      where: {
        isActive: true,
      },
      order: {
        nivelJerarquico: 'ASC',
      },
    });
  }

  async findOne(idRol: number): Promise<Rol> {

    const rol = await this.rolRepository.findOne({
      where: {
        idRol,
        isActive: true,
      },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    return rol;
  }

  async update(
    idRol: number,
    dto: UpdateRolDto,
  ): Promise<Rol> {

    const rol = await this.findOne(idRol);

    Object.assign(rol, dto);

    return this.rolRepository.save(rol);
  }

  async desactivar(idRol: number): Promise<Rol> {

    const rol = await this.findOne(idRol);

    rol.isActive = false;

    return this.rolRepository.save(rol);
  }
}