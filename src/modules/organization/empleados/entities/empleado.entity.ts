import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { Puesto } from '../../puestos/entities/puesto.entity';
import { Usuario } from '../../../user/entities/user.entity';

@Entity('empleados')
export class Empleado {

  @PrimaryGeneratedColumn({
    name: 'id_empleado',
  })
  idEmpleado!: number;


  // =========================================================
  // RELACIÓN CON SAP
  // =========================================================

  @Column({
    name: 'codigo_sap_empleado',
    nullable: true,
    unique: true,
    type: 'int'
  })
  codigoSapEmpleado?: number | null;


  // =========================================================
  // FOREIGN KEYS
  // =========================================================

  @Column({
    name: 'id_puesto',
  })
  idPuesto!: number;

  @Column({
    name: 'id_jefe_directo',
    type: 'int',
    nullable: true,
  })
  idJefeDirecto?: number | null;


  // =========================================================
  // DATOS PERSONALES
  // =========================================================

  @Column({
    name: 'primer_nombre',
    length: 50,
  })
  primerNombre!: string;

  @Column({
    name: 'segundo_nombre',
    length: 50,
    type: 'varchar',
    nullable: true,
  })
  segundoNombre?: string | null;

  @Column({
    name: 'primer_apellido',
    length: 50,
  })
  primerApellido!: string;

  @Column({
    name: 'segundo_apellido',
    length: 50,
    type: 'varchar',
    nullable: true,
  })
  segundoApellido?: string | null;

  @Column({
    length: 13,
    unique: true,
  })
  dpi!: string;

  @Column({
    length: 20,
    unique: true,
  })
  igss!: string;

  @Column({
    name: 'fecha_nacimiento',
    type: 'date',
  })
  fechaNacimiento!: string;

  @Column({
    name: 'fecha_ingreso',
    type: 'date',
  })
  fechaIngreso!: string;

  @Column({
    name: 'sueldo_actual',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  sueldoActual!: string;

  @Column({
    length: 20,
    type: 'varchar',
    nullable: true,
  })
  telefono?: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  direccion?: string | null;


  // =========================================================
  // ESTADO
  // =========================================================

  @Column({
    name: 'is_active',
    default: true,
  })
  isActive!: boolean;


  // =========================================================
  // FECHAS DE CONTROL
  // =========================================================

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
   * Muchos empleados pueden pertenecer al mismo puesto.
   *
   * empleados.id_puesto -> puestos.id_puesto
   */
  @ManyToOne(
    () => Puesto,
    (puesto) => puesto.empleados,
    {
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_puesto',
  })
  puesto!: Puesto;


  /**
   * Relación autorreferenciada.
   *
   * Muchos empleados pueden tener al mismo jefe.
   */
  @ManyToOne(
    () => Empleado,
    (empleado) => empleado.subordinados,
    {
      nullable: true,
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'id_jefe_directo',
  })
  jefeDirecto?: Empleado | null;


  /**
   * Empleados que tienen a este empleado como jefe.
   *
   * Este lado no contiene la FK.
   */
  @OneToMany(
    () => Empleado,
    (empleado) => empleado.jefeDirecto,
  )
  subordinados?: Empleado[];


  /**
   * Relación inversa Usuario <-> Empleado.
   *
   * La FK id_empleado está almacenada en la tabla usuarios,
   * por lo que @JoinColumn NO debe colocarse aquí.
   */
  @OneToOne(
    () => Usuario,
    (usuario) => usuario.empleado,
  )
  usuario?: Usuario;
}