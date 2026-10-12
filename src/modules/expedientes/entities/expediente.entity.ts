import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { DocumentoExpediente } from './documento-expediente.entity';

@Entity('expedientes')
export class Expediente {
  @PrimaryGeneratedColumn({
    name: 'id_expediente',
    type: 'int',
  })
  idExpediente!: number;

  @Column({
    name: 'id_empleado',
    type: 'int',
    unique: true,
  })
  idEmpleado!: number;

  @Column({
    name: 'fecha_apertura',
    type: 'date',
  })
  fechaApertura!: string;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 20,
    default: 'ACTIVO',
  })
  estado!: string;

  @Column({
    name: 'observaciones',
    type: 'text',
    nullable: true,
  })
  observaciones!: string | null;

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

  @OneToOne(() => Empleado, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'id_empleado',
  })
  empleado!: Empleado;

  @OneToMany(
    () => DocumentoExpediente,
    (documento) => documento.expediente,
  )
  documentos?: DocumentoExpediente[];
}