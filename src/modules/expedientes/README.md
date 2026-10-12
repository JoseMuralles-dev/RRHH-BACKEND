# Archivos de expedientes laborales

Ambas rutas requieren `Authorization: Bearer <token>`, igual que el resto del módulo:

- `GET /expedientes/:idExpediente/documentos/:idDocumento/previsualizar`: contenido PDF, JPG o PNG con `Content-Disposition: inline`.
- `GET /expedientes/:idExpediente/documentos/:idDocumento/descargar`: contenido con `Content-Disposition: attachment` y el nombre original (UTF-8).

Los identificadores se obtienen del expediente y sus documentos en `GET /expedientes/empleado/:idEmpleado`. Se verifica que el documento pertenezca al expediente y ambos estén activos. Un documento o archivo inexistente devuelve 404; un tipo no compatible con previsualización devuelve 400.

Para integrar los botones en el frontend, solicitar la ruta con el token y respuesta de tipo `blob`. Crear una URL con `URL.createObjectURL(blob)` y usarla en un visor PDF (`iframe`) o de imágenes (`img`). Para descargar, usar un enlace con esa URL y el atributo `download` con `nombreOriginal`. Revocar la URL con `URL.revokeObjectURL` cuando deje de usarse. Un enlace directo a la API no agrega el encabezado Bearer. CORS expone `Content-Disposition` si se necesita leer el nombre desde la respuesta.

Los archivos se entregan sin caché y sin publicar la carpeta de almacenamiento. Las rutas conservan la política de acceso del módulo (`JwtAuthGuard`).
