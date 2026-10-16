import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

class MetadataDataSource extends DataSource {
  validarEntidades() { return this.buildMetadatas(); }
}

describe('Metadatos MySQL de todas las entidades', () => {
  it('acepta los tipos y relaciones utilizados al arrancar, sin conectar a una base', async () => {
    const source = new MetadataDataSource({
      type: 'mysql', database: 'metadata_test',
      entities: [join(__dirname, '**', '*.entity.ts')], synchronize: false,
    });
    await source.validarEntidades();
    expect(source.entityMetadatas.length).toBeGreaterThan(20);
    const uso = source.entityMetadatas.find(e => e.tableName === 'uso_eventos')!;
    for (const nombre of ['ruta', 'evento_cliente']) {
      const columna = uso.columns.find(c => c.databaseName === nombre)!;
      expect(columna.type).toBe('varchar');
      expect(columna.isNullable).toBe(true);
    }
  });
});
