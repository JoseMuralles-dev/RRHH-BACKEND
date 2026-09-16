import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { Rol } from '../../roles/entities/rol.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { EstadoUsuario } from '../estado-usuario.enum';

@Entity('usuarios')
export class Usuario {

  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  idUsuario!: number;

  @Column({
    name: 'id_empleado',
    unique: true,
    nullable: true,
  })
  idEmpleado?: number | null;

  @Column({ name: 'id_rol' })
  idRol!: number;

  @Column({
    unique: true,
    length: 150,
  })
  correo!: string;

  @Column({
    name: 'password_hash',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({
    length: 20,
    default: EstadoUsuario.ACTIVO,
  })
  estado!: EstadoUsuario;

  @Column({
    name: 'is_active',
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(
    () => Rol,
    (rol) => rol.usuarios,
    {
      eager: true,
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'id_rol' })
  rol!: Rol;

  @OneToOne(
    () => Empleado,
    (empleado) => empleado.usuario,
    {
      nullable: true,
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'id_empleado' })
  empleado?: Empleado | null;
}