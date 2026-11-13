# Actualizacion diaria de KPI en produccion

La tarea carga ayer de SAP y recalcula el mes de esa fecha a la 01:00 America/Guatemala. No abre un puerto HTTP ni necesita tokens. Usa el .env del WorkingDirectory. Detecta el departamento por las cuatro metricas BOD_ activas, sin asumir que su ID sea 3.

Los resultados son el avance acumulado de los dias importados, no una proyeccion del cierre. El 1 de cada mes se carga el ultimo dia del mes anterior y se recalcula ese mes. No hay que esperar fin de mes ni instalar un segundo temporizador mensual.

## Instalacion en el VPS (despues de publicar el codigo)

1. En /var/www/rrhh-backend, ejecutar `npm ci --include=dev` y `npm run build`.
2. Revisar `command -v node`: ajustar ExecStart si Node no esta en /usr/bin/node. El usuario del servicio debe poder ejecutarlo.
3. Editar scripts/systemd/rrhh-kpi.service: User y Group deben corresponder al usuario que ejecuta el backend. La plantilla usa rrhh; no crear otro servicio bajo root por defecto. Si ese usuario no existe, crearlo con `useradd --system --user-group --no-create-home --shell /usr/sbin/nologin rrhh` y concederle lectura al proyecto y .env y acceso a las carpetas uploads usadas por la aplicacion. No hacer publico el .env.
4. Instalar y probar primero la tarea manualmente:

```bash
sudo cp scripts/systemd/rrhh-kpi.service /etc/systemd/system/
sudo cp scripts/systemd/rrhh-kpi.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start rrhh-kpi.service
sudo journalctl -u rrhh-kpi.service -n 80 --no-pager
```

Un servicio oneshot queda inactive (dead) despues de terminar correctamente. Revisar `systemctl show rrhh-kpi.service -p Result -p ExecMainStatus`: success y 0 indican exito. Si hubo errores, corregirlos antes de activar:

```bash
sudo systemctl enable --now rrhh-kpi.timer
sudo systemctl list-timers --all rrhh-kpi.timer
```

## Fallos, recuperacion y correcciones tardias

Persistent=true ejecuta una tarea pendiente al volver a encender el VPS, pero NO recupera automaticamente todos los dias de una caida prolongada. SAP tampoco garantiza que ayer ya contenga todas las correcciones. Recuperar un rango explicitamente desde el directorio del backend, con el mismo usuario y entorno del servicio:

```bash
node dist/actualizar-kpi.js 2026-08-01 2026-08-31
```

Tambien admite una sola fecha. Como maximo 366 dias, nunca hoy o fechas futuras. Despues de importar todos los dias recalcula cada mes afectado. Repetir actualiza datos existentes. No ejecutar manualmente el ETL HTTP mientras esta corriendo esta tarea: el bloqueo MySQL protege otras instancias del job, no las llamadas HTTP antiguas.

La tarea falla si SAP falla, faltan relaciones de empleados o existen errores de calculo. Consultar journalctl; no se marca una carga parcial como exitosa. Los dias ya guardados permanecen y pueden reprocesarse. No borra registros SAP que hayan desaparecido posteriormente de origen.

El ETL actualiza por empleado/metrica/fecha; las evaluaciones por empleado/departamento/mes, y sus resultados por metrica. Solo crea los que faltan. El desglose detalle_resultado_kpi se reemplaza dentro de la transaccion mensual, por lo que sus IDs pueden cambiar, sin acumular duplicados. No son INSERT manuales.

Para detener la programacion: `sudo systemctl disable --now rrhh-kpi.timer`. Esto no detiene una tarea que ya este ejecutandose.
