import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DocumentoExpediente } from './documento-expediente.entity';

@Entity('tipos_documento_expediente')
export class TipoDocumentoExpediente {
  @PrimaryGeneratedColumn({
    name: 'id_tipo_documento',
    type: 'int',
  })
  idTipoDocumento!: number;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  codigo!: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 100,
  })
  nombre!: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    name: 'es_obligatorio',
    type: 'boolean',
    default: false,
  })
  esObligatorio!: boolean;

  @Column({
    name: 'requiere_vencimiento',
    type: 'boolean',
    default: false,
  })
  requiereVencimiento!: boolean;

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

  @OneToMany(
    () => DocumentoExpediente,
    (documento) => documento.tipoDocumento,
  )
  documentos?: DocumentoExpediente[];
}