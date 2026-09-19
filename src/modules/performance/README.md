# Trazabilidad de artículos de bodega

`BOD_ARTICULOS` suma `TotalArticulos` (FACTURAS) y
`TotalArticulosTraslados` (TRASLADOS) de SAP. Los otros KPI conservan su regla.
El registro de `metricas_kpi_diarias` conserva el total del día y sus dos
componentes en `desglose_origen`; `fuente` sigue indicando SAP.

En la evaluación mensual se suman los componentes por origen y se guardan
dos filas en `detalle_resultado_kpi`, vinculadas al `id_resultado` devuelto
al guardar el resultado. No se copian filas diarias a esta tabla.
Los detalles administrados por el ETL se reemplazan en cada evaluación,
dentro de la misma transacción que el resultado. Sus valores suman
exactamente el valor mensual utilizado para buscar el rango y puntuar.

## Instalación y datos históricos

Aplicar una vez `scripts/sql/20260918-desglose-origen-metricas-diarias.sql`
antes de iniciar esta versión en otra base de datos. `synchronize` permanece
desactivado. La columna es nullable y no modifica valores históricos.

Para recuperar un mes existente:

1. Ejecutar `POST /performance/etl/bodega` con `{"fecha":"YYYY-MM-DD"}`
   para cada día del mes, recuperando los componentes reales de SAP.
2. Ejecutar `POST /performance/evaluaciones/mensual` con departamento, año y mes.
3. Verificar `detalleEstado: COMPLETO` en BOD_ARTICULOS y comparar los detalles.

Si falta el desglose en algún registro del mes, la evaluación conserva el
cálculo sobre los valores disponibles y devuelve
`detalleEstado: REQUIERE_REPROCESAR_ETL`. No fabrica componentes históricos
ni presenta un desglose parcial. Los KPI sin detalle devuelven `NO_APLICA`.
Esto no comprueba que se hayan cargado todos los días del mes.

```sql
SELECT r.id_resultado, r.valor_obtenido, d.origen, d.valor, d.descripcion
FROM resultados_kpi r
JOIN detalle_resultado_kpi d ON d.id_resultado = r.id_resultado
JOIN evaluaciones_desempeno e
  ON e.id_evaluacion_desempeno = r.id_evaluacion_desempeno
WHERE e.id_departamento = 3 AND e.periodo_anio = 2026 AND e.periodo_mes = 8
ORDER BY r.id_resultado, d.origen;
```
