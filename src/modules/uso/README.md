# Indicadores internos de uso

Solo backend. No se agrega menu ni pantalla en frontend. Datos nuevos desde la
activacion; no reconstruye actividad historica anterior a la instalacion.

## Instalacion

Revisar scripts/sql/20261016-indicadores-uso.sql y ejecutarlo en MySQL RRHH:

mysql -h HOST -u USUARIO -p BASE_RRHH
SOURCE /var/www/rrhh-backend/scripts/sql/20261016-indicadores-uso.sql;

Luego compilar y reiniciar el backend con el mecanismo habitual:

npm run build

No se ejecutaron migraciones en servidores. synchronize permanece false.
USO_HABILITADO=true es el comportamiento predeterminado; USO_HABILITADO=false
suspende nuevas capturas sin borrar historial. No requiere credenciales nuevas.

Tabla uso_eventos: identificador, usuario, nivel de rol al ocurrir, modulo,
accion, origen, metodo, plantilla de ruta, estado HTTP, exito, duracion en ms,
UUID opcional de navegacion y fecha UTC. Indices por fecha/modulo/usuario y
unicidad usuario+evento_cliente para reintentos. Sin FK deliberadamente: no
condiciona eliminacion de cuentas; permite conservar IDs de usuarios historicos.

## Captura automatica

UsoInterceptor global registra al finalizar la respuesta HTTP, despues de los guards:

- GET kpi/mi-dashboard y kpi/ventas/mi-dashboard: CONSULTA_KPI_INDIVIDUAL.
- GET kpi/mi-equipo y kpi/ventas/equipo: CONSULTA_KPI_GLOBAL (equipo autorizado).
- Expediente por empleado: CONSULTA_EXPEDIENTE.
- Previsualizaciones y descargas de documentos: acciones separadas.
- POST de negocio: REGISTRO_CREADO; PUT: REGISTRO_GUARDADO (alta o reemplazo).
- PATCH: REGISTRO_ACTUALIZADO / REGISTRO_DESACTIVADO; DELETE: REGISTRO_DESACTIVADO.
- ETL, evaluaciones y recalculos: PROCESO_EJECUTADO, no un alta de registro.
- IA: CONSULTA_IA, no un alta.
- Login exitoso: INICIO_SESION con el usuario devuelto por el servicio autenticador.
- Otras consultas de empleados, solicitudes, vacaciones, usuarios, departamentos,
  puestos, roles, inspecciones 5S y perfil: CONSULTA con su modulo.

El actor se toma del JWT validado, no del body ni query. Para login se usa el
resultado del servicio, nunca las credenciales del formulario. No se guarda
contenido de solicitudes/respuestas, preguntas IA, nombres de archivo, IP,
correos, contrasenas, tokens ni valores de filtros. La ruta se obtiene del router:
/expedientes/empleado/:idEmpleado, no la URL real con identificadores o query.

Se excluyen /uso/* (evita medir los reportes), /auth/me y el contador automatico
/notificaciones/no-leidas/count; tambien endpoints internos ai-tools, ia/tools y SAP.
Los procesos ejecutados por CLI/cron sin peticion HTTP no cuentan como uso humano.
Los errores de handlers/pipes que llegan a responder se registran con exito=false;
fallos de guards, login fallido sin actor y conexiones abortadas antes de finish
no se capturan. No sustituye auditoria de seguridad.

Exito HTTP es 2xx/3xx; guardado:false o un resultado con errores[] no vacio se marca
fallido aunque responda 200. Los conteos son operaciones HTTP, NO filas insertadas.
Un PUT repetido son dos operaciones aunque siga existiendo una sola fila de negocio.
Un POST parcial puede producir filas y registrarse fallido; revisar auditoria de
negocio si se necesita conteo exacto de filas/cambios. Descarga significa respuesta
finalizada por el servidor, no confirmacion de apertura del archivo por el usuario.

## Entradas a modulos: preparadas, requieren frontend posteriormente

El servidor no sabe cuando se abre una pantalla sin consultar una API. No se
inventan visitas a partir de GET. Queda disponible el contrato:

POST /api/uso/entradas
Authorization: Bearer <JWT>
Content-Type: application/json
{
  "modulo": "EXPEDIENTES",
  "eventoId": "3dc1dff9-19cb-4416-bebd-9e5d9167921a"
}

Respuesta: {"registrado":true}. Guardar un UUID v4 nuevo por entrada real y
reutilizarlo solo para reintentar esa misma entrada. Un retry no duplica visitas.
No acepta idUsuario, fechas, rutas ni propiedades libres. Se usa hora del servidor.
Cualquier rol autenticado puede enviar su propia entrada; es una declaracion del
cliente, no prueba de que el backend le haya autorizado datos del modulo.
Modulos permitidos en uso-reglas.ts. No se modifico el frontend para enviarlos:
por ahora entradas_modulos sera 0 salvo envios explicitos a este endpoint.
Un filtro por empleado aplicado exclusivamente en el frontend tampoco es otra
consulta individual al backend. Esa interaccion requeriria instrumentacion futura.

## Consultas internas, solo administrador nivel 4 activo

GET /api/uso/resumen?desde=2026-10-01&hasta=2026-10-16
GET /api/uso/resumen?desde=2026-10-01&hasta=2026-10-16&modulo=KPI&idUsuario=7
GET /api/uso/recurrencia?desde=2026-10-01&hasta=2026-10-16

Todas requieren Bearer JWT. Ademas del guard de nivel, se consulta usuario y rol
actuales activos en MySQL. RRHH, encargados y empleados no pueden leer reportes.
Desde/hasta son fechas inclusivas de America/Guatemala (UTC-06); maximo 366 dias.
Fechas invalidas/rangos invertidos devuelven 400. Los filtros se parametrizan.

resumen devuelve:
- totales: eventos, exitosos, fallidos, usuarios_activos, entradas_modulos, solicitudes_api.
- porAccion: modulo, accion, origen, eventos, exitosos/fallidos, usuarios activos y duracion media.
- porDia: fecha local, origen, eventos, usuarios activos y exitosos.
- criterios: aclaraciones sobre significado de los conteos.

recurrencia devuelve hasta 200 usuarios ordenados por dias activos y eventos:
- id_usuario, eventos, exitosos, dias_activos (dias distintos con exito), modulos_utilizados,
  entradas_modulos, primer_evento_utc, ultimo_evento_utc.
- hayMas=true indica que debe reducir el periodo o filtrar por idUsuario para detalle.

Los usuarios activos de diferentes grupos NO se deben sumar: pueden ser la misma
persona. No hay filas para dias sin eventos; interpretarlos como 0 al graficar.
Una alta recurrencia no equivale a mayor productividad, ni mide permanencia.

## Disponibilidad y operacion

La captura automatica no retrasa ni cambia la respuesta de negocio. Inserta despues
de finish, con maximo 100 escrituras pendientes por proceso; falla de tabla/BD o
saturacion produce aviso generico limitado a uno cada 30 segundos y descarta eventos.
Un reinicio abrupto puede perder escrituras pendientes; no es un registro transaccional
de auditoria. POST entradas informa 503 si no pudo registrar (o captura deshabilitada),
para permitir retry con el mismo UUID. Los reportes no ocultan errores de base de datos.
No hay borrado automatico; planificar retencion segun la ventana del estudio.

Pruebas (Node compatible con package.json):
npm test -- --runInBand src/modules/uso
npm run build

Pruebas HTTP con JWT/guards reales y repositorios simulados; no equivalen a validar
la migracion contra una instancia MySQL real. Probar primero en base de desarrollo.
