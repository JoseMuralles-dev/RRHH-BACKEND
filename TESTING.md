# Pruebas del backend

## Panel Testing de VS Code

1. Abrir esta carpeta `rrhh-backend` como proyecto (Archivo > Abrir carpeta).
2. Instalar **Jest**, identificador `Orta.vscode-jest`. Se recomienda en `.vscode/extensions.json`.
3. Si VS Code estaba abierto al instalarla, ejecutar `Developer: Reload Window` desde `Ctrl+Shift+P`.
4. Abrir el icono del matraz **Testing**. Si no aparece, usar `Testing: Focus on Test Explorer View` desde la paleta.
5. Aparecen dos grupos: **Backend - unitarias y servicios** y **Backend - integracion HTTP**.
6. Usar el triangulo de una prueba, un archivo o un grupo para ejecutarlo. El boton superior ejecuta todas.
7. Seleccionar una prueba roja para ver el error y la linea que fallo. La accion de depuracion permite usar breakpoints.

La configuracion ya esta en `.vscode/settings.json`, para Jest 30, con ejecucion manual. No hace falta crear otro proyecto ni mover las pruebas. Si no se descubren, abrir **Output > Jest** y confirmar que la carpeta abierta contiene `package.json` y que se ejecuto `npm install`.

Referencia de configuracion: https://github.com/jest-community/vscode-jest#customization

## Terminal

```powershell
# Todas: archivos src y test
npm run test:all

# Pruebas en src (unitarias y algunas integraciones de servicios/HTTP existentes)
npm test -- --runInBand

# Integracion HTTP aislada
npm run test:integration

# Solo un archivo
npm test -- --runInBand --runTestsByPath src/modules/vacaciones/vacaciones-saldo.spec.ts

# Cobertura combinada y reporte HTML
npm run test:cov

# Validacion TypeScript, incluyendo archivos de pruebas
npx tsc --noEmit -p tsconfig.json
```

Abrir `coverage/index.html` en el navegador despues de medir cobertura. El informe muestra lineas y ramas no ejecutadas; un porcentaje alto no sustituye casos de negocio correctos.

## Aislamiento y alcance

- Los comandos anteriores no necesitan `.env`, credenciales, MySQL, SAP ni un servidor iniciado.
- Las pruebas unitarias sustituyen repositorios o drivers y comprueban reglas, errores y permisos.
- Las pruebas HTTP crean Nest, usan solicitudes Supertest y verifican routing, DTO, bcrypt, JWT, Passport y servicios. La persistencia usa dobles en memoria.
- Las pruebas de vacaciones combinan servicios y simulan transacciones/rollback. No prueban el motor de bloqueo de MySQL.
- `test:e2e` se conserva como alias historico del conjunto HTTP. No representa pruebas completas con navegador y base de datos real.
- No importar `AppModule` en las pruebas aisladas: su arranque configura infraestructura externa.
- `scripts/test-vacaciones-lock.cjs` es un diagnostico MySQL separado; no forma parte de Testing ni de `test:all`.

Para verificar consultas SQL, restricciones, rollback y concurrencia con MySQL real hace falta una base exclusiva de pruebas y credenciales limitadas a ella. Nunca reutilizar la base habitual ni ejecutar limpieza de datos de negocio desde una prueba. Esa integracion real y los recorridos completos de navegador siguen pendientes.

## Casos recuperados y ampliados

- Solicitudes: creacion, orden de aprobaciones, autoaprobacion, rechazo, cancelacion, fechas y dias.
- KPI: dashboard, cumplimiento real, evaluacion por departamento, desglose de facturas/traslados y reproceso, 5S.
- Vacaciones: reservas, consumo, devolucion, rollback simulado y regresion del corte historico de septiembre con reserva de octubre.
- Autenticacion y notificaciones: login real con bcrypt, token emitido, expiracion, aislamiento de destinatarios, marcado repetido y permisos HTTP.
- Roles y puestos: duplicados, referencias a departamentos activos y bajas logicas.
- SAP: parametrizacion y cierre de conexiones usando un driver simulado.
- Archivos: rutas fuera del almacenamiento, archivos ausentes, errores y nombres unicos, sin tocar archivos reales.

Las pruebas comentadas se reactivaron; no se usan `skip`, `todo` ni se excluyen suites para ocultar fallos. La cobertura aun no es del 100%; revisar el informe para priorizar nuevos casos al modificar cada modulo.

Esta configuracion corresponde al backend. El frontend Angular usa otro ejecutor y requiere su propia configuracion.
