import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from './metrica-kpi.entity';
import type { DesgloseOrigen } from '../interfaces/desglose-origen.interface';

@Entity('metricas_kpi_diarias')
@Unique(
  'uk_empleado_metrica_fecha',
  ['idEmpleado', 'idMetrica', 'fecha'],
)
export class MetricaKpiDiaria {

  @PrimaryGeneratedColumn({
    name: 'id_registro',
  })
  idRegistro: number | undefined;

  @Column({
    name: 'id_empleado',
    type: 'int',
  })
  idEmpleado: number | undefined;

  @Column({
    name: 'id_metrica',
    type: 'int',
  })
  idMetrica: number | undefined;

  @Column({
    type: 'date',
  })
  fecha: string | undefined;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  valor: string | undefined;

  @Column({ name: 'desglose_origen', type: 'json', nullable: true })
  desgloseOrigen?: DesgloseOrigen[] | null;

  @Column({
    type: 'varchar',
    length: 20,
  })
  fuente: string | undefined;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date | undefined;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date | undefined;

  @ManyToOne(
    () => Empleado,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_empleado',
  })
  empleado: Empleado | undefined;

  @ManyToOne(
    () => MetricaKpi,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_metrica',
  })
  metrica: MetricaKpi | undefined;
}
