import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';

@Entity('vacaciones_periodos')
@Unique('uq_vacaciones_empleado_periodo', [
  'idEmpleado',
  'fechaInicio',
  'fechaFin',
])
export class VacacionesPeriodo {
  @PrimaryGeneratedColumn({ name: 'id_periodo' }) idPeriodo!: number;
  @Column({ name: 'id_empleado', type: 'int' }) idEmpleado!: number;
  @Column({ name: 'fecha_inicio', type: 'date' }) fechaInicio!: string;
  @Column({ name: 'fecha_fin', type: 'date' }) fechaFin!: string;
  @Column({
    name: 'dias_asignados',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  diasAsignados!: string;
  @Column({
    name: 'dias_utilizados_iniciales',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  diasUtilizadosIniciales!: string;
  @Column({ name: 'fecha_corte_inicial', type: 'date', nullable: true })
  fechaCorteInicial!: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) observaciones!:
    string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' }) updatedAt!: Date;
  @ManyToOne(() => Empleado, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'id_empleado' })
  empleado!: Empleado;
}
