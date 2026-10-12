import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Usuario } from '../../user/entities/user.entity';

import { Expediente } from './expediente.entity';
import { TipoDocumentoExpediente } from './tipo-documento-expediente.entity';

@Entity('documentos_expediente')
export class DocumentoExpediente {
  @PrimaryGeneratedColumn({
    name: 'id_documento',
    type: 'int',
  })
  idDocumento!: number;

  @Column({
    name: 'id_expediente',
    type: 'int',
  })
  idExpediente!: number;

  @Column({
    name: 'id_tipo_documento',
    type: 'int',
  })
  idTipoDocumento!: number;

  @Column({
    name: 'nombre_original',
    type: 'varchar',
    length: 255,
  })
  nombreOriginal!: string;

  @Column({
    name: 'nombre_archivo',
    type: 'varchar',
    length: 255,
  })
  nombreArchivo!: string;

  @Column({
    name: 'ruta_archivo',
    type: 'varchar',
    length: 500,
  })
  rutaArchivo!: string;

  @Column({
    name: 'mime_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  mimeType!: string | null;

  @Column({
    name: 'tamano_bytes',
    type: 'bigint',
    nullable: true,
  })
  tamanoBytes!: string | null;

  @Column({
    name: 'fecha_documento',
    type: 'date',
    nullable: true,
  })
  fechaDocumento!: string | null;

  @Column({
    name: 'fecha_vencimiento',
    type: 'date',
    nullable: true,
  })
  fechaVencimiento!: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 20,
    default: 'VIGENTE',
  })
  estado!: string;

  @Column({
    name: 'observaciones',
    type: 'text',
    nullable: true,
  })
  observaciones!: string | null;

  @Column({
    name: 'id_usuario_carga',
    type: 'int',
    nullable: true,
  })
  idUsuarioCarga!: number | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  updatedAt!: Date;

  @ManyToOne(
    () => Expediente,
    (expediente) => expediente.documentos,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_expediente',
  })
  expediente!: Expediente;

  @ManyToOne(
    () => TipoDocumentoExpediente,
    (tipo) => tipo.documentos,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_tipo_documento',
  })
  tipoDocumento!: TipoDocumentoExpediente;

  @ManyToOne(
    () => Usuario,
    {
      nullable: true,
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_usuario_carga',
  })
  usuarioCarga?: Usuario | null;
}