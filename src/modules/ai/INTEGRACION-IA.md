### Nombres solo en la presentación local
Las herramientas no envían nombres. El backend guarda la respuesta con IDs y,
antes de entregarla al frontend, consulta nombres de empleados activos autorizados.
Esto también aplica al abrir informes guardados y automáticos (resumen, puntos y recomendaciones).
No reemplaza números aislados, porcentajes ni importes.

Instrucción para el agente n8n:
> Identifica cada empleado con el marcador [[EMPLEADO:ID]], por ejemplo
> [[EMPLEADO:21]]. Usa exclusivamente IDs devueltos por las herramientas.
> No solicites ni inventes nombres.

También se reconocen referencias anteriores como Empleado #21 o empleado 21.
Las referencias desconocidas o fuera del alcance se conservan sin nombre.
No se requieren cambios de base de datos. No reenviar al modelo los informes
ya enriquecidos; el texto de una pregunta se envía tal como lo escribe el usuario.