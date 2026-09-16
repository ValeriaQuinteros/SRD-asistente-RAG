# Prompts y optimización

## Versión inicial

`Responde la pregunta del usuario sobre rehabilitación utilizando la información disponible.`

Esta versión se conserva como línea base para las pruebas comparativas. No define rol, fuentes, límites clínicos, privacidad ni formato.

## Versión optimizada

La versión ejecutable está en `rag_service/src/prompts.py`. Se separó en cuatro tareas:

1. Clasificación de intención con salida JSON.
2. Reformulación de preguntas dependientes del historial.
3. Generación restringida al contexto recuperado y citas `[S#]`.
4. Verificación opcional de respaldo antes de presentar el resultado.

## Variables

| Variable | Propósito |
|---|---|
| `role` | Adecuar el lenguaje y alcance al perfil validado |
| `user_id` | Delimitar el usuario autorizado |
| `history` | Resolver referencias en hasta seis mensajes |
| `context` | Entregar solo los fragmentos recuperados |
| `question` | Incluir la consulta original o reformulada |

El control crítico de identidad y permisos se realiza en código y RLS, no en el prompt.
