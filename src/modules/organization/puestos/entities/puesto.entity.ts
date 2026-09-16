import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { Departamento } from '../../departamentos/entities/departamento.entity';
import { Empleado } from '../../empleados/entities/empleado.entity';

@Entity('puestos')
export class Puesto {

  @PrimaryGeneratedColumn({
    name: 'id_puesto',
  })
  idPuesto!: number;

  @Column({
    name: 'id_departamento',
  })
  idDepartamento!: number;

  @Column({
    name: 'nombre_puesto',
    length: 100,
  })
  nombrePuesto!: string;

  @Column({
    name: 'salario_base',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  salarioBase!: string;

  @Column({
    name: 'is_active',
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

  // =========================================================
  // RELACIONES
  // =========================================================

  @ManyToOne(
    () => Departamento,
    (departamento) => departamento.puestos,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_departamento',
  })
  departamento!: Departamento;

  @OneToMany(
    () => Empleado,
    (empleado) => empleado.puesto,
  )
  empleados?: Empleado[];
}