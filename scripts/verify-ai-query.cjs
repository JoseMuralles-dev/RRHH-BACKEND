// Ejecutar despues de npm run build. No abre conexiones ni modifica MySQL.
// Usa JS compilado para conservar metadata de enums que ts-jest isolatedModules pierde.
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { DataSource } = require('typeorm');
const {
  Empleado,
} = require('../dist/modules/organization/empleados/entities/empleado.entity');
const {
  MetricaKpi,
} = require('../dist/modules/performance/entities/metrica-kpi.entity');
const {
  MetricaKpiDiaria,
} = require('../dist/modules/performance/entities/metrica-kpi-diaria.entity');
const {
  AiContextService,
} = require('../dist/modules/ai/services/ai-context.service');
const {
  AiToolsService,
} = require('../dist/modules/ai/services/ai-tools.service');

async function verificar() {
  const source = new DataSource({
    type: 'mysql',
    database: 'solo_pruebas',
    synchronize: false,
    entities: [
      resolve(__dirname, '../dist/**/*.entity.js').replace(/\\/g, '/'),
    ],
  });
  await source.buildMetadatas();
  const empleados = source.getRepository(Empleado);
  const metricas = source.getRepository(MetricaKpi);
  const diarias = source.getRepository(MetricaKpiDiaria);
  const query = diarias.createQueryBuilder('diaria');
  empleados.findOne = async () => ({ idEmpleado: 10 });
  empleados.find = async () => [{ idEmpleado: 21 }];
  diarias.createQueryBuilder = () => query;
  query.getRawMany = async () => [];
  const service = new AiToolsService(
    empleados,
    diarias,
    metricas,
    new AiContextService(empleados, metricas),
  );
  await service.obtenerResumenEquipo(
    { idEncargado: 10, anio: 2026, mes: 9 },
    { idUsuario: 1, idEmpleado: null, nivelJerarquico: 3 },
  );
  const [sql, parametros] = query.getQueryAndParameters();
  for (const fragmento of [
    'SUM(`diaria`.`valor`)',
    'AVG(`diaria`.`valor`)',
    'MIN(`diaria`.`valor`)',
    'MAX(`diaria`.`valor`)',
    'COUNT(DISTINCT `diaria`.`fecha`)',
    '`diaria`.`id_empleado` IN (?)',
    'GROUP BY `diaria`.`id_empleado`, `diaria`.`id_metrica`, DATE_FORMAT(`diaria`.`fecha`,',
  ])
    assert.ok(sql.includes(fragmento), fragmento);
  assert.deepEqual(parametros, [21, '2026-09-01', '2026-09-30']);
  assert.ok(!sql.includes('desglose_origen'));
  console.log(
    'Metadata MySQL y SQL agregado de IA verificados (sin conexion).',
  );
}

verificar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
