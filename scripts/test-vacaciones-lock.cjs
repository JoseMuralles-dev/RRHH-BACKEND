// Integración no destructiva: únicamente SELECT FOR UPDATE y ROLLBACK.
// Verifica el mutex de empleado en MySQL; no simula una carrera completa de aprobación.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  Empleado,
} = require('../dist/modules/organization/empleados/entities/empleado.entity');
const path = require('node:path');
async function main() {
  const db = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [path.join(__dirname, '../dist/**/*.entity.js')],
    synchronize: false,
    logging: false,
  });
  await db.initialize();
  const a = db.createQueryRunner(),
    b = db.createQueryRunner();
  try {
    await a.connect();
    await b.connect();
    const empleado = await a.manager
      .getRepository(Empleado)
      .findOne({
        where: { isActive: true },
        select: { idEmpleado: true },
        order: { idEmpleado: 'ASC' },
      });
    assert.ok(
      empleado,
      'Se necesita al menos un empleado activo para la prueba de lectura',
    );
    await b.query('SET SESSION innodb_lock_wait_timeout = 1');
    await a.startTransaction('READ COMMITTED');
    await b.startTransaction('READ COMMITTED');
    const options = {
      where: { idEmpleado: empleado.idEmpleado },
      lock: { mode: 'pessimistic_write' },
    };
    await a.manager.getRepository(Empleado).findOne(options);
    await assert.rejects(
      b.manager.getRepository(Empleado).findOne(options),
      (e) => e.driverError?.code === 'ER_LOCK_WAIT_TIMEOUT',
    );
    await a.rollbackTransaction();
    assert.ok(await b.manager.getRepository(Empleado).findOne(options));
    console.log(
      'PASS: MySQL bloquea el segundo acceso al mismo empleado y lo permite tras ROLLBACK. Sin cambios de datos.',
    );
  } finally {
    if (a.isTransactionActive) await a.rollbackTransaction();
    if (b.isTransactionActive) await b.rollbackTransaction();
    await a.release();
    await b.release();
    await db.destroy();
  }
}
main().catch((e) => {
  console.error('FAIL:', e.code || e.message);
  process.exitCode = 1;
});
