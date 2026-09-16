import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Usuario } from '../../user/entities/user.entity';

@Entity('roles') // Mapea a la tabla 'roles' en MySQL
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  idRol: number | undefined;

  @Column({ name: 'codigo_rol', type: 'varchar', unique: true, length: 20 })
  codigoRol: string | undefined; // 'ADMIN', 'RRHH', 'JEFE_AREA', 'EMPLEADO'

  @Column({ name: 'nombre_rol', type: 'varchar', length: 50 })
  nombreRol: string | undefined;

  @Column({ name: 'nivel_jerarquico', type: 'int' })
  nivelJerarquico: number | undefined; // 4, 3, 2, 1 (usado por los Guards de NestJS)

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | undefined;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean | undefined;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date | undefined;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date | undefined;

  // --- RELACIÓN INVERSA (1 Rol tiene Muchos Usuarios) ---
  @OneToMany(() => Usuario, (usuario) => usuario.rol)
  usuarios: Usuario[] | undefined;
}