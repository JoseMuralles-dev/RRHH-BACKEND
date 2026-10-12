import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('inspecciones_cinco_s')
@Unique('uq_cinco_s_periodo_numero', ['idDepartamento', 'anio', 'mes', 'numero'])
export class InspeccionCincoS {
  @PrimaryGeneratedColumn({ name: 'id_inspeccion' }) idInspeccion!: number;
  @Column({ name: 'id_departamento', type: 'int' }) idDepartamento!: number;
  @Column({ type: 'int' }) anio!: number;
  @Column({ type: 'int' }) mes!: number;
  @Column({ type: 'int' }) numero!: number;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ type: 'varchar', length: 100 }) sucursal!: string;
  @Column({ type: 'varchar', length: 150 }) encargado!: string;
  @Column({ name: 'id_usuario_inspector', type: 'int' }) idUsuarioInspector!: number;
  @Column({ type: 'varchar', length: 255 }) inspector!: string;
  @Column({ name: 'version_formato', type: 'int', default: 1 }) versionFormato!: number;
  @Column({ type: 'json' }) puntos!: number[];
  @Column({ type: 'int' }) total!: number;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
