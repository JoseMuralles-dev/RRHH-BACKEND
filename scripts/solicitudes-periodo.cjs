// Run once per database: node scripts/solicitudes-periodo.cjs
// Does not insert catalog types or modify request data.
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const env = { ...require('dotenv').parse(fs.readFileSync('.env')), ...process.env };
(async () => {
  const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    const [columns] = await db.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_incidencia' AND COLUMN_NAME = 'requiere_periodo'");
    if (!columns.length) {
      // Preserve the previous period requirement for any existing catalog entries.
      await db.execute('ALTER TABLE tipos_incidencia ADD COLUMN requiere_periodo TINYINT(1) NOT NULL DEFAULT 1');
    }
    await db.execute('ALTER TABLE tipos_incidencia ALTER COLUMN requiere_periodo SET DEFAULT 0');
    await db.execute('ALTER TABLE solicitudes_incidencia MODIFY fecha_inicio DATE NULL, MODIFY fecha_fin DATE NULL, MODIFY dias_solicitados DECIMAL(5,1) NULL');
    console.log('Schema ready: per-type period requirement and nullable request period.');
  } finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
