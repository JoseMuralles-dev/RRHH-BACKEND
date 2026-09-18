import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SolicitudIncidencia } from './solicitud-incidencia.entity';

@Entity('tipos_incidencia')
export class TipoIncidencia {

  @PrimaryGeneratedColumn({
    name: 'id_tipo_incidencia',
  })
  idTipoIncidencia!: number;

  @Column({ name: 'nombre_tipo', type: 'varchar', length: 50 })
  nombre!: string;

  @Column({ name: 'requiere_periodo', type: 'boolean', default: false })
  requierePeriodo!: boolean;

  @Column({ name: 'es_remunerado', type: 'boolean', default: false })
  esRemunerado!: boolean;

  @Column({ name: 'descuenta_vacaciones', type: 'boolean', default: false })
  descuentaVacaciones!: boolean;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;

  @OneToMany(
    () => SolicitudIncidencia,
    solicitud => solicitud.tipoIncidencia,
  )
  solicitudes?: SolicitudIncidencia[];
}