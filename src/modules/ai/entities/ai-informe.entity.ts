import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_informes')
@Index('idx_ai_usuario_fecha', ['idUsuario', 'createdAt'])
export class AiInforme {
  @PrimaryGeneratedColumn({ name: 'id_informe' }) idInforme!: number;
  @Column({ name: 'id_usuario', type: 'int' }) idUsuario!: number;
  @Column({ length: 64 }) alcance!: string;
  @Column({ type: 'int' }) anio!: number;
  @Column({ type: 'int' }) mes!: number;
  @Column({ length: 15 }) origen!: 'CONSULTA' | 'AUTOMATICO';
  @Column({ length: 1500 }) pregunta!: string;
  @Column({ type: 'mediumtext' }) respuesta!: string;
  @Column({ name: 'puntos_clave', type: 'json', nullable: true }) puntosClave!: string[] | null;
  @Column({ type: 'json', nullable: true }) recomendaciones!: string[] | null;
  @Column({ type: 'json', nullable: true }) fuentes!: string[] | null;
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true }) deduplicacion!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
