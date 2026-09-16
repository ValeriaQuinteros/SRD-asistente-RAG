# SRD Assist RAG

Servicio independiente que integra LangChain, recuperación aumentada (RAG), Ollama y las reglas de acceso existentes de Supabase. No diagnostica ni modifica tratamientos.

## Requisitos

- Python 3.10 o superior
- Ollama
- 8 GB de RAM como mínimo para `llama3.2:3b`
- Proyecto Supabase de SRD configurado

## Instalación en Windows

```powershell
cd rag_service
py -3.10 -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
copy .env.example .env
```

Completa `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los mismos valores públicos del frontend. No uses la clave `service_role`.

Instala Ollama desde su sitio oficial y ejecuta:

```powershell
ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama serve
```

## Ejecución

Desde `rag_service`, con el entorno virtual activo:

```powershell
uvicorn src.main:app --reload --port 8000
```

Abre `http://localhost:8000/docs`. Inicia la web desde otra terminal con `npm run dev`.

La primera indexación puede descargar el modelo gratuito de embeddings. Un administrador o kinesiólogo debe usar `POST /api/index`; luego el chat estará disponible en `POST /api/chat`.

## Pruebas

```powershell
pytest -q
```

Las preguntas de evaluación están en `evidence/test_cases.md`. Registra la ejecución real en `evidence/test_results.csv` para demostrar la relación entre datos recuperados y respuestas.

## Seguridad

- La API valida el JWT con Supabase y obtiene el rol desde la base de datos.
- Las consultas a planes usan el JWT del usuario, por lo que se mantienen las políticas RLS.
- Los filtros críticos se ejecutan antes del LLM.
- El historial recibido se limita a seis mensajes.
- Las respuestas incluyen fuentes y metadatos de trazabilidad.
- `DEMO_MODE` está desactivado por defecto y no debe usarse en producción.

## Limitaciones

- Es un prototipo académico con fuentes acotadas.
- La exactitud depende de la calidad y vigencia de los documentos.
- Un modelo local pequeño puede interpretar incorrectamente consultas ambiguas.
- RAG reduce, pero no elimina, las alucinaciones.
- La solución no ha sido validada como dispositivo médico.
