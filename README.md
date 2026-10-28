SRD Asistente RAG

Repositorio académico independiente creado a partir de una copia de SRD Rehabilitación. Su propósito es diseñar, implementar y evaluar un agente basado en un modelo de lenguaje, herramientas y recuperación aumentada de información (RAG), orientado a responder consultas de pacientes y kinesiólogos.

Este repositorio se mantiene separado del proyecto oficial SRD-rehabilitacion. De esta manera, las pruebas del agente, la configuración del modelo y los cambios experimentales no afectan el funcionamiento de la plataforma original.

El prototipo tiene un propósito informativo. No realiza diagnósticos, no prescribe ejercicios, no modifica tratamientos y no reemplaza el criterio de un kinesiólogo u otro profesional de la salud.

Objetivo

Desarrollar un agente capaz de recuperar información desde fuentes internas de SRD y documentos externos oficiales, utilizar herramientas según la intención de la consulta y generar respuestas contextualizadas, trazables y adaptadas al perfil del usuario.

La solución permite:

Responder utilizando información recuperada desde fuentes autorizadas.

Mostrar las fuentes utilizadas en cada respuesta.

Diferenciar información general de indicaciones asignadas a un paciente.

Consultar el plan personal respetando el usuario autenticado y su rol.

Registrar solicitudes para revisión del kinesiólogo sin modificar tratamientos.

Mantener continuidad mediante memoria conversacional de corto plazo.

Recuperar preferencias explícitas mediante memoria semántica de largo plazo.

Rechazar solicitudes de diagnóstico, decisiones clínicas o acceso a datos ajenos.

Registrar trazabilidad anonimizada para apoyar la evaluación del prototipo.

Tecnologías utilizadas

React y Vite para la interfaz web.

Supabase Auth para la autenticación.

PostgreSQL y Row Level Security (RLS) para la protección de datos.

FastAPI para exponer el servicio del agente.

LangChain para definir herramientas, prompts y componentes RAG.

LangGraph para administrar el estado, las rutas y el límite de acciones.

ChromaDB para recuperar documentos y preferencias mediante similitud semántica.

SQLite para la memoria conversacional de corto plazo.

Ollama para ejecutar localmente el modelo de lenguaje y los embeddings.

llama3.2:3b como modelo generativo.

nomic-embed-text para generar embeddings.

Pytest para ejecutar las pruebas automatizadas.

Todas las herramientas seleccionadas cuentan con alternativas gratuitas y permiten desarrollar el prototipo sin contratar una API de pago.

Arquitectura de la EP2

flowchart TD
    UI["Interfaz React"] --> API["API FastAPI"]
    API --> AG["Agente SRD"]
    AG --> ORQ["LangGraph"]
    ORQ --> TOOLS["Herramientas LangChain"]
    TOOLS --> DATA["RAG, Supabase y solicitudes"]
    AG --> MEM["Memoria corta y semántica"]
    AG --> LLM["Ollama local"]

El diagrama detallado, las rutas y los controles se encuentran en docs/ep2/arquitectura-ep2.md.

Flujo del agente

Recibe la consulta y valida al usuario autenticado.

Recupera hasta seis mensajes recientes mediante conversation_id.

Busca preferencias semánticas pertenecientes al mismo usuario.

Analiza la intención de la consulta.

Aplica guardrails antes de ejecutar herramientas.

Selecciona una ruta mediante LangGraph.

Valida los argumentos tipados de la herramienta.

Ejecuta como máximo cuatro acciones por consulta.

Verifica el estado devuelto por la herramienta.

Genera una respuesta respaldada o una salida controlada.

Registra trazabilidad y actualiza las memorias autorizadas.

Herramientas del agente

Herramienta

Tipo

Función

Restricciones principales

consultar_documentos

Consulta

Recupera ejercicios, protocolos, preguntas frecuentes y fuentes oficiales.

Solo utiliza documentos indexados y autorizados para el rol.

consultar_plan_personal

Consulta

Recupera ejercicios, sesiones y frecuencia asignada.

Respeta JWT, rol y políticas RLS; un paciente no puede consultar a otro.

registrar_solicitud

Escritura

Registra una duda o solicitud para revisión del kinesiólogo.

No modifica diagnósticos, ejercicios, frecuencias ni tratamientos.

Las herramientas reciben argumentos validados con Pydantic y devuelven resultados estructurados con estados como success, created, not_found, forbidden o insufficient_evidence.

Memoria conversacional

Memoria de corto plazo

Se identifica mediante conversation_id.

Utiliza SQLite local.

Conserva una ventana configurable de seis mensajes.

Elimina los mensajes más antiguos al superar el límite.

Separa las conversaciones mediante un hash del usuario.

Permite resolver referencias a mensajes anteriores.

Memoria de largo plazo

Utiliza una colección independiente de ChromaDB.

Recupera preferencias mediante similitud semántica.

Aísla los recuerdos mediante un identificador anonimizado del usuario.

Solo guarda preferencias expresadas explícitamente.

Rechaza diagnósticos, síntomas, tratamientos, credenciales y datos personales sensibles.

Si el almacén semántico falla, el agente continúa sin inventar recuerdos.

La memoria no reemplaza la ficha clínica ni los registros oficiales de SRD.

Decisiones adaptativas

El agente selecciona una ruta según la consulta:

Tipo de consulta

Ruta adoptada

Información general

Recuperar documentos autorizados.

Ejercicios o sesiones asignadas

Consultar el plan personal.

Solicitud de seguimiento

Registrar una solicitud sanitizada.

Decisión clínica

Bloquear y derivar al profesional.

Datos de otro paciente

Bloquear antes de ejecutar herramientas.

Sin fuentes suficientes

Reconocer la falta de evidencia.

Error de herramienta

Entregar una respuesta controlada.

Los escenarios y su relación con las pruebas están documentados en docs/ep2/casos-decision-adaptativa.md.

Estructura del repositorio

SRD-Asistente-RAG/
├── docs/
│   ├── ep2/
│   │   ├── arquitectura-ep2.md
│   │   ├── casos-decision-adaptativa.md
│   │   └── matriz-rubrica-ep2.md
│   └── srd-assist/
│       ├── arquitectura.md
│       ├── matriz-rubrica.md
│       └── prompts-y-optimizacion.md
├── public/
├── rag_service/
│   ├── data/
│   │   ├── external/
│   │   └── internal/
│   ├── evidence/
│   │   └── ep2/
│   ├── src/
│   │   ├── agent.py
│   │   ├── long_term_memory.py
│   │   ├── memory.py
│   │   ├── orchestrator.py
│   │   └── tools.py
│   ├── tests/
│   ├── .env.example
│   ├── README.md
│   └── requirements.txt
├── src/
├── supabase/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── pytest.ini
└── vite.config.js

Fuentes de información

Fuentes internas

Catálogo de ejercicios de demostración.

Protocolo informativo de SRD.

Preguntas frecuentes para pacientes y kinesiólogos.

Fuentes externas

Orientaciones de actividad física del Ministerio de Salud de Chile.

Directrices sobre actividad física de la Organización Mundial de la Salud.

Información personal

Las asignaciones y sesiones de cada paciente se consultan mediante Supabase. Esta información no se almacena como documento RAG y su acceso debe respetar la autenticación y las políticas RLS.

Los datos incluidos en el repositorio son académicos o de demostración. No se deben publicar datos clínicos reales.

Requisitos

Antes de ejecutar el proyecto se necesita:

Node.js LTS.

Python 3.10 o superior.

Ollama.

Git.

Un proyecto gratuito de Supabase.

Al menos 8 GB de memoria RAM recomendados para ejecutar el modelo local.

Configurar el frontend

Copia .env.example y renombra la copia como .env:

Copy-Item .env.example .env

Completa las siguientes variables:

VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANONIMA
VITE_RAG_API_URL=http://localhost:8000

No publiques .env ni utilices la clave service_role en el frontend.

Configurar Supabase

Crea un proyecto gratuito en Supabase.

Ingresa a SQL Editor.

Ejecuta supabase/schema.sql.

Ejecuta supabase/gamification-v3.sql si se utilizará el módulo de recompensas.

En Authentication > Providers > Email, habilita correo y contraseña.

Copia la URL del proyecto y la clave pública o anon key.

Agrega esos valores al archivo .env.

Crear el primer administrador

Ingresa a Authentication > Users.

Crea un usuario con correo y contraseña.

Copia el UUID del usuario.

Ejecuta en SQL Editor:

UPDATE public.profiles
SET role = 'admin',
    full_name = 'Administrador SRD'
WHERE id = 'UUID_DEL_USUARIO';

Ejecutar el frontend

Desde la carpeta principal:

npm install
npm run dev

La aplicación estará disponible normalmente en http://localhost:5173.

Para comprobar la compilación de producción:

npm run build

Configurar el servicio del agente

Desde la carpeta principal:

cd rag_service
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env

Completa .env con una configuración similar a la siguiente:

SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_CLAVE_ANONIMA
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
EMBEDDING_MODEL=nomic-embed-text
CHROMA_PATH=./vectorstore
ALLOWED_ORIGINS=http://localhost:5173
TOP_K=4
ENABLE_LLM_CLASSIFIER=true
ENABLE_LLM_VERIFIER=false
MEMORY_DB_PATH=evidence/runtime/conversation_memory.sqlite3
MEMORY_WINDOW_SIZE=6
DEMO_MODE=false

DEMO_MODE debe permanecer desactivado cuando se trabaje con autenticación y datos de Supabase.

Instalar los modelos de Ollama

Después de instalar Ollama, ejecuta:

ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama serve

Ejecutar el servicio del agente

Desde rag_service, con el entorno virtual activo:

uvicorn src.main:app --reload --port 8000

La documentación de la API estará disponible en http://localhost:8000/docs.

La primera indexación se realiza mediante:

POST /api/index

Después de indexar, las consultas se realizan mediante:

POST /api/chat

El cuerpo de una consulta incluye question, patient_id, conversation_id e history como respaldo temporal.

Ejecutar las pruebas

Desde la raíz del repositorio, con el entorno virtual activo:

python -m pytest -q

Resultado validado durante el desarrollo de la EP2:

65 passed

También se puede comprobar el frontend:

npm run build

Las evidencias específicas se encuentran en:

rag_service/evidence/ep2/resultados-memoria-corto-plazo.txt

rag_service/evidence/ep2/resultados-memoria-largo-plazo.txt

rag_service/evidence/ep2/resultados-orquestacion.txt

Justificación de los componentes

Componente

Justificación

LangChain

Permite definir herramientas con esquemas tipados y mantener separados los prompts, el modelo y las fuentes.

LangGraph

Representa el flujo como estados y rutas verificables, controla la ejecución y limita las acciones.

FastAPI

Expone una API tipada, documentada y desacoplada de la interfaz React.

Ollama

Permite ejecutar modelos localmente, sin costo por consulta y con mayor control del entorno académico.

ChromaDB

Proporciona recuperación vectorial persistente para documentos y preferencias semánticas.

SQLite

Entrega persistencia simple y gratuita para el historial reciente sin depender de un servicio externo.

Supabase

Reutiliza autenticación, PostgreSQL y RLS para proteger el contexto personal de los pacientes.

Pydantic

Valida las entradas de la API, las herramientas y la configuración antes de ejecutar acciones.

La separación de componentes permite probar el agente de manera aislada y reemplazar una tecnología sin reescribir toda la solución.

Seguridad y límites

La API valida la identidad mediante Supabase.

Los permisos se obtienen desde el backend, no desde instrucciones del usuario.

Las políticas RLS limitan el acceso a información personal.

Los datos personales no se indexan como documentos RAG.

La memoria corta se limita a seis mensajes.

La memoria larga solo almacena preferencias explícitas no sensibles.

Los guardrails bloquean diagnósticos, cambios de tratamiento y datos ajenos.

El orquestador permite como máximo cuatro acciones por consulta.

Las respuestas deben utilizar contexto recuperado y mostrar sus fuentes.

La falta de evidencia produce una respuesta controlada.

Las decisiones clínicas se derivan al kinesiólogo responsable.

Las trazas utilizan identificadores anonimizados.

Limitaciones

El proyecto corresponde a un prototipo académico.

Utiliza fuentes acotadas y datos de demostración.

La calidad depende de la vigencia y calidad de los documentos.

Un modelo local pequeño puede interpretar incorrectamente consultas ambiguas.

RAG reduce, pero no elimina, el riesgo de respuestas incorrectas.

La selección de rutas utiliza reglas controladas y puede requerir más ejemplos lingüísticos.

La memoria semántica depende de Ollama y de la disponibilidad del modelo de embeddings.

El prototipo no ha sido validado como software o dispositivo médico.

El rendimiento depende de los recursos del computador.

La integración con el sistema SRD oficial está fuera del alcance de este repositorio.

Integración futura con SRD

En una etapa futura, el prototipo podrá consultar información registrada por SRD y sus dispositivos de monitoreo, incluyendo datos procesados mediante Raspberry Pi. Esta integración se evaluará únicamente en la copia académica y no se incorporará directamente al repositorio oficial sin autorización.

Repositorios

Prototipo académico:

https://github.com/ValeriaQuinteros/SRD-asistente-RAG

Proyecto oficial de SRD Rehabilitación:

https://github.com/ValeriaQuinteros/SRD-rehabilitacion

Los cambios de este prototipo no deben fusionarse con el repositorio oficial sin la autorización previa del equipo responsable.

Integrantes

Catalina Díaz.

Nicolás Arriola.

Valeria Quinteros.

Estado del proyecto

La rama ep2-agente-funcional contiene herramientas de consulta y escritura, memoria de corto y largo plazo, recuperación semántica, planificación con LangGraph, guardrails y pruebas automatizadas. Antes de la entrega definitiva todavía deben completarse las capturas de la demostración, el informe técnico y la presentación oral.