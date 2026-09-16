import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Departamento } from './entities/departamento.entity';
import { CreateDepartamentoDto } from './dto/create-departamento.dto';
import { UpdateDepartamentoDto } from './dto/update-departamento.dto';

@Injectable()
export class DepartamentosService {

  constructor(
    @InjectRepository(Departamento)
    private readonly departamentoRepository:
      Repository<Departamento>,
  ) {}

  async create(
    dto: CreateDepartamentoDto,
  ): Promise<Departamento> {

    const existente =
      await this.departamentoRepository.findOne({
        where: {
          nombreDepartamento:
            dto.nombreDepartamento,
        },
      });

    if (existente) {
      throw new ConflictException(
        'Ya existe un departamento con ese nombre',
      );
    }

    const departamento =
      this.departamentoRepository.create({
        ...dto,
        isActive: true,
      });

    return this.departamentoRepository.save(
      departamento,
    );
  }

  async findAll(): Promise<Departamento[]> {

    return this.departamentoRepository.find({
      where: {
        isActive: true,
      },
      order: {
        nombreDepartamento: 'ASC',
      },
    });
  }

  async findOne(
    idDepartamento: number,
  ): Promise<Departamento> {

    const departamento =
      await this.departamentoRepository.findOne({
        where: {
          idDepartamento,
          isActive: true,
        },
        relations: {
          puestos: true,
        },
      });

    if (!departamento) {
      throw new NotFoundException(
        'Departamento no encontrado',
      );
    }

    return departamento;
  }

  async update(
    idDepartamento: number,
    dto: UpdateDepartamentoDto,
  ): Promise<Departamento> {

    const departamento =
      await this.findOne(idDepartamento);

    Object.assign(departamento, dto);

    return this.departamentoRepository.save(
      departamento,
    );
  }

  async desactivar(
    idDepartamento: number,
  ): Promise<Departamento> {

    const departamento =
      await this.findOne(idDepartamento);

    departamento.isActive = false;

    return this.departamentoRepository.save(
      departamento,
    );
  }
}