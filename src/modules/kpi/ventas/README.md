# KPI de Ventas

## Arquitectura y alcance

Backend NestJS/TypeORM/MySQL; no frontend. KpiModule publica las rutas, VentasService
coordina permisos, SAP y persistencia; performance/services/ventas-calculo.ts amplia
el calculo departamental con la politica porcentual existente (aporte limitado a su
peso, cumplimiento 0..100). No cambia formulas ni pesos BOD_ ni 5S.

Se reutilizan metricas_kpi, rangos_kpi, metricas_kpi_diarias,
evaluaciones_desempeno, resultados_kpi y detalle_resultado_kpi. El evaluador diario
generico rechaza VEN_ para no crear una nota con solo nuevos clientes y omitir SAP.
GET consulta y calcula sin escribir. POST evaluaciones guarda exclusivamente resultados
completos. Un resultado incompleto tiene notaFinal:null y no reemplaza una evaluacion
previa. Para consultar pendientes use estas rutas de Ventas; el dashboard generico
solo expone evaluaciones guardadas. No hay cron de Ventas ni cierre automatico.

La persistencia mantiene nombres legacy puntos_obtenidos/puntaje_base: representan
aportes porcentuales, no un incentivo. meta_global permanece 100; las metas monetarias
se copian a meta_aplicada. Sin meta monetaria no se crea un valor ficticio.

## Configuracion comercial

| Codigo | Peso | Meta/regla |
|---|---:|---|
| VEN_META_MENSUAL | 35 | Meta monetaria individual del mes |
| VEN_META_ACUMULADA | 15 | Suma de metas de enero al mes; exige todos los meses |
| VEN_NUEVOS_CLIENTES | 10 | Total diario declarado; meta de catalogo, predeterminada 4 |
| VEN_NOTAS_CREDITO | 5 | Referencia 0.45%; escala pendiente |
| VEN_CARTERA_SANA | 35 | Porcentaje de cartera 0..59 dias; escala pendiente |

El 5% de incentivo sobre excedente y mezcla de productos estan excluidos.
No se redistribuyen los pesos pendientes. Sin regla no se asigna cero.
NC y cartera usan rangos_kpi activos de su metrica. Los limites son inclusivos sobre
el valor porcentual medido (0.45 representa 0.45%, no 45%). Debe coincidir exactamente
una banda; huecos/solapamientos devuelven REGLA_PENDIENTE. puntos_otorgados es el
aporte final de esa banda (0..5 NC, 0..35 cartera); porcentaje_cumplimiento 0..100.
El script NO crea bandas: RRHH debe aprobarlas y cargarlas mediante administracion
existente/SQL revisado. No se agrega una API generica para editar reglas en esta entrega.
Los textos SUMA/RANGOS en tipo_calculo son varchar; no existe enum operativo de
validacion en el motor actual. Fuente MANUAL/SAP coincide con FuenteMetrica.

## SAP: requisito previo

El repositorio no contiene dbo.usp_RRHH_KpiVentas. Debe estar instalado por el
responsable de SAP y ser ejecutable por la cuenta existente. No instalar desde la app.
SapService reutiliza getConnection y SAP_DB_*; no hay conexion/configuracion alternativa.
Parametros tipados: FechaInicio DATE, FechaFin DATE, SlpCode INT nullable. El dashboard
consulta una vez por periodo/equipo, con SlpCode=null, y solo devuelve filas autorizadas.
Contrato: slpCode, vendedor, fechaInicio, fechaFin, facturacionPeriodoConIVA,
notasCreditoPeriodoConIVA, ventasNetasPeriodoConIVA, ventasNetasAcumuladasConIVA,
porcentajeNotasCredito, carteraDeudora, saldosAFavor, saldoNeto, carteraMenor60,
cartera60OMas, porcentajeCarteraMenor60.

El acumulado SAP debe comprender enero hasta FechaFin del mismo anio. Importes con IVA:
no sumar VatSum. Neto mensual = facturacion - NC, conservando signos de cancelatorios.
Los porcentajes se derivan de importes con aritmetica decimal fija BigInt, seis decimales
internos; importes/porcentajes de SAP deben ser numeros decimales finitos o cadenas
canonicas (sin separadores de miles, maximo seis decimales). Para montos que excedan la
precision segura del driver JS, el procedimiento debe entregarlos como texto decimal:
la app no puede recuperar precision ya perdida en el driver. Se conserva el payload SAP
en el snapshot. Las bandas se comparan antes del redondeo de presentacion; valores
medidos se guardan con seis decimales. Aportes finales y notas guardadas: dos decimales.

Criterios devueltos en cada respuesta:
- RefDate, no DueDate, para antiguedad; menor a 60 = 0..59.
- Cartera deudora positiva separada de saldos a favor.
- Cartera historica no certificada: conciliaciones anuladas posteriormente pendientes
  de validacion. No presentar ese componente historico como exacto.
- Nuevos clientes son cantidades declaradas; no se verifica identidad/unicidad.
- Sin facturacion positiva o sin cartera deudora positiva: SIN_DENOMINADOR, valor null.
- Error SAP: HTTP 503 SAP_NO_DISPONIBLE, nunca ventas cero.

## Identidad y autorizacion

Bearer JWT en todas las rutas. Se carga usuario activo y rol activo desde MySQL usando
el idUsuario autenticado. El departamento de Ventas es exclusivamente el ID 2, confirmado por el responsable.
Las cinco metricas VEN_ deben estar configuradas en ese departamento activo.
No se comparan nombres de departamento, puesto, empleado ni vendedor para relacionar.

Solo empleados activos cuyo puesto pertenece al departamento 2; codigo_sap_empleado = OSLP.SlpCode.
No OHEM, no nombre. null/vacio/invalido: CODIGO_SAP_INVALIDO. Duplicados activos de
Ventas: CONFLICTO_CODIGO_SAP (tambien si el otro vendedor no pertenece al equipo del
encargado). Sin fila SAP: SIN_CORRESPONDENCIA, no cero. Una fila SAP repetida tambien
es conflicto. Bodega usa OHEM como antes, ahora acotado al departamento de metricas BOD_.

- Empleado: GET propio y sus metas, sin escritura.
- Encargado: equipo directo; consulta propia si pertenece a Ventas; captura y guarda
  evaluaciones de subordinados. No configura metas monetarias.
- RRHH/admin: empleados activos de Ventas; configura metas y captura.
- idEmpleado de query/body nunca sustituye autorizacion.

## Rutas y ejemplos

Prefijo global de despliegue: /api. Ejemplos requieren Authorization: Bearer <JWT>.

GET /api/kpi/ventas/mi-dashboard?anio=2026&mes=9
GET /api/kpi/ventas/equipo?anio=2026&mes=9
GET /api/kpi/ventas/metas?idEmpleado=21&anio=2026&mes=9
Devuelve las metas desde enero hasta el mes consultado. Sin idEmpleado usa el propio.

PUT /api/kpi/ventas/metas
Content-Type: application/json
{ "idEmpleado": 21, "anio": 2026, "mes": 9, "metaObjetivo": "50000.00" }
El monto es solo un ejemplo de formato; usar la meta real aprobada. Se guarda sobre
VEN_META_MENSUAL; el acumulado se deriva, no se ingresa por separado. Meta positiva,
maximo 12 enteros y 2 decimales. Permite planificar metas futuras.

PUT /api/kpi/ventas/nuevos-clientes
{ "idEmpleado": 21, "fecha": "2026-10-15", "cantidad": 2 }
Repetir la peticion conserva 2, no lo convierte en 4. Cantidad entera 0..1000000.
Fecha real no futura. Se audita anterior/nuevo y actor en la misma transaccion.

POST /api/kpi/ventas/evaluaciones
{ "idEmpleado": 21, "anio": 2026, "mes": 9 }
Reutiliza evaluacion/resultado existente; recalcula solo BORRADOR/CALCULADA, no duplica
resultados. Si falta algo: guardado:false, sin escrituras en evaluaciones/resultados.
Si completo: guardado:true, idEvaluacion, y dashboard. El mes actual sigue provisional.

Forma ilustrativa de resultado pendiente (los importes son ejemplos, no datos SAP):
{
  "periodo": { "anio": 2026, "mes": 9, "fechaInicio": "2026-09-01", "fechaFin": "2026-09-30", "provisional": false },
  "criterios": ["..."],
  "empleados": [{ "idEmpleado": 21, "estado": "INCOMPLETA", "notaFinal": null,
    "resultados": [{ "codigo": "VEN_NOTAS_CREDITO", "pesoPorcentaje": 5,
      "valorObtenido": "0.450000", "metaAplicada": "0.45", "estado": "REGLA_PENDIENTE", "puntos": null }]
  }]
}
La respuesta real contiene los cinco resultados y los datos SAP del vendedor autorizado.
Otros estados: SIN_META, META_INCOMPLETA con mesesFaltantes, SIN_DENOMINADOR,
CONFLICTO_REGISTROS_DIARIOS y CERRADA_SIN_SNAPSHOT. Errores de configuracion/periodo
cerrado: 409; alcance: 403; periodo futuro o datos invalidos: 400.

## Historia, cierre y concurrencia

KPI_TIME_ZONE=America/Guatemala es el valor por defecto (opcional en .env).
Mes actual hasta hoy local; anterior hasta ultimo dia; futuro no se evalua.
Se bloquea la fila empleado durante escritura. Se rechaza modificar un periodo con
estado distinto de BORRADOR/CALCULADA; cambiar una meta mensual tambien se rechaza
si afectaria un acumulado cerrado posterior en el mismo anio.

kpi_ventas_snapshot conserva datos SAP, metas, pesos, bandas y resultado de cada
evaluacion guardada. Una evaluacion cerrada se lee de ese snapshot sin consultar SAP.
Cerradas antiguas sin snapshot se informan explicitamente; no se reconstruyen con reglas
actuales. Observacion de resultados guarda version/peso/regla para el dashboard generico,
que usa el aporte persistido VEN_ en lugar de recalcularlo con una formula proporcional.
Detalle_resultado_kpi es resumen con precision legacy; snapshot/resultado son la fuente
precisa. Cambiar configuracion no modifica una evaluacion cerrada automaticamente.

No habia una tabla equivalente de metas ni auditoria generica de KPI en el repositorio.
Se crean metas_kpi_empleado, kpi_cambios (append-only) y kpi_ventas_snapshot. Nuevos clientes
reutiliza metricas_kpi_diarias con fuente MANUAL y su unicidad empleado/metrica/fecha.
No hay consolidacion ni borrado automatico de duplicados heredados. Las escrituras
nuevas son transaccionales; las validaciones del codigo SAP por departamento se hacen
en la aplicacion y el dashboard detecta conflictos, incluso si otro proceso inserta datos.

## Instalacion revisable, no ejecutada por el agente

1. Respaldar MySQL y probar primero en una copia. Revisar SHOW CREATE TABLE de empleados,
   metricas_kpi_diarias, resultados_kpi, rangos_kpi y tablas nuevas si ya existen.
2. Revisar scripts/sql/20261015-kpi-ventas.sql y verificar que el departamento 2 este activo. Inventariar cualquier metrica de mezcla; el script desactiva VEN_MEZCLA
   y VEN_MEZCLA_PRODUCTOS sin borrar historia. Si tiene otro codigo, desactivarlo explicitamente.
3. Coordinar ventana de mantenimiento: detener tareas ETL/escrituras, aplicar el script
   y poner esta version del backend antes de admitir codigos repetidos entre departamentos.
   El backend viejo de Bodega no tiene el filtro nuevo y podria relacionar otro empleado.
4. Desde la terminal MySQL (password interactivo, nunca incluirlo en comandos):

   mysql -h HOST_MYSQL -u USUARIO_MYSQL -p BASE_RRHH
   SOURCE /var/www/rrhh-backend/scripts/sql/20261015-kpi-ventas.sql;

   No usar --force. El procedimiento aborta ante duplicados o catalogo inconsistente.
   Los ALTER TABLE tienen commit implicito: la migracion no es atomicamente reversible;
   revisar el error antes de reintentar. CREATE IF NOT EXISTS no sustituye comparar esquemas.
5. Instalar dependencias del proyecto y compilar con Node 20.19+ o 22.12+:

   npm ci --include=dev
   npm run build
   npm test -- --runInBand src/modules/performance src/modules/kpi src/modules/integrations/sap

6. Responsable SAP verifica instalacion/contrato/permisos EXECUTE del procedimiento.
   Usar las variables SAP_DB_* existentes; no hay secretos nuevos. Mantener synchronize:false.
7. Configurar metas reales enero..mes y aprobar bandas NC/cartera antes de publicar nota.
   Probar HTTP autenticado en entorno de pruebas con datos reales antes de produccion.

La migracion quita el indice UNIQUE global de codigo_sap_empleado (lo descubre por
columnas, no nombre inventado), valida duplicados por departamento, asegura unicidad
existente de diarios sin consolidarlos, y amplia solo precision de valores/rangos.
No convierte ni renumera codigos existentes. Verificar que Ventas contenga SlpCode real.
No se ejecutaron migraciones, consultas SAP reales ni despliegues durante implementacion.

Integracion frontend: GET /api/kpi/ventas/empleados devuelve idEmpleado/nombre dentro del alcance sin depender de SAP. GET /api/kpi/ventas/nuevos-clientes?idEmpleado=21&fecha=2026-10-15 consulta el total diario (cantidad:null si no existe registro), con la misma autorizacion. El frontend usa estas rutas antes de editar y no requiere acceso a SAP para guardar entradas.
