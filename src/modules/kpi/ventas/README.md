# KPI de Ventas

El modulo consulta SAP por SlpCode y lo relaciona exclusivamente con empleados
activos cuyo puesto pertenece al departamento 2. No compara nombres ni puestos.
Los duplicados dentro de Ventas se reportan como conflicto. Bodega tambien detecta
coincidencias multiples antes de escribir; usa su propio departamento y OHEM.empID.

## Calculo y reglas

- Meta mensual: 35%; meta individual monetaria del mes.
- Meta acumulada: 15%; exige metas de enero al mes evaluado.
- Nuevos clientes: 10%; registro manual diario reemplazable; meta de catalogo 4.
- Notas de credito: 5%; hasta 0.45% inclusive recibe 100% de cumplimiento;
  sobre el limite recibe 0%. La comparacion es racional, anterior al redondeo.
  Facturacion cero/negativa deja pendiente; NC negativas requieren revision.
- Cartera: 35%; porcentaje de cartera deudora positiva de 0 a 59 dias desde
  contabilizacion, segun el procedimiento SAP. Aporte proporcional, maximo 35%.
  Sin cartera deudora positiva queda pendiente, sin asumir cumplimiento.

kpi_ventas_reglas configura NC y cartera con version y JSON. Cambios posteriores
requieren incrementar version. La migracion inicial no reemplaza reglas existentes.
El calculador usa codigo_kpi; FORMULA/origen_datos se conservan como metadatos.
Sin datos/metas/reglas validas, notaFinal es null. No se redistribuyen ponderaciones.
Los campos legacy puntos representan aportes porcentuales. Los valores se guardan
con seis decimales y notas oficiales con dos, conforme a las columnas existentes.

## Actualizacion y almacenamiento

La tarea diaria guarda kpi_ventas_corte por empleado/fecha y actualiza
kpi_ventas_avance por empleado/anio/mes. Cada corte contiene acumulados, NO se deben
sumar entre dias. Repetir una fecha reemplaza su foto. Reprocesar un corte antiguo
no retrocede el avance mensual. Una consulta SAP atiende todo Ventas por corte.
Nuevos clientes se mantienen en metricas_kpi_diarias, sin insertar ventas acumuladas
como si fueran movimientos diarios. Errores SAP conservan el ultimo avance.

Solo resultados completos se guardan en evaluaciones_desempeno, resultados_kpi,
detalle_resultado_kpi y kpi_ventas_snapshot. Se actualizan IDs existentes. Si un
resultado abierto deja de ser valido, se desactiva su evaluacion y se conserva el
avance incompleto. Periodos revisados/cerrados nunca se sobrescriben.
El snapshot conserva datos, metas, reglas/version y resultados. Al cerrar se sigue
leyendo ese snapshot, sin aplicar cambios futuros de reglas.

GET mi-dashboard/equipo lee el avance guardado, incluyendo fechaCorte,
actualizadoEn y desactualizado. No requiere SAP para consultar. Los cambios manuales
de metas/clientes se reflejan en la proxima actualizacion; las rutas en-vivo permiten
consultar antes sin guardar. Un periodo no cargado responde SIN_ACTUALIZAR.

## Rutas (prefijo /api)

- GET /kpi/ventas/mi-dashboard?anio=2026&mes=10
- GET /kpi/ventas/equipo?anio=2026&mes=10&idEmpleado=21 (filtro opcional)
- GET /kpi/ventas/mi-dashboard-en-vivo?anio=2026&mes=10
- GET /kpi/ventas/equipo-en-vivo?anio=2026&mes=10
- POST /kpi/ventas/actualizar con {"fechaCorte":"2026-10-15"}: RRHH/admin.
- POST /kpi/ventas/evaluaciones con {"idEmpleado":21,"anio":2026,"mes":10}
- GET /kpi/ventas/empleados
- GET /kpi/ventas/metas?anio=2026&mes=10&idEmpleado=21
- PUT /kpi/ventas/metas con {"idEmpleado":21,"anio":2026,"mes":10,"metaObjetivo":"25000"}
- GET /kpi/ventas/nuevos-clientes?idEmpleado=21&fecha=2026-10-15
- PUT /kpi/ventas/nuevos-clientes con {"idEmpleado":21,"fecha":"2026-10-15","cantidad":2}

Todas requieren JWT. Empleado consulta solo sus resultados; encargado su equipo;
RRHH/admin todo Ventas. Solo RRHH/admin cambian metas o ejecutan carga global.
El servicio vuelve a comprobar actor activo/rol/alcance en base de datos.
La tarea usa el mismo servicio y bloqueo MySQL que el endpoint de actualizacion.
Bloqueos por empleado serializan escritura manual y evaluacion.

## Instalacion en el VPS

1. Respaldar y probar scripts/sql/20261015-kpi-ventas.sql en una copia. Es el unico
   script de esta entrega: verificaciones, DDL separado, configuracion y consultas.
   La base revisada es intertornillos_rrhh_1, en minusculas. Mantener synchronize:false.
   Reutiliza las 12 metas existentes; no modifica pesos/configuracion de Bodega.
   Ya existen DECIMAL(18,6) y unicidad diaria; no necesitan ALTER.
   Metas usa SMALLINT/TINYINT y TIMESTAMP: compatibles, no requieren conversion.
   Reemplaza UNIQUE SAP por indice no unico, por lo que debe desplegarse este backend.
   DDL no se revierte con ROLLBACK. Usar cliente que aborte al primer error, sin --force.
2. Publicar backend, npm ci --include=dev y npm run build; ejecutar el SQL y reiniciar
   backend antes de admitir trafico. No se ejecuta SQL automaticamente al iniciar.
3. Configurar .env:

```dotenv
DB_DATABASE=intertornillos_rrhh_1
KPI_VENTAS_USUARIO_ID=ID_REAL_DE_USUARIO_RRHH_O_ADMIN
```

4. Verificar dbo.usp_RRHH_KpiVentas en SAP con parametros FechaInicio DATE,
   FechaFin DATE, SlpCode INT nullable. Debe cumplir el contrato VentasSap del codigo.
   El procedimiento SAP no esta incluido en este repositorio. No se ha probado su
   ejecucion real en esta entrega. Cartera historica depende de su reconstruccion.
5. Probar carga de ayer (sin token HTTP, lee .env del directorio actual):

```bash
cd /var/www/rrhh-backend
node dist/actualizar-kpi-ventas.js
```

Carga manual de una fecha o recuperacion de un rango (maximo 366 dias terminados):

```bash
node dist/actualizar-kpi-ventas.js 2026-08-31
node dist/actualizar-kpi-ventas.js 2026-08-01 2026-08-31
```

Para poblar meses previos basta cargar el ultimo dia de cada mes si no necesitas
las fotos de todos los dias. El resultado actualiza el acumulado mensual.
Una carga parcial imprime empleados con errores y termina con codigo de salida 1.
Los empleados sin relacion SAP no se convierten en ventas cero.

6. Ajustar User/Group y ruta de Node en scripts/systemd/rrhh-kpi-ventas.service.
   El usuario debe poder leer proyecto/.env y escribir donde lo requiera el backend.

```bash
sudo cp scripts/systemd/rrhh-kpi-ventas.service /etc/systemd/system/
sudo cp scripts/systemd/rrhh-kpi-ventas.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start rrhh-kpi-ventas.service
sudo journalctl -u rrhh-kpi-ventas.service -n 80 --no-pager
sudo systemctl enable --now rrhh-kpi-ventas.timer
sudo systemctl list-timers --all rrhh-kpi-ventas.timer
```

Ejecuta a la 01:30 America/Guatemala y carga ayer. El primero del mes actualiza
el mes anterior; no necesita otra tarea mensual. Persistent recupera una ejecucion
pendiente, no todos los dias perdidos: usar rango tras una caida prolongada.
Reprocesar explicitamente meses anteriores para correcciones tardias de SAP.

No se ejecutaron migraciones ni cargas reales ni despliegues en esta entrega.
Las pruebas HTTP usan guard JWT sustituido; verifican DTO, rutas y RolesGuard real.
Las pruebas del servicio usan repositorios/SAP simulados; no certifican el SQL en MySQL.
