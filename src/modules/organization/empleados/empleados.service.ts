import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Empleado }
  from './entities/empleado.entity';

import { Puesto }
  from '../puestos/entities/puesto.entity';

import { CreateEmpleadoDto }
  from './dto/create-empleado.dto';

import { UpdateEmpleadoDto }
  from './dto/update-empleado.dto';

@Injectable()
export class EmpleadosService {

  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository:
      Repository<Empleado>,

    @InjectRepository(Puesto)
    private readonly puestoRepository:
      Repository<Puesto>,
  ) {}

  async create(
    dto: CreateEmpleadoDto,
  ): Promise<Empleado> {

    // =====================================================
    // Validar puesto
    // =====================================================

    const puesto =
      await this.puestoRepository.findOne({
        where: {
          idPuesto: dto.idPuesto,
          isActive: true,
        },
      });

    if (!puesto) {
      throw new NotFoundException(
        'El puesto indicado no existe',
      );
    }

    // =====================================================
    // Validar DPI
    // =====================================================

    const dpiExistente =
      await this.empleadoRepository.findOne({
        where: {
          dpi: dto.dpi,
        },
      });

    if (dpiExistente) {
      throw new ConflictException(
        'Ya existe un empleado con ese DPI',
      );
    }

    // =====================================================
    // Validar IGSS
    // =====================================================

    const igssExistente =
      await this.empleadoRepository.findOne({
        where: {
          igss: dto.igss,
        },
      });

    if (igssExistente) {
      throw new ConflictException(
        'Ya existe un empleado con ese número de IGSS',
      );
    }

    // =====================================================
    // Validar código SAP
    // =====================================================

    if (dto.codigoSapEmpleado) {

      const sapExistente =
        await this.empleadoRepository.findOne({
          where: {
            codigoSapEmpleado:
              dto.codigoSapEmpleado,
          },
        });

      if (sapExistente) {
        throw new ConflictException(
          'El código SAP ya está asignado',
        );
      }
    }

    // =====================================================
    // Validar jefe
    // =====================================================

    if (dto.idJefeDirecto) {

      const jefe =
        await this.empleadoRepository.findOne({
          where: {
            idEmpleado:
              dto.idJefeDirecto,
            isActive: true,
          },
        });

      if (!jefe) {
        throw new NotFoundException(
          'El jefe directo indicado no existe',
        );
      }
    }

    const empleado =
      this.empleadoRepository.create({
        ...dto,
        isActive: true,
      });

    return this.empleadoRepository.save(
      empleado,
    );
  }


  async findAll(): Promise<Empleado[]> {

    return this.empleadoRepository.find({
      where: {
        isActive: true,
      },

      relations: {
        puesto: {
          departamento: true,
        },
        jefeDirecto: true,
      },

      order: {
        primerApellido: 'ASC',
        primerNombre: 'ASC',
      },
    });
  }


  async findOne(
    idEmpleado: number,
  ): Promise<Empleado> {

    const empleado =
      await this.empleadoRepository.findOne({
        where: {
          idEmpleado,
          isActive: true,
        },

        relations: {
          puesto: {
            departamento: true,
          },
          jefeDirecto: true,
          usuario: true,
        },
      });

    if (!empleado) {
      throw new NotFoundException(
        'Empleado no encontrado',
      );
    }

    return empleado;
  }


  async update(
    idEmpleado: number,
    dto: UpdateEmpleadoDto,
  ): Promise<Empleado> {

    const empleado =
      await this.findOne(idEmpleado);

    // Cambio de puesto
    if (dto.idPuesto) {

      const puesto =
        await this.puestoRepository.findOne({
          where: {
            idPuesto:
              dto.idPuesto,
            isActive: true,
          },
        });

      if (!puesto) {
        throw new NotFoundException(
          'El puesto indicado no existe',
        );
      }
    }

    // Cambio de jefe
    if (dto.idJefeDirecto) {

      if (dto.idJefeDirecto === idEmpleado) {
        throw new ConflictException(
          'Un empleado no puede ser su propio jefe',
        );
      }

      const jefe =
        await this.empleadoRepository.findOne({
          where: {
            idEmpleado:
              dto.idJefeDirecto,
            isActive: true,
          },
        });

      if (!jefe) {
        throw new NotFoundException(
          'El jefe directo indicado no existe',
        );
      }
    }

    Object.assign(empleado, dto);

    return this.empleadoRepository.save(
      empleado,
    );
  }


  async desactivar(
    idEmpleado: number,
  ): Promise<Empleado> {

    const empleado =
      await this.findOne(idEmpleado);

    empleado.isActive = false;

    return this.empleadoRepository.save(
      empleado,
    );
  }
}