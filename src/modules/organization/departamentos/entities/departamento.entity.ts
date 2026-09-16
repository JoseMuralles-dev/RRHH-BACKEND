import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Puesto } from '../../puestos/entities/puesto.entity';

@Entity('departamentos')
export class Departamento {

  @PrimaryGeneratedColumn({
    name: 'id_departamento',
  })
  idDepartamento!: number;

  @Column({
    name: 'nombre_departamento',
    length: 100,
    unique: true,
  })
  nombreDepartamento!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion?: string | null;

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

  /**
   * Un departamento puede tener muchos puestos.
   *
   * La llave foránea está en:
   * puestos.id_departamento
   *
   * Por eso Departamento es el lado inverso
   * de la relación y no utiliza @JoinColumn().
   */
  @OneToMany(
    () => Puesto,
    (puesto) => puesto.departamento,
  )
  puestos?: Puesto[];
}