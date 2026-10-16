import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('uso_eventos')
@Index('idx_uso_fecha', ['fechaUtc'])
@Index('idx_uso_modulo_fecha', ['modulo', 'fechaUtc'])
@Index('idx_uso_usuario_fecha', ['idUsuario', 'fechaUtc'])
@Index('uq_uso_evento_cliente', ['idUsuario', 'eventoCliente'], { unique: true })
export class UsoEvento {
  @PrimaryGeneratedColumn({ name: 'id_evento', type: 'bigint' }) idEvento!: string;
  @Column({ name: 'id_usuario', type: 'int' }) idUsuario!: number;
  @Column({ name: 'nivel_rol', type: 'tinyint', nullable: true }) nivelRol!: number | null;
  @Column({ length: 30 }) modulo!: string;
  @Column({ length: 40 }) accion!: string;
  @Column({ length: 12 }) origen!: 'API' | 'NAVEGACION';
  @Column({ length: 10 }) metodo!: string;
  @Column({ length: 180, nullable: true }) ruta!: string | null;
  @Column({ name: 'estado_http', type: 'smallint' }) estadoHttp!: number;
  @Column({ name: 'exito', type: 'boolean' }) exito!: boolean;
  @Column({ name: 'duracion_ms', type: 'int', unsigned: true }) duracionMs!: number;
  @Column({ name: 'evento_cliente', length: 36, nullable: true }) eventoCliente!: string | null;
  @Column({ name: 'fecha_utc', type: 'datetime', precision: 3 }) fechaUtc!: string;
}
