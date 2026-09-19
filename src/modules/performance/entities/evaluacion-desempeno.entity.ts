import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('evaluaciones_desempeno')
export class EvaluacionDesempeno {
  @PrimaryGeneratedColumn({ name: 'id_evaluacion_desempeno', type: 'int' })
  idEvaluacionDesempeno!: number;

  @Column({ name: 'id_empleado', type: 'int' })
  idEmpleado!: number;

  @Column({ name: 'id_departamento', type: 'int' })
  idDepartamento!: number;

  @Column({ name: 'periodo_anio', type: 'int' })
  periodoAnio!: number;

  @Column({ name: 'periodo_mes', type: 'int' })
  periodoMes!: number;

  @Column({ name: 'puntaje_base', type: 'decimal', precision: 6, scale: 2, default: 0 })
  puntajeBase!: string;

  @Column({ name: 'penalizacion_total', type: 'decimal', precision: 6, scale: 2, default: 0 })
  penalizacionTotal!: string;

  @Column({ name: 'nota_final', type: 'decimal', precision: 6, scale: 2, default: 0 })
  notaFinal!: string;

  @Column({ name: 'meta_global', type: 'decimal', precision: 5, scale: 2, nullable: true })
  metaGlobal!: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: "CALCULADA" })
  estado!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
