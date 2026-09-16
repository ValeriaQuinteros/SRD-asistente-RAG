# SRD Assist RAG

Repositorio académico independiente, creado a partir de una copia de SRD, para diseñar y evaluar una solución con agentes LLM y recuperación aumentada (RAG). Los cambios de este proyecto no deben integrarse al repositorio oficial `SRD-rehabilitacion`.

La copia conserva la interfaz de rehabilitación como contexto organizacional y agrega un asistente informativo para pacientes y kinesiólogos. El prototipo no realiza diagnósticos ni modifica tratamientos.

Incluye **SRD Assist**, un módulo académico LLM + RAG que recupera información interna y fuentes oficiales externas, conserva trazabilidad y aplica restricciones clínicas. Su backend se mantiene aislado en `rag_service/` para no afectar el funcionamiento principal de React/Supabase.

## Stack

- React + Vite
- Supabase Auth
- PostgreSQL + Row Level Security (RLS)
- Supabase Edge Function para crear usuarios sin exponer la `service_role`
- CSS responsive
- LangChain + FastAPI + ChromaDB
- Ollama local (`llama3.2:3b` y `nomic-embed-text`)
- Preparada para integrar Arduino/ESP32 mediante `sensor_readings`

## 1. Requisitos

Instala Node.js LTS y crea un proyecto gratuito en Supabase.

## 2. Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ve a **SQL Editor**.
3. Ejecuta `supabase/schema.sql` completo.
4. En **Authentication > Providers > Email**, habilita Email/Password.
5. Para una demo académica puedes desactivar temporalmente la confirmación de correo.
6. Ve a **Project Settings > API** y copia:
   - Project URL
   - anon/public key

## 3. Crear el archivo `.env`

Copia `.env.example` como `.env`:

```bash
cp .env.example .env
```

En Windows también puedes simplemente copiar/pegar el archivo y renombrarlo a `.env`.

Completa:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 4. Crear el primer administrador

La forma más sencilla para la primera demo:

1. En Supabase ve a Authentication > Users.
2. Crea un usuario con email y contraseña.
3. Copia su UUID.
4. En SQL Editor ejecuta:

```sql
update public.profiles
set role = 'admin', full_name = 'Administrador SRD'
where id = 'UUID_DEL_USUARIO';
```

## 5. Edge Function para registrar usuarios

La carpeta `supabase/functions/create-user` contiene una función segura que usa `SUPABASE_SERVICE_ROLE_KEY` solo del lado servidor.

Con Supabase CLI:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
supabase functions deploy create-user
```

Nunca pongas la service role key en `.env` del frontend ni la subas a GitHub.

## 6. Ejecutar localmente

```bash
npm install
npm run dev
```

Abre la dirección que indique Vite, normalmente:

`http://localhost:5173`

## 7. Ejecutar SRD Assist

Consulta las instrucciones completas en [`rag_service/README.md`](rag_service/README.md). El resumen es:

```powershell
cd rag_service
py -3.10 -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

También debes instalar Ollama y descargar `llama3.2:3b` y `nomic-embed-text`. Agrega `VITE_RAG_API_URL=http://localhost:8000` al `.env` del frontend.

## 8. Subir a GitHub

```bash
git init
git add .
git commit -m "Primer prototipo SRD"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/srd-rehabilitacion-web.git
git push -u origin main
```

## 9. Publicar en Vercel

1. Entra a Vercel.
2. Importa el repositorio de GitHub.
3. Agrega las mismas variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

## Roles

### Administrador
- Gestiona usuarios.
- Acceso global a pacientes, ejercicios y sesiones.

### Kinesiólogo
- Ve sus pacientes.
- Crea/edita/desactiva ejercicios.
- Configura hasta 3 sensores por ejercicio.
- Define rangos esperados.
- Asigna ejercicios.
- Supervisa sesiones y lecturas.

### Paciente
- Ve solo sus ejercicios asignados.
- Ve sus sesiones.
- Puede iniciar una sesión y registrar datos.

## Integración Arduino

La tabla `sensor_readings` está preparada para recibir:

- `session_id`
- `exercise_id`
- `sensor_id`
- `value`
- `unit`
- `recorded_at`

La próxima etapa puede reemplazar el simulador de lecturas por una API/Edge Function conectada a ESP32/Arduino.
