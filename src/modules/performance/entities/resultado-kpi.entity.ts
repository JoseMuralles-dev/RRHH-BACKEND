import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('resultados_kpi')
export class ResultadoKpi {
  @PrimaryGeneratedColumn({ name: 'id_resultado', type: 'int' })
  idResultado!: number;

  @Column({ name: 'id_evaluacion_desempeno', type: 'int' })
  idEvaluacionDesempeno!: number;

  @Column({ name: 'id_metrica', type: 'int' })
  idMetrica!: number;

  @Column({ name: 'valor_obtenido', type: 'decimal', precision: 14, scale: 2 })
  valorObtenido!: string;

  @Column({ name: 'meta_aplicada', type: 'decimal', precision: 14, scale: 2, nullable: true })
  metaAplicada!: string | null;

  @Column({ name: 'porcentaje_cumplimiento', type: 'decimal', precision: 7, scale: 2, nullable: true })
  porcentajeCumplimiento!: string | null;

  @Column({ name: 'puntos_obtenidos', type: 'decimal', precision: 6, scale: 2, default: 0 })
  puntosObtenidos!: string;

  @Column({ name: 'cantidad_eventos', type: 'int', nullable: true })
  cantidadEventos!: number | null;

  @Column({ name: 'penalizacion_generada', type: 'decimal', precision: 6, scale: 2, default: 0 })
  penalizacionGenerada!: string;

  @Column({ name: 'observacion', type: 'text', nullable: true })
  observacion!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
