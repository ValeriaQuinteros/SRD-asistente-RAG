import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';

async function authenticatedRequest(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Tu sesión venció. Inicia sesión nuevamente.');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || 'No fue posible comunicarse con SRD Assist.');
  return payload;
}

export function askAssistant({ question, patientId, history }) {
  return authenticatedRequest('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ question, patient_id: patientId || null, history })
  });
}

export function rebuildAssistantIndex() {
  return authenticatedRequest('/api/index', { method: 'POST' });
}
