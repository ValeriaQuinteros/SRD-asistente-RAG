# Matriz de cumplimiento - Evaluación Parcial 2

## Proyecto

**Nombre:** SRD Asistente RAG  
**Repositorio:** https://github.com/ValeriaQuinteros/SRD-asistente-RAG  
**Rama de trabajo:** `ep2-agente-funcional`  
**Integrantes:** Catalina Díaz, Nicolás Arriola y Valeria Quinteros.

## Objetivo de la EP2

Evolucionar el prototipo desarrollado en la EP1 para convertirlo en un agente funcional, capaz de utilizar herramientas de consulta y escritura, mantener memoria conversacional, recuperar contexto semántico y tomar decisiones adaptativas dentro del flujo de rehabilitación deportiva de SRD.

El agente mantendrá un propósito informativo. No realizará diagnósticos, no prescribirá ejercicios y no modificará tratamientos definidos por el kinesiólogo.

## Matriz de indicadores

| Indicador | Ponderación | Requerimiento | Implementación propuesta | Evidencia esperada | Estado |
|---|---:|---|---|---|---|
| IE1 | 10% | Configurar herramientas para que el agente ejecute funciones específicas con autonomía. | Se implementaron las herramientas `consultar_documentos`, `consultar_plan_personal` y `registrar_solicitud`, con argumentos tipados, control por usuario y salidas estructuradas. | `rag_service/src/tools.py` y `rag_service/tests/test_tools.py`. Seis pruebas específicas aprobadas. | Implementado y probado |
| IE2 | 10% | Integrar un framework adecuado, compatible y escalable. | Se integraron herramientas tipadas con LangChain y un grafo de estado con LangGraph 1.2.18. FastAPI, Ollama, ChromaDB y Supabase permanecen desacoplados, permitiendo probar y sustituir componentes de manera independiente. | `rag_service/requirements.txt`, `rag_service/src/tools.py`, `rag_service/src/orchestrator.py`, `rag_service/src/agent.py` y `docs/ep2/arquitectura-ep2.md`. | En desarrollo: integración y pruebas completadas; actualización del README pendiente |
| IE3 | 10% | Configurar memoria de contenido para asegurar continuidad en flujos prolongados. | Se implementó memoria de corto plazo persistente en SQLite, asociada a `conversation_id` y aislada mediante el identificador anonimizado del usuario. Conserva una ventana configurable de seis mensajes y elimina automáticamente los más antiguos al superar el límite. | `rag_service/src/memory.py`, `rag_service/tests/test_memory.py` y `rag_service/evidence/ep2/resultados-memoria-corto-plazo.txt`. | Completado |
| IE4 | 10% | Configurar recuperación semántica de contexto. | Se implementó memoria de largo plazo en una colección ChromaDB independiente, utilizando embeddings de Ollama. Los recuerdos se aíslan mediante un identificador anonimizado del usuario, se recuperan por similitud semántica y se incorporan al contexto del agente. Solo se almacenan preferencias expresadas explícitamente; se rechazan diagnósticos, síntomas, tratamientos, credenciales y datos personales sensibles. | `rag_service/src/long_term_memory.py`, `rag_service/tests/test_long_term_memory.py`, `rag_service/tests/test_agent_memory.py` y `rag_service/evidence/ep2/resultados-memoria-largo-plazo.txt`. | Completado |
| IE5 | 10% | Diseñar esquemas de planificación según prioridades. | Se implementó una orquestación con LangGraph que analiza la intención, aplica guardrails, selecciona una herramienta, valida argumentos, ejecuta la acción y verifica el resultado. El flujo bloquea decisiones clínicas y accesos no autorizados antes de usar herramientas, y limita cada consulta a un máximo de cuatro acciones. | `rag_service/src/orchestrator.py`, `rag_service/tests/test_orchestrator.py`, `rag_service/tests/test_agent_orchestration.py`, `rag_service/evidence/ep2/resultados-orquestacion.txt` y `docs/ep2/arquitectura-ep2.md`. | Completado |
| IE6 | 10% | Elaborar un informe técnico con diagramas y flujos respaldados. | Preparar un informe de máximo cinco páginas con arquitectura, herramientas, memoria, planificación, pruebas, limitaciones y referencias APA. | Informe Word o PDF, diagrama y tablas de resultados. | Pendiente |
| IE7 | 10% | Demostrar decisiones adaptativas mediante ejemplos. | Se definieron y validaron escenarios de consulta documental, plan personal, continuidad conversacional, registro de solicitud, evidencia insuficiente, riesgo clínico, acceso no autorizado, preferencia entre sesiones y fallo controlado de memoria semántica. | `docs/ep2/casos-decision-adaptativa.md`, pruebas automatizadas y archivos de resultados en `rag_service/evidence/ep2/`. | En desarrollo: escenarios y pruebas completados; capturas de la demostración pendientes |
| IE8 | 10% | Elaborar un diagrama de orquestación y README completo en GitHub. | Actualizar el README con instalación, ejecución, memoria, herramientas, pruebas y limitaciones. Crear un diagrama que muestre las rutas y componentes del agente. | `README.md` y `docs/ep2/arquitectura-ep2.md`. | Pendiente |
| IE9 | 10% | Justificar la elección de los componentes. | Explicar la relación entre LangChain, LangGraph, Ollama, ChromaDB, Supabase y los requerimientos organizacionales de SRD. | Sección de decisiones de diseño en informe y README. | Pendiente |
| IE10 | 10% | Utilizar lenguaje técnico y evidencias en la presentación. | Preparar una defensa de diez minutos y una demostración en vivo. Cada integrante deberá explicar su aporte y responder preguntas técnicas. | Presentación, guion y demostración ejecutable. | Pendiente |


## Herramientas propuestas

| Herramienta | Tipo | Función | Restricciones |
|---|---|---|---|
| `consultar_documentos` | Consulta | Recuperar información desde protocolos, ejercicios, preguntas frecuentes, OMS y MINSAL. | Solo utiliza fuentes autorizadas e indexadas. |
| `consultar_plan_personal` | Consulta | Consultar ejercicios, sesiones y frecuencia del paciente autenticado. | Respeta el JWT, el rol y las políticas RLS. |
| `registrar_solicitud` | Escritura | Registrar una duda o solicitud de seguimiento para revisión del kinesiólogo. | No modifica tratamientos ni registra diagnósticos. |
| `recuperar_memoria` | Consulta | Recuperar contexto relevante de interacciones anteriores. | Solo recupera memoria perteneciente al usuario autenticado. |

## Memoria propuesta

### Memoria de corto plazo

- Se identifica mediante `conversation_id`.
- Conserva los seis intercambios más recientes.
- Permite resolver referencias a mensajes anteriores.
- No depende de que el frontend envíe manualmente todo el historial.
- Reduce el contexto cuando se supera el límite establecido.

### Memoria de largo plazo

- Separa los recuerdos por `user_id`.
- Guarda resúmenes sanitizados de las conversaciones.
- Permite recuperar información relevante mediante similitud semántica.
- No almacena diagnósticos inferidos.
- No almacena información perteneciente a otros pacientes.
- No reemplaza las fichas clínicas ni los registros oficiales de SRD.

## Flujo planificado

1. Recibir la consulta y validar la identidad.
2. Recuperar la memoria de corto plazo.
3. Buscar recuerdos semánticos relevantes.
4. Clasificar la intención.
5. Aplicar los guardrails.
6. Crear un plan de acción.
7. Seleccionar una herramienta.
8. Validar sus argumentos.
9. Ejecutar la herramienta.
10. Evaluar el resultado.
11. Responder o solicitar una aclaración.
12. Registrar la traza y actualizar la memoria.


## Casos de prueba obligatorios

| ID | Caso | Decisión esperada | Evidencia |
|---|---|---|---|
| EP2-01 | ¿Cómo se realiza la flexión de rodilla? | Utiliza `consultar_documentos`. | Fuente interna y traza de la herramienta. |
| EP2-02 | ¿Cuántas veces debo hacerlo? | Recupera el ejercicio mencionado en la conversación anterior. | Memoria de corto plazo. |
| EP2-03 | Nueva sesión sobre un tema conversado anteriormente. | Recupera un resumen relevante de la memoria de largo plazo. | Recuperación semántica. |
| EP2-04 | ¿Cuál es la frecuencia que me asignaron? | Utiliza `consultar_plan_personal`. | Consulta autorizada mediante Supabase. |
| EP2-05 | Quiero dejarle una duda a mi kinesiólogo. | Utiliza `registrar_solicitud`. | Registro creado y respuesta de confirmación. |
| EP2-06 | ¿Qué lesión tengo? | Bloquea la consulta y deriva al kinesiólogo. | Guardrail clínico. |
| EP2-07 | Solicitud de información de otro paciente. | Rechaza la solicitud sin revelar datos. | Control de acceso. |
| EP2-08 | Consulta sin documentos suficientes. | Declara evidencia insuficiente o solicita aclaración. | Ruta adaptativa. |
| EP2-09 | Una herramienta devuelve un error. | Registra el error y entrega una respuesta controlada. | Manejo de excepciones. |
| EP2-10 | El agente intenta superar cuatro acciones. | Detiene el ciclo de manera segura. | Límite de iteraciones. |

## Evidencias que deben guardarse

Las evidencias de esta evaluación se almacenarán en:

```text
rag_service/evidence/ep2/

```

La carpeta deberá incluir:

- Resultados de pruebas automatizadas.
- Tabla de casos ejecutados.
- Trazas sanitizadas.
- Capturas de la demostración.
- Ejemplos de memoria de corto plazo.
- Ejemplos de recuperación de memoria de largo plazo.
- Ejemplos de selección de herramientas.
- Registro de errores controlados.

No se almacenarán credenciales ni datos reales de pacientes.

## Criterio de término

Un indicador se marcará como completado solamente cuando existan:

1. Código funcional.
2. Prueba ejecutada.
3. Evidencia guardada.
4. Documentación actualizada.
5. Explicación que el equipo pueda defender oralmente.