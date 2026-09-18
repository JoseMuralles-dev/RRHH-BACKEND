import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { TipoIncidencia } from './tipo-incidencia.entity';
import { AprobacionIncidencia } from './aprobacion-incidencia.entity';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum';

@Entity('solicitudes_incidencia')
export class SolicitudIncidencia {

  @PrimaryGeneratedColumn({
    name: 'id_solicitud',
  })
  idSolicitud!: number;


  @Column({
    name: 'id_empleado',
    type: 'int',
  })
  idEmpleado!: number;


  @Column({
    name: 'id_tipo_incidencia',
    type: 'int',
  })
  idTipoIncidencia!: number;


  @Column({
    name: 'fecha_inicio',
    type: 'date',
    nullable: true,
  })
  fechaInicio!: string | null;


  @Column({
    name: 'fecha_fin',
    type: 'date',
    nullable: true,
  })
  fechaFin!: string | null;


  @Column({
    name: 'dias_solicitados',
    type: 'decimal',
    nullable: true,
    precision: 5,
    scale: 1,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | number | null) => value === null ? null : Number(value),
    },
  })
  diasSolicitados!: number | null;


  @Column({
    type: 'text',
  })
  motivo!: string;


  @Column({
    name: 'estado_solicitud',
    type: 'varchar',
    length: 20,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado!: EstadoSolicitud;


  @Column({
    name: 'fecha_resolucion',
    type: 'timestamp',
    nullable: true,
  })
  fechaResolucion?: Date | null;


  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;


  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;


  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;


  // RELACIONES
  
  @ManyToOne(
    () => Empleado,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_empleado',
  })
  empleado!: Empleado;


  @ManyToOne(
    () => TipoIncidencia,
    tipo => tipo.solicitudes,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_tipo_incidencia',
  })
  tipoIncidencia!: TipoIncidencia;


  @OneToMany(
    () => AprobacionIncidencia,
    aprobacion => aprobacion.solicitud,
  )
  aprobaciones?: AprobacionIncidencia[];
}