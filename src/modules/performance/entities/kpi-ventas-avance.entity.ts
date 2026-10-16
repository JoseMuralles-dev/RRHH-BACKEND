import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Avance operativo, separado de la evaluacion oficial (que exige nota completa).
@Entity('kpi_ventas_avance')
export class KpiVentasAvance {
  @PrimaryColumn({ name: 'id_empleado', type: 'int' }) idEmpleado!: number;
  @PrimaryColumn({ name: 'periodo_anio', type: 'int' }) periodoAnio!: number;
  @PrimaryColumn({ name: 'periodo_mes', type: 'int' }) periodoMes!: number;
  @Column({ name: 'fecha_corte', type: 'date' }) fechaCorte!: string;
  @Column({ type: 'json' }) datos!: any;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}

// Foto acumulada al corte, NO movimiento diario para sumar: cartera es un saldo.
@Entity('kpi_ventas_corte')
export class KpiVentasCorte {
  @PrimaryColumn({ name: 'id_empleado', type: 'int' }) idEmpleado!: number;
  @PrimaryColumn({ name: 'fecha_corte', type: 'date' }) fechaCorte!: string;
  @Column({ type: 'json' }) datos!: any;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}
