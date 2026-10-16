import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
// No existe auditoria generica de KPI: registro append-only de entradas manuales y metas.
@Entity('kpi_cambios')
export class KpiCambio {
  @PrimaryGeneratedColumn({ name: 'id_cambio' }) idCambio!: number;
  @Column({ name: 'id_usuario' }) idUsuario!: number;
  @Column({ name: 'id_empleado' }) idEmpleado!: number;
  @Column({ length: 30 }) operacion!: string;
  @Column({ type: 'json', nullable: true }) anterior!: unknown;
  @Column({ type: 'json' }) nuevo!: unknown;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
