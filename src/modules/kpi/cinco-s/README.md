# Inspecciones 5S por departamento

Formulario basado en `Copia de 5s Inter Tornillo.xlsx`, hoja `FORMATO`, filas 9 a 28. Conserva los 20 puntos a verificar y las cinco categorías. Escala: 0 Muy deficiente, 1 Deficiente, 2 Regular, 3 Bueno, 4 Excelente, 5 Supera expectativas.

Cada categoría suma cuatro criterios (máximo 20). La inspección suma las cinco categorías (máximo 100). Cada departamento registra cuatro inspecciones por mes, identificadas como 1, 2, 3 y 4. Se conserva fecha, sucursal, encargado, usuario inspector, respuestas y observaciones. Las inspecciones son inmutables y no se importan las notas históricas del Excel.

El mes se obtiene de la fecha de inspeccion. La nota mensual es `(nota1 + nota2 + nota3 + nota4) / 4`; el aporte KPI es la suma dividida entre 20, hasta 20%. Por ejemplo, 91, 94, 91 y 94 producen promedio 92.5 y aporte 18.5%, sin redondeos intermedios ni cuadres de inventario.

Con menos de cuatro inspecciones, el promedio y aporte son `null`. Las evaluaciones quedan `PENDIENTE_5S`. Al recalcular se desactiva cualquier resultado 5S anterior que ya no cumpla el requisito. Al completar las cuatro se actualizan las evaluaciones existentes y se generan las faltantes con metricas operativas disponibles.

El código de la métrica es `DEP_5S_<idDepartamento>`. Bodega la habilita al calcular su evaluación mensual; otros departamentos al registrar su primera inspección. Las reglas existentes de los otros indicadores se conservan (incluyendo rangos y metas). Para Bodega, sus cuatro indicadores deben aportar los 80 puntos restantes según su configuración: facturas 15, líneas 15, artículos 25 y tiempo 25. Esta implementación no modifica rangos operativos ni reemplaza el KPI existente de tiempo de preparación por uno de horas efectivas.

## Instalación

Aplicar `scripts/sql/20261009-inspecciones-cinco-s.sql` en la base de datos antes de desplegar el backend. `synchronize` sigue desactivado. La migración agrega únicamente la tabla de inspecciones y no modifica notas históricas. No se ejecuta automáticamente al iniciar el servidor.

## API

Todas las rutas requieren JWT. Niveles 3 y 4 pueden gestionar los departamentos activos; nivel 2 únicamente departamentos con empleados activos a su cargo. El inspector se obtiene del JWT, nunca del cuerpo enviado.

- `GET /kpi/cinco-s/catalogo`: categorías, criterios, escala y departamentos autorizados.
- `GET /kpi/cinco-s/:idDepartamento?anio=2026&mes=10`: inspecciones y resumen del mes.
- `POST /kpi/cinco-s`: `{ idDepartamento, numero, fecha, sucursal, encargado, puntos: [20 enteros entre 0 y 5], observaciones? }`. La posición de cada respuesta corresponde al número de criterio menos uno.

Guardar y actualizar el aporte ocurre en una sola transacción con bloqueo del departamento; el cálculo mensual utiliza el mismo bloqueo. La clave única departamento/año/mes/número evita duplicados. Guardar de nuevo una inspección existente devuelve 409. El aporte anterior se sustituye al recalcular, sin acumularlo.

Frontend: `/kpis/cinco-s`. Acceso desde el menú y desde Desempeño del equipo. Los cálculos visibles del formulario son orientativos hasta guardar; el backend valida y calcula el resultado oficial.

## Recálculo y evaluaciones faltantes

Al guardar la segunda inspección o ejecutar `POST /kpi/cinco-s/:idDepartamento/recalcular?anio=2026&mes=9`, se actualiza el aporte de las evaluaciones existentes. Además, se generan las evaluaciones faltantes de empleados activos del departamento con métricas operativas del período. Los empleados sin métricas se reportan en `empleadosSinDatos`; no se inventa su nota. La respuesta distingue `evaluacionesActualizadas` y `evaluacionesCreadas`.

El recálculo comparte el bloqueo de departamento y la transacción del guardado. El botón **Recalcular aporte 5S en KPI** permite recuperar meses con inspecciones previamente guardadas. Generar una evaluación utiliza las métricas disponibles, sin implicar que ya se haya cargado todo el mes. Las evaluaciones existentes conservan los resultados operativos; este botón actualiza únicamente su aporte 5S.


Actualizacion a cuatro inspecciones: aplicar scripts/sql/20261014-cuatro-inspecciones-cinco-s.sql en MySQL antes de guardar la tercera inspeccion. El promedio es suma / 4 y el aporte es suma / 20 (maximo 20%). Los periodos con menos de cuatro inspecciones quedan pendientes al recalcular. La migracion no modifica las notas existentes; ejecutar el recalculo mensual tras completar las inspecciones.
