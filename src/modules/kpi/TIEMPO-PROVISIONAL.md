# Tiempo efectivo de Bodega: criterio temporal

Desde agosto de 2026, las evaluaciones de Bodega identificadas por indicadores BOD_ incluyen un aporte fijo de 25%. Se mantiene mientras se desarrolla y valida la medicion del tiempo efectivo, pausas y periodos no laborales. La asignacion fue solicitada por el responsable del proyecto; no se atribuye una aprobacion a un usuario de RRHH que el sistema no haya registrado.

No se crean horas, metas, porcentajes de cumplimiento ni registros de resultados ficticios. La API representa el aporte mediante un resultado virtual (idResultado 0, idMetrica -1, asignacionProvisional true), con valores medidos nulos. Los registros originales de SAP se conservan; durante la vigencia no se suman ademas del aporte provisional ni se grafican como tiempo efectivo.

El dashboard aplica el criterio a evaluaciones existentes. El calculo mensual guarda la suma en la evaluacion. Para actualizar totales almacenados previamente, ejecutar el recalculo mensual del departamento y periodo mediante el flujo existente. No se modifican datos del servidor desde este cambio de codigo.

La vigencia esta centralizada en performance/services/tiempo-provisional.ts. Cuando se implemente la medicion real, establecer TIEMPO_PROVISIONAL_HASTA con el ultimo periodo inclusivo (AAAAMM), conservando la regla historica. Revisar entonces la fuente SAP: hoy es tiempo promedio de preparacion, no horas trabajadas.

No se crean evaluaciones de empleados sin metricas diarias. Los meses previos a agosto de 2026 y otros departamentos mantienen su calculo anterior. 5S sigue aportando hasta 20%, promediando las dos inspecciones, sin inventarios.
