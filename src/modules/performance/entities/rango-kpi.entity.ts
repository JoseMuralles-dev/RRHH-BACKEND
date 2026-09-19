import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { MetricaKpi } from './metrica-kpi.entity';

@Entity('rangos_kpi')
export class RangoKpi {

  @PrimaryGeneratedColumn({
    name: 'id_rango',
  })
  idRango!: number;

  @Column({
    name: 'id_metrica',
    type: 'int',
  })
  idMetrica!: number;

  @Column({
    name: 'valor_minimo',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  valorMinimo!: string;

  @Column({
    name: 'valor_maximo',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  valorMaximo!: string;

  @Column({
    name: 'porcentaje_cumplimiento',
    type: 'decimal',
    precision: 6,
    scale: 2,
  })
  porcentajeCumplimiento!: string;

  @Column({
    name: 'puntos_otorgados',
    type: 'decimal',
    precision: 6,
    scale: 2,
  })
  puntosOtorgados!: string;

  @Column({
    type: 'int',
  })
  orden!: number;

  @Column({
    name: 'is_active',
    type: 'tinyint',
    default: true,
  })
  isActive!: boolean;

  @ManyToOne(
    () => MetricaKpi,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_metrica',
  })
  metrica!: MetricaKpi;
}