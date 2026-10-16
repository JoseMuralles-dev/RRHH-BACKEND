import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { EvaluacionDesempeno } from './evaluacion-desempeno.entity';
@Entity('kpi_ventas_snapshot')
export class KpiVentasSnapshot {
  @PrimaryColumn({ name: 'id_evaluacion_desempeno' }) idEvaluacionDesempeno!: number;
  @Column({ type: 'json' }) datos!: any;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @ManyToOne(() => EvaluacionDesempeno) @JoinColumn({ name: 'id_evaluacion_desempeno' }) evaluacion!: EvaluacionDesempeno;
}
