import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Puesto } from './entities/puesto.entity';
import { Departamento }
  from '../departamentos/entities/departamento.entity';

import { CreatePuestoDto }
  from './dto/create-puesto.dto';

import { UpdatePuestoDto }
  from './dto/update-puesto.dto';

@Injectable()
export class PuestosService {

  constructor(
    @InjectRepository(Puesto)
    private readonly puestoRepository:
      Repository<Puesto>,

    @InjectRepository(Departamento)
    private readonly departamentoRepository:
      Repository<Departamento>,
  ) {}

  async create(
    dto: CreatePuestoDto,
  ): Promise<Puesto> {

    const departamento =
      await this.departamentoRepository.findOne({
        where: {
          idDepartamento: dto.idDepartamento,
          isActive: true,
        },
      });

    if (!departamento) {
      throw new NotFoundException(
        'El departamento indicado no existe',
      );
    }

    const puesto =
      this.puestoRepository.create({
        ...dto,
        isActive: true,
      });

    return this.puestoRepository.save(puesto);
  }

  async findAll(): Promise<Puesto[]> {

    return this.puestoRepository.find({
      where: {
        isActive: true,
      },
      relations: {
        departamento: true,
      },
      order: {
        nombrePuesto: 'ASC',
      },
    });
  }

  async findOne(
    idPuesto: number,
  ): Promise<Puesto> {

    const puesto =
      await this.puestoRepository.findOne({
        where: {
          idPuesto,
          isActive: true,
        },
        relations: {
          departamento: true,
        },
      });

    if (!puesto) {
      throw new NotFoundException(
        'Puesto no encontrado',
      );
    }

    return puesto;
  }

  async update(
    idPuesto: number,
    dto: UpdatePuestoDto,
  ): Promise<Puesto> {

    const puesto = await this.findOne(idPuesto);

    if (dto.idDepartamento) {

      const departamento =
        await this.departamentoRepository.findOne({
          where: {
            idDepartamento:
              dto.idDepartamento,
            isActive: true,
          },
        });

      if (!departamento) {
        throw new NotFoundException(
          'El departamento indicado no existe',
        );
      }
    }

    Object.assign(puesto, dto);

    return this.puestoRepository.save(puesto);
  }

  async desactivar(
    idPuesto: number,
  ): Promise<Puesto> {

    const puesto = await this.findOne(idPuesto);

    puesto.isActive = false;

    return this.puestoRepository.save(puesto);
  }
}