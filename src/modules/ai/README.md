# Tools analiticas de KPI

Primera iteracion: cinco endpoints de lectura. No se invoca n8n ni un modelo, no se guardan analisis/alertas y no se modifica la nota oficial. No hay migraciones; synchronize permanece en false.

## Estructura y reutilizacion

- ai.module.ts: repositorios, servicios y controllers mediante DI.
- controllers/ai-tools.controller.ts: POST con JWT/RBAC y delegacion al servicio.
- services/ai-context.service.ts: periodos, alcance autorizado, catalogo y metas.
- services/ai-tools.service.ts: consultas por lote y respuestas analiticas.
- dto/consultar-analitica.dto.ts: validacion de entradas.
- interfaces/ai-context.interface.ts: contratos reutilizables.
- utils/numero-analitico.ts: conversion defensiva de DECIMAL.
- controllers/ai-tools-legacy.controller.ts: conserva el GET anterior.

Se reutilizan Empleado, MetricaKpi y MetricaKpiDiaria. No se invoca el dashboard de KpiService porque mezcla evaluaciones finales y consulta por empleado. PerformanceService y EvaluacionKpiService escriben ETL/evaluaciones: estas tools son solo de lectura. No se duplican sus calculos de notas ni rangos.

## Postman

1. Usar Node 20.19+ (rama 20) o 22.12+; recomendado Node 22. Ejecutar npm run start:dev con la configuracion habitual de MySQL y los demas servicios del backend.
2. POST /auth/login con JSON de correo y password. Copiar access_token.
3. Importar ai-tools.postman_collection.json (en esta carpeta). Configurar token con access_token y baseUrl, por ejemplo http://localhost:3000.
4. Configurar idEncargado, idEmpleado, codigoKpi, anio, mes y cantidadMeses con valores reales y autorizados.
5. Ejecutar cada peticion. Todas usan Bearer {{token}}, Content-Type: application/json y devuelven 200 si la consulta es valida.

| POST | JSON de ejemplo |
| --- | --- |
| /ai-tools/resumen-equipo | {"idEncargado":10,"anio":2026,"mes":9} |
| /ai-tools/metricas-empleado | {"idEmpleado":21,"anio":2026,"mes":9} |
| /ai-tools/serie-metrica-empleado | {"idEmpleado":21,"codigoKpi":"BOD_ARTICULOS","anio":2026,"mes":9} |
| /ai-tools/historico-equipo | {"idEncargado":10,"anio":2026,"mes":9,"cantidadMeses":3} |
| /ai-tools/historico-empleado | {"idEmpleado":21,"anio":2026,"mes":9,"cantidadMeses":3} |

cantidadMeses es opcional, 3 por defecto, de 1 a 12. Incluye el mes final anio/mes: septiembre de 2026 con 3 meses devuelve julio, agosto y septiembre, en ese orden. No se admiten rangos que empiecen antes de enero de 2000. Los IDs son enteros positivos; anio 2000-9999, mes 1-12 y codigoKpi hasta 50 caracteres.

## Contratos

Resumen: idEncargado, periodo, totalEmpleados, criterios y empleados. Cada empleado contiene idEmpleado, tieneDatos y metricas. Cada metrica contiene idMetrica, idDepartamento, codigoKpi, nombreKpi, unidadMedida, metaObjetivo, tipoCalculo, activa, tieneDatos, total, promedioDiario, minimo, maximo y diasConDatos. No incluye series.

Detalle: idEmpleado, periodo, tieneDatos, criterios y metricas. Cada metrica incluye su metadata, diasConDatos y serieDiaria ordenada por fecha, con fecha, valor, fuente y desgloseOrigen (origen y valor numerico, o null). La tool de serie conserva este contrato con una sola metrica; la consulta MySQL filtra por empleado, metrica y fechas.

Historico individual: idEmpleado, cantidadMeses, criterios y periodos. Cada periodo contiene periodo (anio, mes, fechaInicial, fechaFinal), tieneDatos y metricas con los mismos agregados del resumen. El historico de equipo contiene idEncargado, totalEmpleados, cantidadMeses, criterios y empleados, cada uno con idEmpleado y periodos. Incluye meses vacios.

## Supuestos y limites de interpretacion

- Equipo y departamento actuales: no existe una relacion historizada. Se consultan empleados activos y subordinados directos, sin recursion.
- KPI esperados: los activos del departamento actual mas cualquier KPI registrado para ese empleado en el rango, incluso inactivo o de otro departamento. Es una aproximacion por catalogo, no una asignacion individual historizada.
- Metas/tipoCalculo son la configuracion actual, no necesariamente la vigente en el mes pasado. criterios.configuracionKpi lo declara.
- Sin registros: tieneDatos false, diasConDatos 0 y agregados null. Un cero registrado conserva tieneDatos true. Las series no rellenan dias faltantes.
- diasConDatos cuenta fechas distintas, no dias laborables. Sin calendario/ETL esperado no se declara un mes completo ni se interpreta falta de registros como ausencia laboral.
- total es SUM(valor), una suma descriptiva, no el resultado oficial. Para tasas/promedios puede carecer de significado operativo: interpretarlo junto a tipoCalculo.
- promedioDiario es AVG(valor) sobre los dias registrados, redondeado a 4 decimales. No esta ponderado por volumen de operaciones.
- DECIMAL se convierte a numero finito dentro de un rango seguro para centesimas. Si lo excede se devuelve error, no un numero corrupto.

## Permisos y contrato para n8n

| Nivel JWT | Individual | Equipo |
| --- | --- | --- |
| 1 EMPLEADO | Solo propio idEmpleado | No |
| 2 ENCARGADO | Solo subordinados directos activos | Solo su propio idEmpleado como idEncargado |
| 3 RRHH / 4 ADMIN | Empleado explicitamente solicitado | Equipo explicitamente solicitado |

No existe tool global sin filtros. El encargado no consulta su propio detalle en estas rutas, siguiendo la regla solicitada de solo subordinados. Niveles 1/2 requieren empleado asociado activo; RRHH/Admin pueden no tenerlo.

JwtAuthGuard valida el JWT; RolesGuard valida el nivel y AiContextService valida el alcance mediante jefeDirecto.idEmpleado. Los campos extra de identidad o rol en body se rechazan. La IA nunca decide permisos.

En el futuro flujo n8n, mantener el JWT del usuario iniciador en contexto confiable de esa ejecucion y enviarlo como Bearer fijo en cada HTTP Request Tool. No exponerlo al modelo ni permitirle elegir credenciales/editar el header. No utilizar un token RRHH/Admin compartido para atender a empleados. La comunicacion NestJS -> webhook n8n queda para AiService en otra iteracion; no se implementa en estas tools.

El agente debe empezar por resumen, profundizar en empleado y despues en una serie. Los historicos comparan meses sin cargar todos los dias. No conectar el GET legado como contexto automatico. No hay SQL generico ni credenciales MySQL en n8n. Las respuestas nuevas no incluyen nombres, DPI, telefono, direccion ni expedientes.

Futuros hallazgos: descriptivos, con limites de datos y recomendaciones de revision humana, sin causalidad afirmada ni decisiones laborales automaticas. Futuros calculos de correlacion/variacion/atipicos: servicios deterministicos que reutilicen AiContextService; la IA solo interpretara.

## Errores y pruebas

- 400: parametros invalidos, campos extra, body incompleto o rango excesivo.
- 401: JWT ausente, vencido o firma invalida.
- 403: alcance/nivel insuficiente o actor sin empleado activo.
- 404: encargado/empleado autorizado inexistente/inactivo, KPI inexistente o no aplicable y sin registros. Un KPI aplicable sin registros devuelve 200 y serie vacia.

Postman negativo: token encargado + otro idEncargado -> 403; token empleado + otro idEmpleado -> 403; mes 13 o cantidadMeses 13 -> 400; sin Bearer -> 401. Un mes vacio autorizado debe devolver 200 y tieneDatos false.

Verificacion local con Node 20.19+ (rama 20) o 22.12+; recomendado Node 22:

```bash
npm run build
npm test -- --runInBand --testPathPatterns=modules/ai
node scripts/verify-ai-query.cjs
npx eslint "src/modules/ai/**/*.ts"
```

Las pruebas HTTP usan JWT/RBAC reales y repositorios simulados. El script valida SQL MySQL y metadata del codigo compilado, sin conectarse a la base. La prueba con registros reales y con n8n desplegado debe hacerse en tu entorno.

## Endpoint anterior conservado
# Consulta de metricas desde n8n

El modulo expone datos para que un flujo de n8n los use como contexto de IA. No llama por si mismo a un modelo ni a un webhook.

## Peticion

- Metodo: GET
- URL: http://HOST_BACKEND:3000/ia/tools/metricas-equipo
- Query parameters: idEncargado=1, anio=2026, mes=9
- Header: Authorization: Bearer TOKEN

Usa el access_token devuelto por POST /auth/login (JSON con correo y password). La cuenta debe tener nivelJerarquico >= 3, igual que la consulta administrativa de empleados. El token vence a las 8 horas; el flujo debe obtener uno vigente. Guarda las credenciales en n8n, fuera del prompt del modelo.

Configura esos valores en la peticion HTTP de tu flujo. HOST_BACKEND debe ser accesible desde donde corre n8n; localhost solo sirve si ambos procesos comparten el mismo host de red.

La respuesta contiene idEncargado, periodo (anio, mes, fechaInicial, fechaFinal), totalEmpleados y empleados. Cada empleado incluye su nombre y metricas con serieDiaria. Se consultan solamente subordinados directos activos y registros ya almacenados; esta ruta no sincroniza SAP ni calcula evaluaciones.

Fechas en formato YYYY-MM-DD, incluyendo el ultimo dia del mes. Un equipo vacio devuelve empleados: [].

Errores: 400 parametros invalidos, 401 token ausente o vencido, 403 nivel insuficiente, 404 encargado inexistente o inactivo.

