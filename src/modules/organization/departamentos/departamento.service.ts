import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

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

    return this.guardar(
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
      relations: { puestos: true },
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

    if (dto.nombreDepartamento !== undefined && dto.nombreDepartamento !== departamento.nombreDepartamento) {
      const existente = await this.departamentoRepository.findOne({
        where: { nombreDepartamento: dto.nombreDepartamento },
      });
      if (existente && existente.idDepartamento !== idDepartamento) {
        throw new ConflictException('Ya existe un departamento con ese nombre');
      }
    }

    Object.assign(departamento, dto);

    return this.guardar(
      departamento,
    );
  }

  async desactivar(
    idDepartamento: number,
  ): Promise<Departamento> {

    const departamento =
      await this.findOne(idDepartamento);

    if (departamento.puestos?.some(puesto => puesto.isActive)) {
      throw new ConflictException('El departamento tiene puestos activos. Reasígnalos o desactívalos primero.');
    }

    departamento.isActive = false;

    return this.departamentoRepository.save(
      departamento,
    );
  }

  private async guardar(departamento: Departamento): Promise<Departamento> {
    try {
      return await this.departamentoRepository.save(departamento);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Ya existe un departamento con ese nombre');
      }
      throw error;
    }
  }
}
