import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Departamento } from '../../organization/departamentos/entities/departamento.entity';

@Entity('metricas_kpi')
export class MetricaKpi {

  @PrimaryGeneratedColumn({
    name: 'id_metrica',
  })
  idMetrica: number | undefined;

  @Column({
    name: 'id_departamento',
    type: 'int',
  })
  idDepartamento: number | undefined;

  @Column({
    name: 'codigo_kpi',
    length: 50,
    type: 'varchar',
    unique: true,
  })
  codigoKpi: string | undefined;

  @Column({
    name: 'nombre_kpi',
    length: 100,
    type: 'varchar',
  })
  nombreKpi: string | undefined;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion?: string | null;

  @Column({
    name: 'unidad_medida',
    type: 'varchar',
    length: 30,
  })
  unidadMedida: string | undefined;

  @Column({
    name: 'peso_porcentaje',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  pesoPorcentaje: string | undefined;

  @Column({
    name: 'meta_objetivo',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  metaObjetivo!: string | null;

  @Column({
    name: 'fuente_datos',
    type: 'varchar',
    length: 20,
  })
  fuenteDatos: string | undefined;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean | undefined;

  @ManyToOne(
    () => Departamento,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_departamento',
  })
  departamento: Departamento | undefined;
}
