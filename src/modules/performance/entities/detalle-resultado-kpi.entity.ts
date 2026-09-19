import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ResultadoKpi } from './resultado-kpi.entity';

@Entity('detalle_resultado_kpi')
export class DetalleResultadoKpi {

  @PrimaryGeneratedColumn({
    name: 'id_detalle',
  })
  idDetalle!: number;

  @Column({
    name: 'id_resultado',
    type: 'int',
  })
  idResultado!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  origen!: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  valor!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  descripcion!: string | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @ManyToOne(
    () => ResultadoKpi,
    {
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'id_resultado',
  })
  resultado!: ResultadoKpi;
}