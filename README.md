# SRD Asistente RAG

Repositorio académico independiente creado a partir de una copia de SRD Rehabilitación. Su propósito es diseñar, implementar y evaluar un agente basado en un modelo de lenguaje y recuperación aumentada de información (RAG), orientado a responder consultas de pacientes y kinesiólogos.

Este repositorio se mantiene separado del proyecto oficial `SRD-rehabilitacion`. De esta manera, las pruebas del agente, la configuración del modelo y los cambios experimentales no afectan el funcionamiento de la plataforma original.

El prototipo tiene un propósito informativo. No realiza diagnósticos, no prescribe ejercicios, no modifica tratamientos y no reemplaza el criterio de un kinesiólogo u otro profesional de la salud.

## Objetivo

Desarrollar un agente que pueda recuperar información desde fuentes internas de SRD y documentos externos oficiales, generando respuestas contextualizadas, trazables y adaptadas al perfil del usuario.

La solución debe:

* Responder utilizando información recuperada desde fuentes autorizadas.
* Mostrar las fuentes utilizadas en cada respuesta.
* Diferenciar información general de indicaciones asignadas a un paciente.
* Rechazar solicitudes de diagnóstico o modificación de tratamientos.
* Evitar el acceso a información perteneciente a otros pacientes.
* Registrar datos básicos de trazabilidad para apoyar la evaluación del prototipo.

## Tecnologías utilizadas

* React y Vite para la interfaz web.
* Supabase Auth para la autenticación.
* PostgreSQL y Row Level Security para la protección de datos.
* FastAPI para exponer el servicio del agente.
* LangChain para organizar los prompts y el flujo RAG.
* ChromaDB para almacenar y recuperar fragmentos vectorizados.
* Ollama para ejecutar localmente el modelo de lenguaje.
* `llama3.2:3b` como modelo generativo.
* `nomic-embed-text` para generar embeddings.
* Pytest para ejecutar las pruebas.

Todas las herramientas seleccionadas cuentan con alternativas gratuitas y permiten desarrollar el prototipo sin contratar una API de pago.

## Estructura del repositorio

```text
SRD-Asistente-RAG/
├── docs/
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
│   ├── src/
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
```

## Fuentes de información

El pipeline considera tres tipos de información:

### Fuentes internas

* Catálogo de ejercicios de demostración.
* Protocolo informativo de SRD.
* Preguntas frecuentes para pacientes y kinesiólogos.

### Fuentes externas

* Orientaciones de actividad física del Ministerio de Salud de Chile.
* Directrices sobre actividad física de la Organización Mundial de la Salud.

### Información personal

Las asignaciones y sesiones de cada paciente se consultan mediante Supabase. Esta información no se almacena en ChromaDB y su acceso debe respetar la autenticación y las políticas RLS.

Los datos incluidos en el repositorio son académicos o de demostración. No se deben publicar datos clínicos reales.

## Requisitos

Antes de ejecutar el proyecto se necesita:

* Node.js LTS.
* Python 3.10 o superior.
* Ollama.
* Git.
* Un proyecto gratuito de Supabase.
* Al menos 8 GB de memoria RAM recomendados para ejecutar el modelo local.

## Configurar el frontend

Copia `.env.example` y renombra la copia como `.env`.

En Windows también puedes ejecutar:

```powershell
Copy-Item .env.example .env
```

Completa las siguientes variables:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANONIMA
VITE_RAG_API_URL=http://localhost:8000
```

No publiques el archivo `.env` ni utilices la clave `service_role` en el frontend.

## Configurar Supabase

1. Crea un proyecto gratuito en Supabase.
2. Ingresa a `SQL Editor`.
3. Ejecuta el archivo `supabase/schema.sql`.
4. Ejecuta `supabase/gamification-v3.sql` si se utilizará el módulo de recompensas.
5. En `Authentication > Providers > Email`, habilita la autenticación mediante correo y contraseña.
6. Copia la URL del proyecto y la clave pública o `anon key`.
7. Agrega esos valores al archivo `.env`.

### Crear el primer administrador

1. Ingresa a `Authentication > Users`.
2. Crea un usuario con correo y contraseña.
3. Copia el UUID del usuario.
4. Ejecuta lo siguiente en `SQL Editor`:

```sql
UPDATE public.profiles
SET role = 'admin',
    full_name = 'Administrador SRD'
WHERE id = 'UUID_DEL_USUARIO';
```

## Ejecutar el frontend

Desde la carpeta principal:

```powershell
npm install
npm run dev
```

La aplicación estará disponible normalmente en:

```text
http://localhost:5173
```

## Configurar el servicio RAG

Desde la carpeta principal del proyecto:

```powershell
cd rag_service
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Completa `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los mismos valores públicos utilizados por el frontend.

El archivo debe mantener una configuración similar a la siguiente:

```env
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
DEMO_MODE=false
```

`DEMO_MODE` debe permanecer desactivado cuando se trabaje con autenticación y datos de Supabase.

## Instalar los modelos de Ollama

Descarga e instala Ollama desde su sitio oficial. Después ejecuta:

```powershell
ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama serve
```

## Ejecutar el servicio RAG

Desde `rag_service`, con el entorno virtual activo:

```powershell
uvicorn src.main:app --reload --port 8000
```

La documentación interactiva de la API estará disponible en:

```text
http://localhost:8000/docs
```

La primera indexación debe realizarse mediante:

```text
POST /api/index
```

Esta operación debe ser solicitada por un usuario autorizado. Después de indexar los documentos, las consultas se realizan mediante:

```text
POST /api/chat
```

## Ejecutar las pruebas

Desde la carpeta `rag_service`:

```powershell
pytest -q
```

Los casos considerados para la evaluación están documentados en:

```text
rag_service/evidence/test_cases.md
```

Los resultados obtenidos deben registrarse en:

```text
rag_service/evidence/test_results.csv
```

Las evidencias deben permitir relacionar:

* Pregunta realizada.
* Intención identificada.
* Fragmentos recuperados.
* Fuentes utilizadas.
* Respuesta generada.
* Resultado esperado.
* Estado de la prueba.

## Seguridad y límites

* La API valida la identidad del usuario mediante Supabase.
* Los permisos deben obtenerse desde el backend y no desde instrucciones escritas por el usuario.
* Las políticas RLS limitan el acceso a información personal.
* Los datos personales no se guardan en la base vectorial.
* El historial conversacional se limita a los seis mensajes recientes.
* Los guardrails bloquean diagnósticos, modificaciones de tratamientos y solicitudes de datos ajenos.
* Las respuestas deben utilizar el contexto recuperado y mostrar sus fuentes.
* Cuando la evidencia sea insuficiente, el agente debe indicarlo en lugar de inventar información.
* Las decisiones clínicas deben ser derivadas al kinesiólogo responsable.

## Limitaciones

* El proyecto corresponde a un prototipo académico.
* Utiliza fuentes acotadas y datos de demostración.
* La calidad de las respuestas depende de la vigencia y calidad de los documentos.
* Un modelo local pequeño puede interpretar incorrectamente consultas ambiguas.
* El uso de RAG reduce, pero no elimina, el riesgo de respuestas incorrectas.
* El prototipo no ha sido validado como software o dispositivo médico.
* El rendimiento depende de los recursos disponibles en el computador.
* La integración con el sistema SRD oficial está fuera del alcance de este repositorio.

## Integración futura con SRD

En una etapa futura, el prototipo podrá consultar información registrada por SRD y sus dispositivos de monitoreo, incluyendo datos procesados mediante Raspberry Pi. Esta integración se evaluará únicamente en la copia académica y no se incorporará directamente al repositorio oficial.

## Repositorio

Repositorio del prototipo:

https://github.com/ValeriaQuinteros/SRD-asistente-RAG

Repositorio oficial de SRD Rehabilitación:

https://github.com/ValeriaQuinteros/SRD-rehabilitacion

Los cambios de este prototipo no deben fusionarse con el repositorio oficial sin la autorización previa del equipo responsable.

## Integrantes

* Catalina Díaz.
* Nicolás Arriola.
* Valeria Quinteros.

## Estado del proyecto

El repositorio corresponde a una versión académica en desarrollo. La estructura inicial, las fuentes de demostración, los prompts, el código del pipeline y los casos de prueba se encuentran disponibles. Los resultados definitivos deberán completarse después de ejecutar y validar el prototipo en el entorno local.
