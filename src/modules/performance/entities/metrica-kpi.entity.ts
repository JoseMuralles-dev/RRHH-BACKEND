import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';



import { Departamento } from '../../organization/departamentos/entities/departamento.entity';

@Entity('metricas_kpi')
export class MetricaKpi {

  @PrimaryGeneratedColumn({
    name: 'id_metrica',
  })
  idMetrica!: number;

  @Column({
    name: 'id_departamento',
    type: 'int',
  })
  idDepartamento!: number;

  @Column({
  name: 'codigo_kpi',
  type: 'varchar',
  length: 50,
  unique: true,
})
codigoKpi!: string;

  @Column({
    name: 'nombre_kpi',
    type: 'varchar',
    length: 100,
  })
  nombreKpi!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    name: 'unidad_medida',
    type: 'varchar',
    length: 30,
  })
  unidadMedida!: string;

  @Column({
    name: 'peso_porcentaje',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  pesoPorcentaje!: string;

  @Column({
    name: 'tipo_calculo',
    type: 'varchar',
    length: 20,
  })
  tipoCalculo!: string;

  @Column({
    name: 'fuente_datos',
    type: 'varchar',
    length: 20,
  })
  fuenteDatos!: string;

  @Column({
    name: 'origen_datos',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  origenDatos!: string | null;

  @Column({
    name: 'penalizacion_por_evento',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  penalizacionPorEvento!: string;

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
    () => Departamento,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_departamento',
  })
  departamento!: Departamento;
  @Column({
  name: 'meta_objetivo',
  type: 'decimal',
  precision: 14,
  scale: 2,
  nullable: true,
})
metaObjetivo!: string | null;
}