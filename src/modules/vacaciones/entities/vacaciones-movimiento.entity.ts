import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { SolicitudIncidencia } from '../../solicitudes/entities/solicitud-incidencia.entity';
import { VacacionesPeriodo } from './vacaciones-periodo.entity';
export enum TipoMovimientoVacaciones {
  CONSUMO = 'CONSUMO',
  DEVOLUCION = 'DEVOLUCION',
  AJUSTE_POSITIVO = 'AJUSTE_POSITIVO',
  AJUSTE_NEGATIVO = 'AJUSTE_NEGATIVO',
}
@Entity('vacaciones_movimientos')
@Unique('uq_vacaciones_movimiento_solicitud', [
  'idPeriodo',
  'idSolicitud',
  'tipoMovimiento',
])
export class VacacionesMovimiento {
  @PrimaryGeneratedColumn({ name: 'id_movimiento' }) idMovimiento!: number;
  @Column({ name: 'id_periodo', type: 'int' }) idPeriodo!: number;
  @Column({ name: 'id_solicitud', type: 'int', nullable: true }) idSolicitud!:
    number | null;
  @Column({ name: 'tipo_movimiento', type: 'varchar', length: 20 })
  tipoMovimiento!: TipoMovimientoVacaciones;
  @Column({ type: 'decimal', precision: 6, scale: 2 }) dias!: string;
  @Column({ type: 'varchar', length: 500 }) motivo!: string;
  @Column({ name: 'id_empleado_registro', type: 'int' })
  idEmpleadoRegistro!: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt!: Date;
  @ManyToOne(() => VacacionesPeriodo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'id_periodo' })
  periodo!: VacacionesPeriodo;
  @ManyToOne(() => SolicitudIncidencia, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud!: SolicitudIncidencia | null;
  @ManyToOne(() => Empleado, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'id_empleado_registro' })
  empleadoRegistro!: Empleado;
}
