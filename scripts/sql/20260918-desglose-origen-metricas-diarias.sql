-- Ejecutar una vez antes de iniciar la versión con desglose por origen.
-- NULL indica un registro histórico que todavía no se ha reprocesado desde SAP.
/* ALTER TABLE metricas_kpi_diarias
  ADD COLUMN desglose_origen JSON NULL;
*/