import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('rangos_kpi')
export class RangoKpi {
  @PrimaryGeneratedColumn({ name: 'id_rango', type: 'int' })
  idRango!: number;

  @Column({ name: 'id_metrica', type: 'int' })
  idMetrica!: number;

  @Column({ name: 'valor_minimo', type: 'decimal', precision: 14, scale: 2, nullable: true })
  valorMinimo!: string | null;

  @Column({ name: 'valor_maximo', type: 'decimal', precision: 14, scale: 2, nullable: true })
  valorMaximo!: string | null;

  @Column({ name: 'porcentaje_cumplimiento', type: 'decimal', precision: 6, scale: 2 })
  porcentajeCumplimiento!: string;

  @Column({ name: 'puntos_otorgados', type: 'decimal', precision: 6, scale: 2 })
  puntosOtorgados!: string;

  @Column({ name: 'orden', type: 'int', default: 1 })
  orden!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
