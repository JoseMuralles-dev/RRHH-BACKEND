import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('detalle_resultado_kpi')
export class DetalleResultadoKpi {
  @PrimaryGeneratedColumn({ name: 'id_detalle', type: 'int' })
  idDetalle!: number;

  @Column({ name: 'id_resultado', type: 'int' })
  idResultado!: number;

  @Column({ name: 'origen', type: 'varchar', length: 30 })
  origen!: string;

  @Column({ name: 'valor', type: 'decimal', precision: 14, scale: 2 })
  valor!: string;

  @Column({ name: 'descripcion', type: 'varchar', length: 255, nullable: true })
  descripcion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
