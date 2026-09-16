import React, { useEffect, useMemo, useState } from 'react';
import { Bot, BookOpen, Database, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react';
import { askAssistant, rebuildAssistantIndex } from '../lib/ragApi';
import { supabase } from '../lib/supabase';

const suggestions = [
  '¿Cómo se realiza la flexión de rodilla?',
  '¿Puedo aumentar las repeticiones por mi cuenta?',
  '¿Qué recomienda en general la OMS sobre actividad física?',
  '¿Qué hago si siento dolor durante un ejercicio?'
];

export default function Assistant({ profile }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(profile?.role === 'paciente' ? profile.id : '');
  const [indexStatus, setIndexStatus] = useState('');
  const isStaff = profile?.role === 'admin' || profile?.role === 'kinesiologo';

  useEffect(() => {
    if (!isStaff) return;
    async function loadPatients() {
      const { data, error: patientError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'paciente')
        .eq('active', true)
        .order('full_name');
      if (!patientError) setPatients(data || []);
    }
    loadPatients();
  }, [isStaff]);

  const apiHistory = useMemo(() => messages
    .filter((message) => message.kind === 'user' || message.kind === 'assistant')
    .slice(-6)
    .map((message) => ({ role: message.kind, content: message.content })), [messages]);

  async function sendQuestion(value = question) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion || loading) return;
    setError('');
    setQuestion('');
    setMessages((current) => [...current, { kind: 'user', content: cleanQuestion }]);
    setLoading(true);
    try {
      const response = await askAssistant({
        question: cleanQuestion,
        patientId: isStaff ? patientId : profile.id,
        history: apiHistory
      });
      setMessages((current) => [...current, {
        kind: 'assistant',
        content: response.answer,
        sources: response.sources,
        warning: response.warning,
        trace: response.trace
      }]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function rebuildIndex() {
    setIndexStatus('Indexando fuentes…');
    setError('');
    try {
      const response = await rebuildAssistantIndex();
      setIndexStatus(`Índice actualizado: ${response.chunks_indexed} fragmentos.`);
    } catch (requestError) {
      setIndexStatus('');
      setError(requestError.message);
    }
  }

  return (
    <div className={`assistant-page ${profile?.role === 'paciente' ? 'patient-friendly-page' : ''}`}>
      <div className="page-title assistant-title">
        <div>
          <span className="section-kicker">LLM + RAG CON FUENTES</span>
          <h1>SRD Assist</h1>
          <p>Consulta información de rehabilitación sin reemplazar la evaluación de tu kinesiólogo.</p>
        </div>
        {isStaff && (
          <button className="secondary-button" onClick={rebuildIndex} disabled={loading}>
            <RefreshCw size={17} /> Actualizar fuentes
          </button>
        )}
      </div>

      <div className="assistant-safety-note">
        <ShieldCheck size={21} />
        <div><strong>Respuesta informativa y trazable</strong><span>No entrega diagnósticos ni modifica tratamientos. Revisa siempre las fuentes.</span></div>
      </div>

      {isStaff && (
        <label className="assistant-patient-select">
          <span><UserRound size={17} /> Contexto de paciente (opcional)</span>
          <select value={patientId} onChange={(event) => setPatientId(event.target.value)}>
            <option value="">Solo información general</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}
          </select>
        </label>
      )}

      {indexStatus && <div className="alert success">{indexStatus}</div>}
      {error && <div className="alert error">{error}</div>}

      <section className="assistant-chat" aria-live="polite">
        {messages.length === 0 ? (
          <div className="assistant-welcome">
            <div className="assistant-bot-icon"><Bot size={34} /></div>
            <h2>¿Qué necesitas consultar?</h2>
            <p>Las respuestas se construyen desde documentos internos de SRD y fuentes externas oficiales.</p>
            <div className="assistant-suggestions">
              {suggestions.map((item) => (
                <button key={item} onClick={() => sendQuestion(item)}>{item}</button>
              ))}
            </div>
          </div>
        ) : messages.map((message, index) => (
          <article key={`${message.kind}-${index}`} className={`assistant-message ${message.kind}`}>
            <div className="assistant-message-label">{message.kind === 'user' ? 'Tú' : 'SRD Assist'}</div>
            <p>{message.content}</p>
            {message.warning && <div className="assistant-warning">{message.warning}</div>}
            {message.sources?.length > 0 && (
              <details className="assistant-sources">
                <summary><BookOpen size={16} /> Ver {message.sources.length} fuentes recuperadas</summary>
                {message.sources.map((source, sourceIndex) => (
                  <div className="assistant-source" key={`${source.title}-${sourceIndex}`}>
                    <strong>[S{sourceIndex + 1}] {source.title}</strong>
                    <span>{source.source_type === 'external' ? 'Fuente externa' : source.source_type === 'clinical_record' ? 'Registro autorizado' : 'Fuente interna'}</span>
                    <p>{source.excerpt}</p>
                    {source.url && <a href={source.url} target="_blank" rel="noreferrer">Abrir fuente oficial</a>}
                  </div>
                ))}
                <small className="assistant-trace"><Database size={14} /> {message.trace.retrieved_documents} documentos · {message.trace.elapsed_ms} ms · intención: {message.trace.intent} · traza: {message.trace.trace_id.slice(0, 8)}</small>
              </details>
            )}
          </article>
        ))}
        {loading && <div className="assistant-thinking"><Bot size={18} /> Buscando en fuentes autorizadas…</div>}
      </section>

      <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}>
        <textarea
          rows="2"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Escribe una consulta sobre ejercicios, planes o recomendaciones generales…"
          maxLength="1000"
          disabled={loading}
        />
        <button className="primary-button" disabled={loading || question.trim().length < 2}>
          <Send size={18} /> Enviar
        </button>
      </form>
    </div>
  );
}
