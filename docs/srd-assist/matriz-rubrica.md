# Matriz de cumplimiento de la evaluación

| Indicador | Implementación | Evidencia |
|---|---|---|
| IE1 | Caso SRD, roles, problema, objetivos, alcance y restricciones | Informe y README principal |
| IE2 | Prompts de intención, reformulación, generación y verificación | `rag_service/src/prompts.py` |
| IE3 | Fuentes internas y externas, chunking, embeddings, Chroma y recuperación | `rag_service/data`, `rag_pipeline.py`, pruebas |
| IE4 | React, API, agente, Auth/RLS, Chroma, Ollama y trazabilidad | `arquitectura.md` y código |
| IE5 | Documentación técnica, tablas, esquema, pruebas y fuentes | `docs`, `rag_service/README.md`, `evidence` |
| IE6 | Comparación entre consulta, fragmentos, respuesta y resultado esperado | `evidence/test_results.csv` |
| IE7 | Diagrama con componentes e integración | `arquitectura.md` |
| IE8 | Decisiones vinculadas a privacidad, costo y objetivos | Defensa y redacción propia del equipo |
| IE9 | Ejemplos ejecutados y vocabulario técnico explicado | Presentación y demostración |

## Pendientes que requieren ejecución del equipo

- Completar `.env` sin publicar credenciales.
- Instalar Ollama y descargar los dos modelos.
- Construir el índice desde la interfaz.
- Ejecutar los ocho casos y completar resultados reales.
- Capturar evidencia visual.
- Escribir las conclusiones y justificaciones personales sin IA.
