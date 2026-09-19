import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
// Ajusta esta ruta según tu estructura real.

@Entity('evaluaciones_desempeno')
export class EvaluacionDesempeno {

  @PrimaryGeneratedColumn({
    name: 'id_evaluacion_desempeno',
  })
  idEvaluacionDesempeno!: number;

  @Column({
    name: 'id_empleado',
    type: 'int',
  })
  idEmpleado!: number;

  @Column({
    name: 'id_departamento',
    type: 'int',
  })
  idDepartamento!: number;

  @Column({
    name: 'periodo_anio',
    type: 'int',
  })
  periodoAnio!: number;

  @Column({
    name: 'periodo_mes',
    type: 'int',
  })
  periodoMes!: number;

  @Column({
    name: 'puntaje_base',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  puntajeBase!: string;

  @Column({
    name: 'penalizacion_total',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  penalizacionTotal!: string;

  @Column({
    name: 'nota_final',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  notaFinal!: string;

  @Column({
    name: 'meta_global',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
  })
  metaGlobal!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'BORRADOR',
  })
  estado!: string;

  @Column({
    name: 'is_active',
    type: 'tinyint',
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

  @ManyToOne(
    () => Empleado,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_empleado',
  })
  empleado!: Empleado;
}