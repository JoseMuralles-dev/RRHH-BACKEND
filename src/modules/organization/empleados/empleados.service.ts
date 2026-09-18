import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Like, Repository } from 'typeorm';

import { Empleado } from './entities/empleado.entity';

import { Puesto } from '../puestos/entities/puesto.entity';

import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,

    @InjectRepository(Puesto)
    private readonly puestoRepository: Repository<Puesto>,
  ) {}

  // ============================================================
  // CREAR
  // ============================================================

  async create(dto: CreateEmpleadoDto): Promise<Empleado> {
    // Validar puesto
    const puesto = await this.puestoRepository.findOne({
      where: {
        idPuesto: dto.idPuesto,
        isActive: true,
      },
    });

    if (!puesto) {
      throw new NotFoundException('El puesto indicado no existe');
    }

    // Validar DPI
    const dpiExistente = await this.empleadoRepository.findOne({
      where: {
        dpi: dto.dpi,
      },
    });

    if (dpiExistente) {
      throw new ConflictException('Ya existe un empleado con ese DPI');
    }

    // Validar IGSS
    const igssExistente = await this.empleadoRepository.findOne({
      where: {
        igss: dto.igss,
      },
    });

    if (igssExistente) {
      throw new ConflictException(
        'Ya existe un empleado con ese número de IGSS',
      );
    }

    // Validar código SAP
    if (dto.codigoSapEmpleado !== undefined && dto.codigoSapEmpleado !== null) {
      const sapExistente = await this.empleadoRepository.findOne({
        where: {
          codigoSapEmpleado: dto.codigoSapEmpleado,
        },
      });

      if (sapExistente) {
        throw new ConflictException(
          'El código SAP ya está asignado a otro empleado',
        );
      }
    }

    // Validar jefe directo
    if (dto.idJefeDirecto) {
      const jefe = await this.empleadoRepository.findOne({
        where: {
          idEmpleado: dto.idJefeDirecto,
          isActive: true,
        },
      });

      if (!jefe) {
        throw new NotFoundException('El jefe directo indicado no existe');
      }
    }

    const empleado = this.empleadoRepository.create({
      ...dto,
      isActive: true,
    });

    return this.empleadoRepository.save(empleado);
  }

  // ============================================================
  // LISTAR TODOS LOS EMPLEADOS ACTIVOS
  // ============================================================

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

        usuario: true,
      },

      order: {
        primerApellido: 'ASC',
        primerNombre: 'ASC',
      },
    });
  }

  // ============================================================
  // BUSCAR POR ID
  // ============================================================

  async findOne(idEmpleado: number): Promise<Empleado> {
    const empleado = await this.empleadoRepository.findOne({
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
      throw new NotFoundException('Empleado no encontrado');
    }

    return empleado;
  }

  // ============================================================
  // LISTA REDUCIDA PARA SELECTS
  // ============================================================

  async findForSelect() {
    const empleados = await this.empleadoRepository.find({
      where: {
        isActive: true,
      },

      select: {
        idEmpleado: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },

      order: {
        primerApellido: 'ASC',
        primerNombre: 'ASC',
      },
    });

    return empleados.map((empleado) => ({
      idEmpleado: empleado.idEmpleado,

      nombreCompleto: [
        empleado.primerNombre,
        empleado.segundoNombre,
        empleado.primerApellido,
        empleado.segundoApellido,
      ]
        .filter(Boolean)
        .join(' '),
    }));
  }

  // ============================================================
  // BUSCAR EMPLEADOS
  // ============================================================

  async buscar(texto: string = '') {
    if (typeof texto !== 'string') {
      throw new BadRequestException('El texto de búsqueda debe ser una cadena');
    }

    const termino = texto.trim();

    if (!termino) {
      return [];
    }

    return this.empleadoRepository.find({
      where: [
        {
          primerNombre: Like(`%${termino}%`),
          isActive: true,
        },

        {
          segundoNombre: Like(`%${termino}%`),
          isActive: true,
        },

        {
          primerApellido: Like(`%${termino}%`),
          isActive: true,
        },

        {
          segundoApellido: Like(`%${termino}%`),
          isActive: true,
        },

        {
          dpi: Like(`%${termino}%`),
          isActive: true,
        },
      ],

      relations: {
        puesto: {
          departamento: true,
        },
      },

      order: {
        primerApellido: 'ASC',
        primerNombre: 'ASC',
      },

      take: 20,
    });
  }

  // ============================================================
  // ACTUALIZAR
  // ============================================================

  async update(idEmpleado: number, dto: UpdateEmpleadoDto): Promise<Empleado> {
    const empleado = await this.findOne(idEmpleado);

    // ----------------------------------------------------------
    // Validar puesto
    // ----------------------------------------------------------

    if (dto.idPuesto !== undefined) {
      const puesto = await this.puestoRepository.findOne({
        where: {
          idPuesto: dto.idPuesto,
          isActive: true,
        },
      });

      if (!puesto) {
        throw new NotFoundException('El puesto indicado no existe');
      }
    }

    // Validar jefe directo
   
    if (dto.idJefeDirecto !== undefined && dto.idJefeDirecto !== null) {
      if (dto.idJefeDirecto === idEmpleado) {
        throw new ConflictException('Un empleado no puede ser su propio jefe');
      }

      const jefe = await this.empleadoRepository.findOne({
        where: {
          idEmpleado: dto.idJefeDirecto,

          isActive: true,
        },
      });

      if (!jefe) {
        throw new NotFoundException('El jefe directo indicado no existe');
      }
    }

    // ----------------------------------------------------------
    // Validar cambio de DPI
    // ----------------------------------------------------------

    if (dto.dpi && dto.dpi !== empleado.dpi) {
      const dpiExistente = await this.empleadoRepository.findOne({
        where: {
          dpi: dto.dpi,
        },
      });

      if (dpiExistente) {
        throw new ConflictException('El DPI ya pertenece a otro empleado');
      }
    }

    // ----------------------------------------------------------
    // Validar cambio de IGSS
    // ----------------------------------------------------------

    if (dto.igss && dto.igss !== empleado.igss) {
      const igssExistente = await this.empleadoRepository.findOne({
        where: {
          igss: dto.igss,
        },
      });

      if (igssExistente) {
        throw new ConflictException(
          'El número de IGSS ya pertenece a otro empleado',
        );
      }
    }

    // ----------------------------------------------------------
    // Validar código SAP
    // ----------------------------------------------------------

    if (
      dto.codigoSapEmpleado !== undefined &&
      dto.codigoSapEmpleado !== null &&
      dto.codigoSapEmpleado !== empleado.codigoSapEmpleado
    ) {
      const sapExistente = await this.empleadoRepository.findOne({
        where: {
          codigoSapEmpleado: dto.codigoSapEmpleado,
        },
      });

      if (sapExistente) {
        throw new ConflictException(
          'El código SAP ya pertenece a otro empleado',
        );
      }
    }

    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para actualizar',
      );
    }
    await this.empleadoRepository.update(idEmpleado, changes);
    return this.findOne(idEmpleado);
  }

  // ============================================================
  // DESACTIVAR
  // ============================================================

  async desactivar(idEmpleado: number): Promise<Empleado> {
    const empleado = await this.findOne(idEmpleado);

    empleado.isActive = false;

    return this.empleadoRepository.save(empleado);
  }
}
