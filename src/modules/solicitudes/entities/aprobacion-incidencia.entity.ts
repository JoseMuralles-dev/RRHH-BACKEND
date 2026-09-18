import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SolicitudIncidencia } from './solicitud-incidencia.entity';
import { Usuario } from '../../user/entities/user.entity';
import { EstadoAprobacion } from '../enums/estado-aprobacion.enum';

@Entity('aprobaciones_incidencia')
export class AprobacionIncidencia {

  @PrimaryGeneratedColumn({
    name: 'id_aprobacion',
  })
  idAprobacion!: number;


  @Column({
    name: 'id_solicitud',
    type: 'int',
  })
  idSolicitud!: number;


  @Column({
    name: 'id_usuario_aprobador',
    type: 'int',
  })
  idUsuarioAprobador!: number;


  @Column({
    name: 'nivel_aprobacion',
    type: 'int',
  })
  nivelAprobacion!: number;


  @Column({
    name: 'estado_aprobacion',
    type: 'varchar',
    length: 20,
    default: EstadoAprobacion.PENDIENTE,
  })
  estado!: EstadoAprobacion;


  @Column({
    type: 'text',
    nullable: true,
  })
  comentario?: string | null;


  @Column({
    name: 'fecha_respuesta',
    type: 'timestamp',
    nullable: true,
  })
  fechaRespuesta?: Date | null;


  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;


  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;


  @ManyToOne(
    () => SolicitudIncidencia,
    solicitud => solicitud.aprobaciones,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_solicitud',
  })
  solicitud!: SolicitudIncidencia;


  @ManyToOne(
    () => Usuario,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_usuario_aprobador',
  })
  usuarioAprobador!: Usuario;
}