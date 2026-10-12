import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn({
    name: 'id_notificacion',
  })
  idNotificacion!: number;

  @Column({
    name: 'id_usuario_destinatario',
    type: 'int',
  })
  idUsuarioDestinatario!: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  tipo!: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  titulo!: string;

  @Column({
    type: 'varchar',
    length: 500,
  })
  mensaje!: string;

  @Column({
    name: 'referencia_tipo',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenciaTipo!: string | null;

  @Column({
    name: 'referencia_id',
    type: 'int',
    nullable: true,
  })
  referenciaId!: number | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  leida!: boolean;

  @Column({
    name: 'fecha_lectura',
    type: 'datetime',
    nullable: true,
  })
  fechaLectura!: Date | null;

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
}