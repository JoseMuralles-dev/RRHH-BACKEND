# Consultas de vacaciones

Vista especializada de las incidencias existentes. No crea tablas, solicitudes ni saldos. El módulo de solicitudes sigue gestionando creación y aprobaciones; Vacaciones separa las consultas de presentación.

## Archivos

```text
src/modules/vacaciones/
├── vacaciones.module.ts
├── vacaciones.controller.ts
├── vacaciones.service.ts
├── vacaciones.spec.ts
└── dto/
    ├── consultar-vacaciones.dto.ts
    └── vacacion-response.dto.ts
```

`AppModule` registra `VacacionesModule`. Este registra los repositorios de `SolicitudIncidencia` y `Empleado`. El controller usa `JwtAuthGuard` y toma exclusivamente `request.user.idEmpleado`. El service verifica que sea un entero positivo y corresponda a un empleado activo; si no, responde 403.

## Relaciones existentes

No es necesario modificar entidades:

- `SolicitudIncidencia.empleado`: ManyToOne mediante `id_empleado`.
- `SolicitudIncidencia.tipoIncidencia`: ManyToOne mediante `id_tipo_incidencia`; inversa `TipoIncidencia.solicitudes`.
- `SolicitudIncidencia.aprobaciones`: OneToMany; inversa `AprobacionIncidencia.solicitud`, mediante `id_solicitud`.

El listado une únicamente el tipo. No necesita unir el historial de aprobaciones. La propiedad `TipoIncidencia.nombre` corresponde a `nombre_tipo`; `SolicitudIncidencia.estado` corresponde a `estado_solicitud`.

## Consultas TypeORM

La base común en `vacaciones.service.ts` es:

```ts
solicitudes.createQueryBuilder('solicitud')
  .innerJoinAndSelect('solicitud.tipoIncidencia', 'tipo')
  // El service selecciona únicamente las columnas de la respuesta.
  .where('solicitud.idEmpleado = :idEmpleado', { idEmpleado })
  .andWhere('solicitud.isActive = :activa', { activa: true })
  .andWhere('tipo.descuentaVacaciones = :descuenta', { descuenta: true });
```

El nombre del tipo no se usa como filtro. Un tipo desactivado no oculta solicitudes históricas activas.

El DTO anual convierte `anio` a número y exige entero entre 1000 y 9999. Omitirlo usa el año actual en Guatemala. El ValidationPipe global rechaza parámetros desconocidos, incluido `idEmpleado`; próximas usa un DTO vacío y no admite parámetros.

Mis vacaciones e historial filtran períodos que se solapan con el año:

```ts
.andWhere('COALESCE(solicitud.fechaInicio, solicitud.fechaFin) <= :finAnio', { finAnio: `${anio}-12-31` })
.andWhere('COALESCE(solicitud.fechaFin, solicitud.fechaInicio) >= :inicioAnio', { inicioAnio: `${anio}-01-01` })
```

Una solicitud diciembre–enero aparece en ambos años con los días originales, sin prorratear. Una solicitud sin ambas fechas queda fuera del filtro anual; requiere corregir su período en el flujo de incidencias.

- **Mis vacaciones:** PENDIENTE y EN_REVISION se agrupan en `pendientes`, conservando su estado original. También devuelve `aprobadas`, `rechazadas` y `canceladas`.
- **Próximas:** estado APROBADA y `fechaInicio >= hoy`, orden ascendente. Incluye hoy y años siguientes; excluye vacaciones ya iniciadas. Fecha actual en America/Guatemala.
- **Historial:** dentro del año, fecha final anterior a hoy **o** estado APROBADA/RECHAZADA/CANCELADA **o** fechaResolucion informada. Las alternativas se agrupan con `Brackets` sin eludir los filtros de empleado. Orden descendente. Una aprobación futura es una solicitud resuelta y puede aparecer también en próximas; historial no significa exclusivamente vacaciones disfrutadas.

## Postman

Inicia el backend con `npm run start:dev`. Obtén un token con el login habitual de un usuario que tenga empleado asociado. En cada petición selecciona **Authorization → Bearer Token** y pega ese token. No envíes body ni idEmpleado.

| Método | URL | Respuesta |
|---|---|---|
| GET | http://localhost:3000/vacaciones/mis-vacaciones?anio=2026 | Grupos por estado |
| GET | http://localhost:3000/vacaciones/proximas | Array de aprobadas desde hoy |
| GET | http://localhost:3000/vacaciones/historial?anio=2026 | `{ "anio": 2026, "solicitudes": [] }` |

Ejemplo ilustrativo de mis vacaciones:

```json
{
  "anio": 2026,
  "pendientes": [],
  "aprobadas": [
    {
      "idSolicitud": 15,
      "fechaInicio": "2026-10-05",
      "fechaFin": "2026-10-09",
      "diasSolicitados": 5,
      "motivo": "Descanso anual",
      "estadoSolicitud": "APROBADA",
      "fechaResolucion": "2026-09-18T15:00:00.000Z",
      "nombreTipo": "Vacaciones"
    }
  ],
  "rechazadas": [],
  "canceladas": []
}
```

Próximas e historial usan los mismos campos para cada solicitud. Sin coincidencias devuelven arrays vacíos y HTTP 200.

Verifica también:

1. Sin token o con token inválido: 401.
2. Usuario sin empleado asociado o con empleado inactivo/inexistente: 403.
3. `?idEmpleado=99`: 400 en cualquiera de las tres rutas.
4. `?anio=abc` o `?anio=2026.5`: 400 en las rutas anuales.
5. Con dos tokens de distintos empleados, cada uno ve exclusivamente sus solicitudes.
6. Solicitudes inactivas o de tipos que no descuentan vacaciones no aparecen.

Ejecutar pruebas automatizadas: `npm test -- --runInBand vacaciones.spec.ts`. Usan JWT reales con una clave exclusiva de pruebas y repositorios simulados; no escriben en MySQL.
