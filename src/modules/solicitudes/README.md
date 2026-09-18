# Solicitudes de incidencia

## Endpoints autenticados

- `GET /solicitudes/tipos-incidencia`: catálogo activo para el selector (`idTipoIncidencia`, `nombre`, `esRemunerado` y `descuentaVacaciones`).
- `POST /solicitudes`: crea la solicitud y sus aprobaciones dentro de una transacción. El empleado se obtiene de la sesión.
- `GET /solicitudes/mis-solicitudes`: solicitudes del empleado autenticado.
- `GET /solicitudes/pendientes-aprobacion`: únicamente solicitudes abiertas cuyo turno actual corresponde al usuario.
- `GET /solicitudes/:id`: detalle para propietario, aprobador asignado o nivel jerárquico >= 3.
- `PATCH /solicitudes/:id/aprobar`: resuelve el turno actual; comentario opcional.
- `PATCH /solicitudes/:id/rechazar`: resuelve el turno actual; comentario obligatorio y no vacío.
- `PATCH /solicitudes/:id/cancelar`: propietario o nivel >= 4; solo solicitudes abiertas.

## Reglas

- Fechas de calendario estrictas en formato `YYYY-MM-DD`, sin horas.
- Días laborables de lunes a viernes, ambos extremos incluidos cuando son laborables. `diasSolicitados` debe coincidir exactamente con el cálculo del servidor. No se descuentan feriados: todavía no hay catálogo.
- No se aceptan períodos sin días laborables ni motivos compuestos solo por espacios.
- Nivel 1: jefe directo activo con cuenta y rol activos. Nivel 2: RRHH con cuenta y rol activos, distinto del solicitante y del jefe. Entre varios candidatos elegibles se elige el menor `idUsuario` para una asignación determinista.
- Si falta un aprobador válido, se rechaza la creación con un mensaje de configuración; no se crea una solicitud a medias ni se permite autoaprobación.
- Aprobar y rechazar requieren que todos los turnos anteriores estén aprobados. El aprobador se comprueba de nuevo contra la base de datos.
- Aprobar, rechazar y cancelar adquieren `pessimistic_write` sobre la misma fila de solicitud dentro de una transacción `READ COMMITTED`.
- `APROBADA`, `RECHAZADA` y `CANCELADA` son estados finales. Ninguna acción posterior puede sobrescribirlos.
- Las aprobaciones sin respuesta se conservan como historial al cerrar una solicitud. Su estado pendiente no significa que puedan resolverse: el estado final de la solicitud y la consulta de pendientes impiden actuar sobre ellas. No se agrega un nuevo valor al enum SQL.

## Verificación

```shell
npm test -- --runInBand solicitudes
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Las pruebas usan repositorios simulados. La prueba de concurrencia simula la serialización de transacciones; no sustituye una prueba de bloqueo con MySQL real. No crean ni resuelven solicitudes reales.

## Periodo por tipo de solicitud

Aplicar `node scripts/solicitudes-periodo.cjs` antes de iniciar esta version.
El script conserva registros, admite NULL en fechas/dias y agrega `requiere_periodo`.
Los tipos existentes conservan la exigencia de periodo; los nuevos tienen valor 0 por defecto.
Configurar `requiere_periodo = 1` para vacaciones y descanso, y 0 para materiales u otros requerimientos sin periodo.
El catalogo devuelve `requierePeriodo`. No depende del nombre ni de `descuentaVacaciones`.
Solo los tipos con periodo exigen `fechaInicio`, `fechaFin` y `diasSolicitados` (lunes a viernes, sin feriados).
Para otros tipos, omitir esos campos; se guardan como NULL. El servidor rechaza valores de periodo no aplicables.
Ejemplo sin periodo: `{ "idTipoIncidencia": 2, "motivo": "Solicito materiales" }` (usar un ID real del catalogo).

Si el jefe directo tiene el rol activo RRHH, se crea solo la aprobacion de nivel 1 y su aprobacion finaliza la solicitud. No se busca otro usuario de RRHH ni al coordinador. Para otros jefes se mantienen los niveles jefe y RRHH. Esta regla se aplica al crear solicitudes nuevas; las existentes conservan su flujo asignado.
