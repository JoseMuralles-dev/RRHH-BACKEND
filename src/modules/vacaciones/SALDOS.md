# Saldos y gestión de vacaciones

Implementación integrada con `SolicitudesModule`. No crea otro circuito de aprobación, no instala dependencias, no modifica Angular y conserva `synchronize: false`.

## Esquema contrastado

Se consultaron `information_schema.COLUMNS` y `SHOW CREATE TABLE` de las tablas y vista existentes. Se confirmó MySQL/InnoDB, DECIMAL(6,2), índices únicos, restricciones CHECK y FK RESTRICT. `solicitudes_incidencia.dias_solicitados` es INT: se corrigió únicamente su mapeo TypeORM, antes declarado DECIMAL. No se ejecutaron DDL, migraciones ni escrituras de datos de negocio.

El tipo de vacaciones se reconoce mediante `TipoIncidencia.descuentaVacaciones`; no por nombre o ID fijo. La vista `vw_vacaciones_saldos` permanece intacta. El servicio calcula su misma fórmula a partir de entidades usando centésimas enteras. Los importes de las respuestas nuevas se serializan como cadenas con dos decimales.

## Archivos y responsabilidades

- `entities/vacaciones-periodo.entity.ts`, `entities/vacaciones-movimiento.entity.ts`: mapeo de las tablas existentes y relaciones.
- `dto/saldo-vacaciones.dto.ts`: validación de importes, períodos, ajustes, páginas y calendarios.
- `vacaciones-reglas.ts`: fechas de calendario, precisión decimal y asignación FIFO de saldos.
- `vacaciones-saldo.service.ts`: bloqueo del empleado, reservas, consumos, devoluciones y detección de inconsistencias históricas.
- `vacaciones-gestion.service.ts`, `vacaciones-gestion.controller.ts`: API nueva y autorización por usuario vigente y alcance.
- `vacaciones.module.ts`: registra y exporta la contabilidad para Solicitudes.
- `../solicitudes/solicitudes.service.ts`: integra validaciones, aprobación y cancelación atómicas; añade edición de vacaciones pendientes.
- `../solicitudes/solicitudes.controller.ts`, `solicitudes.module.ts`: edición y dependencia del módulo existente.
- `../solicitudes/entities/solicitud-incidencia.entity.ts`: mapeo INT confirmado.
- `vacaciones-saldo.spec.ts`: pruebas de reglas y colaboración de servicios con rollback simulado.
- `../solicitudes/solicitudes.service.spec.ts`: inyección del servicio nuevo y actualización de una expectativa antigua para ajustarla al comportamiento que ya tenía `findAprobadas`; no se cambió ese endpoint.
- `scripts/test-vacaciones-lock.cjs`: prueba de bloqueo real con TypeORM/MySQL, exclusivamente SELECT y ROLLBACK.

Las rutas anteriores `/vacaciones/mis-vacaciones`, `/vacaciones/proximas` y `/vacaciones/historial` conservan sus contratos.

## Seguridad

Todas las rutas requieren JWT. Las nuevas consultas verifican también el usuario y rol vigentes. El empleado ve lo propio; el encargado ve subordinados directos, como el módulo KPI. RRHH/ADMIN con nivel mínimo 3 gestionan períodos y ajustes. El calendario de equipo sigue limitado a subordinados directos incluso para esos roles y no devuelve motivos ni datos personales adicionales. La consulta de saldo por empleado permite a RRHH/ADMIN consultar otros empleados.

El registrador de movimientos proviene del Usuario autenticado. Un administrador sin empleado activo asociado recibe 409 al intentar registrar un ajuste, consumo o devolución: debe vincularse con su empleado real. No se usa el empleado solicitante como sustituto. Cambiar la FK para admitir usuarios en vez de empleados sería una decisión de esquema distinta, no aplicada.

## API

Prefijo `/vacaciones`:

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/mi-saldo` | Resumen propio |
| GET | `/empleados/:id/saldo` | Resumen con control de alcance |
| GET | `/mis-movimientos?pagina=1&limite=20` | Historial propio paginado |
| GET | `/empleados/:id/movimientos?pagina=1&limite=20` | Historial autorizado |
| GET | `/empleados/:id/periodos?pagina=1&limite=20` | Períodos paginados |
| POST | `/empleados/:id/periodos` | Cargar período reconocido |
| PATCH | `/empleados/:id/periodos/:periodo` | Editar con el payload completo del período |
| POST | `/empleados/:id/periodos/:periodo/ajustes` | Ajuste con motivo |
| GET | `/calendario/propio?desde=2026-10-01&hasta=2026-10-31` | Calendario propio |
| GET | `/calendario/equipo?desde=2026-10-01&hasta=2026-10-31` | Calendario de subordinados directos |

Calendarios admiten `pagina` y `limite`, máximo 100 elementos por página y 366 días inclusivos por consulta. Seleccionan `fechaInicio <= hasta AND fechaFin >= desde`, por lo que incluyen solicitudes que cruzan los límites. Las fechas DATE se mantienen como YYYY-MM-DD.

Las solicitudes se crean y resuelven en las rutas ya existentes de `/solicitudes`. Se agregó `PATCH /solicitudes/:id`, únicamente para el propietario de vacaciones PENDIENTES sin aprobaciones respondidas. Usa el DTO completo de creación, no permite cambiar de tipo y excluye la reserva anterior. No se reabren solicitudes cerradas. El endpoint de cancelación existente permite ahora cancelar vacaciones aprobadas y devolver los consumos; los otros tipos conservan sus reglas anteriores.

Ejemplo de creación o edición de período (cantidades ilustrativas, nunca asignadas automáticamente):

```json
{
  "fechaInicio": "2025-03-01",
  "fechaFin": "2026-02-28",
  "diasAsignados": "12.00",
  "diasUtilizadosIniciales": "4.00",
  "fechaCorteInicial": "2026-09-30",
  "observaciones": "Saldo reconocido y conciliado por RRHH al corte"
}
```

Respuesta: entidad del período, con `idPeriodo`, `idEmpleado`, los campos anteriores y timestamps. Las fechas no deben superponerse con otro período del mismo empleado. Si hay movimientos solo se permite conservar fechas y valores iniciales; las observaciones pueden actualizarse. No hay endpoints de eliminación de períodos ni de edición/eliminación de movimientos.

Ejemplo de ajuste:

```json
{ "tipoMovimiento": "AJUSTE_POSITIVO", "dias": "1.50", "motivo": "Corrección documentada de saldo reconocido" }
```

Respuesta ilustrativa:

```json
{ "idMovimiento": 21, "idPeriodo": 7, "idSolicitud": null, "tipoMovimiento": "AJUSTE_POSITIVO", "dias": "1.50", "motivo": "Corrección documentada de saldo reconocido", "idEmpleadoRegistro": 30, "createdAt": "2026-10-03T15:00:00.000Z" }
```

Ejemplo de resumen, antes del ajuste anterior y con una reserva de 5 días:

```json
{
  "idEmpleado": 10,
  "saldoTotal": "8.00",
  "diasReservados": "5.00",
  "diasDisponibles": "3.00",
  "requiereConciliacion": false,
  "incidencias": [],
  "periodos": [{
    "idPeriodo": 7,
    "fechaInicio": "2025-03-01",
    "fechaFin": "2026-02-28",
    "fechaCorteInicial": "2026-09-30",
    "diasAsignados": "12.00",
    "diasUtilizadosIniciales": "4.00",
    "diasConsumidos": "0.00",
    "diasDevueltos": "0.00",
    "ajustesPositivos": "0.00",
    "ajustesNegativos": "0.00",
    "ajusteNeto": "0.00",
    "saldoDias": "8.00"
  }]
}
```

`diasDisponibles` es el saldo contable menos reservas; no garantiza una fecha específica. Las solicitudes validan además elegibilidad temporal, cortes y solapamientos. Si un período está negativo se muestra su saldo y se exige conciliación: no se permite utilizar otro saldo para ocultarlo. El frontend debe atender `requiereConciliacion` e `incidencias`.

Ejemplo de calendario:

```json
{ "items": [{ "idSolicitud": 15, "empleado": { "idEmpleado": 10, "nombre": "Nombre Apellido" }, "fechaInicio": "2026-10-05", "fechaFin": "2026-10-09", "diasSolicitados": 5, "estado": "PENDIENTE" }], "total": 1, "pagina": 1, "limite": 20 }
```

Las listas de períodos y movimientos usan el mismo envoltorio `items`, `total`, `pagina`, `limite`. No se exponen observaciones administrativas a empleados/encargados ni motivos de ajustes ajenos a encargados.

## Reservas, consumo y concurrencia

PENDIENTE y EN_REVISION reservan sin movimientos. La asignación calcula temporalmente las reservas por fecha de inicio e ID y los períodos por fecha de inicio e ID. Es una comprobación de viabilidad, no una asignación persistida: la API solo informa reservas por empleado. Los períodos son elegibles desde su fecha de inicio y no se aplica vencimiento automático al finalizar; confirmar cualquier política adicional con RRHH.

La aprobación final crea consumos por el total solicitado usando el manager de la misma transacción que cambia el estado. Las reservas de la propia solicitud se excluyen y se incluyen una sola vez en la simulación. La cancelación de aprobadas devuelve exactamente a los períodos originales. Las pendientes canceladas/rechazadas solo liberan reservas. Un reintento de aprobación/cancelación sobre una solicitud cerrada devuelve error sin nuevos movimientos.

Operaciones de escritura: READ COMMITTED, bloqueo pesimista de la fila Empleado antes de bloquear Solicitud, leer saldos o escribir períodos/movimientos. Crear/editar períodos usa ese mismo bloqueo para evitar superposiciones concurrentes. Un fallo revierte estado, aprobaciones y movimientos. No se depende solo de UNIQUE.

No existía una ruta de baja lógica de solicitudes y no se añadió una. Las modificaciones directas de DB quedan fuera de la API; si ya existe una solicitud inactiva con reservas pendientes o consumo no devuelto se detecta y se exige conciliación.

Referencia técnica: https://typeorm.io/docs/working-with-entity-manager/find-options/ (bloqueo pessimistic_write).

## Carga inicial sin duplicar consumos

1. RRHH debe conciliar los saldos por empleado y período, con fechas explícitas y cantidades reconocidas. No hay generación automática anual ni asignación de 15 días.
2. Resolver las solicitudes históricas pendientes que ya están incluidas en el corte; no dejarlas como reservas nuevas.
3. Cargar `diasAsignados`, `diasUtilizadosIniciales` y `fechaCorteInicial`. El histórico se guarda únicamente en el período, sin movimientos CONSUMO duplicados.
4. Una aprobada antigua sin movimientos solo se considera cubierta si termina antes o en el corte de TODOS los períodos cargados. Eso representa la declaración explícita de RRHH al cargar los cortes. Si falta un corte o la solicitud cruza el corte, se marca conciliación; no se infiere qué período la absorbió.
5. Las nuevas solicitudes deben empezar después de los cortes de los períodos elegibles. Las solicitudes cruzadas requieren conciliación y separación del tramo histórico/futuro por RRHH; no se prorratea automáticamente.
6. Una aprobada histórica sin CONSUMO no puede cancelarse generando DEVOLUCION ficticia. Debe conciliarse primero el historial. No se implementó una herramienta de reasignación histórica: esa operación requiere una política y trazabilidad específicas, y está bloqueada en la API.
7. Una vez que un período tiene movimientos, sus valores iniciales y fechas quedan protegidos. Para corregir saldo se registran ajustes con motivo.

## Verificación y limitaciones

- `npm run build`: correcto.
- `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modules/vacaciones/vacaciones-saldo.spec.ts src/modules/vacaciones/vacaciones.spec.ts src/modules/solicitudes/solicitudes.service.spec.ts src/modules/solicitudes/solicitudes.controller.spec.ts`: 4 suites, 78 pruebas correctas.
- `node --env-file=.env scripts/test-vacaciones-lock.cjs`: correcto en MySQL real, sin escrituras. La segunda conexión obtiene timeout mientras la primera mantiene el bloqueo y logra adquirirlo al liberar la primera.
- La prueba real demuestra exclusión sobre el empleado, no una carrera completa con solicitudes y aprobaciones. Las pruebas de rollback/negocio usan repositorios en memoria. No se encontró una base aislada de integración para crear datos y ejecutar carreras completas sin afectar datos reales.
- Se conserva el cálculo existente `validarPeriodo`: lunes a viernes inclusivos, días enteros; no hay catálogo de feriados ni medios días. La política laboral debe confirmarse con RRHH; no se presenta como norma legal.
- No se agregó infraestructura de migración ni automatización para conciliar aprobaciones históricas ambiguas.
