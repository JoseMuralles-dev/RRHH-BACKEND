import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from './metrica-kpi.entity';
@Entity('metas_kpi_empleado')
@Unique('uq_meta_empleado_periodo', ['idEmpleado', 'idMetrica', 'periodoAnio', 'periodoMes'])
export class MetaKpiEmpleado {
  @PrimaryGeneratedColumn({ name: 'id_meta' }) idMeta!: number;
  @Column({ name: 'id_empleado' }) idEmpleado!: number;
  @Column({ name: 'id_metrica' }) idMetrica!: number;
  @Column({ name: 'periodo_anio' }) periodoAnio!: number;
  @Column({ name: 'periodo_mes' }) periodoMes!: number;
  @Column({ name: 'meta_objetivo', type: 'decimal', precision: 14, scale: 2 }) metaObjetivo!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @ManyToOne(() => Empleado) @JoinColumn({ name: 'id_empleado' }) empleado!: Empleado;
  @ManyToOne(() => MetricaKpi) @JoinColumn({ name: 'id_metrica' }) metrica!: MetricaKpi;
}
