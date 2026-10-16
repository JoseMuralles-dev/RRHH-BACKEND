import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('kpi_ventas_reglas')
export class KpiVentasRegla {
  @PrimaryColumn({ name: 'id_metrica', type: 'int' }) idMetrica!: number;
  @Column({ type: 'int' }) version!: number;
  @Column({ type: 'json' }) configuracion!: Record<string, unknown>;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}
