import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Gauge, History, Play, Radio, Save, StopCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageTitle } from './Dashboard';

export default function Sessions({ profile }) {
  if (profile.role === 'paciente') return <PatientSessions profile={profile} />;
  return <StaffSessions profile={profile} />;
}

function StaffSessions({ profile }) {
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [live, setLive] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [selectedSensorId, setSelectedSensorId] = useState('');
  const [reading, setReading] = useState('');
  const [latestReadings, setLatestReadings] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  async function load() {
    let sessionQuery = supabase
      .from('sessions')
      .select('*, profiles:patient_id(full_name), exercises:exercise_id(name)')
      .order('started_at', { ascending: false });

    let assignmentQuery = supabase
      .from('assignments')
      .select('id, patient_id, exercise_id, kinesiologo_id, profiles:patient_id(full_name), exercises:exercise_id(name), series, repetitions')
      .eq('active', true);

    if (profile.role === 'kinesiologo') {
      sessionQuery = sessionQuery.eq('kinesiologo_id', profile.id);
      assignmentQuery = assignmentQuery.eq('kinesiologo_id', profile.id);
    }

    const [s, a] = await Promise.all([sessionQuery, assignmentQuery]);
    setSessions(s.data || []);
    setAssignments(a.data || []);
  }

  useEffect(() => { load(); }, [profile.id, profile.role]);

  useEffect(() => {
    if (!live?.id) return undefined;

    const channel = supabase
      .channel(`session-readings-${live.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings', filter: `session_id=eq.${live.id}` },
        (payload) => setLatestReadings((prev) => [payload.new, ...prev].slice(0, 8))
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [live?.id]);

  const selectedSensor = useMemo(() => sensors.find((s) => s.id === selectedSensorId) || sensors[0], [sensors, selectedSensorId]);

  async function startSession() {
    if (!selected) return;
    setMessage('');

    const { data, error } = await supabase.from('sessions').insert({
      patient_id: selected.patient_id,
      exercise_id: selected.exercise_id,
      assignment_id: selected.id,
      kinesiologo_id: selected.kinesiologo_id || (profile.role === 'kinesiologo' ? profile.id : null),
      status: 'en_progreso'
    }).select('*').single();

    if (error) {
      setMessage(error.message);
      setMessageType('error');
      return;
    }

    const { data: sensorData } = await supabase.from('sensors').select('*').eq('exercise_id', selected.exercise_id).order('created_at');
    setSensors(sensorData || []);
    setSelectedSensorId(sensorData?.[0]?.id || '');
    setLatestReadings([]);
    setLive(data);
    setMessage('Sesión iniciada. El panel está listo para recibir lecturas.');
    setMessageType('success');
    load();
  }

  async function saveReading() {
    if (!live || reading === '' || !selectedSensor) return;

    const value = Number(reading);
    const inRange = value >= Number(selectedSensor.min_value) && value <= Number(selectedSensor.max_value);
    const { data, error } = await supabase.from('sensor_readings').insert({
      session_id: live.id,
      exercise_id: live.exercise_id,
      sensor_id: selectedSensor.id,
      value,
      unit: selectedSensor.unit,
      in_range: inRange
    }).select('*').single();

    if (error) {
      setMessage(error.message);
      setMessageType('error');
    } else {
      setMessage(`Lectura: ${value} ${selectedSensor.unit} · ${inRange ? 'Dentro de rango' : 'Fuera de rango'}`);
      setMessageType(inRange ? 'success' : 'warning');
      setLatestReadings((prev) => [data, ...prev.filter((x) => x.id !== data.id)].slice(0, 8));
      setReading('');
    }
  }

  async function finish() {
    if (!live) return;
    const { error } = await supabase.from('sessions').update({ status: 'completada', ended_at: new Date().toISOString() }).eq('id', live.id);
    if (error) {
      setMessage(error.message);
      setMessageType('error');
      return;
    }
    setLive(null);
    setSensors([]);
    setLatestReadings([]);
    setSelected(null);
    setMessage('Sesión finalizada correctamente.');
    setMessageType('success');
    load();
  }

  return (
    <div>
      <PageTitle eyebrow="MONITORIZACIÓN" title="Sesiones de rehabilitación" subtitle="Inicia una sesión, registra datos de sensores y revisa el historial del paciente." />
      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <div className="session-layout">
        <section className="panel session-control-panel">
          <div className="panel-heading-row">
            <div><span className="section-kicker">CONTROL DE SESIÓN</span><h3><Play size={18} /> Iniciar monitorización</h3></div>
            <span className="connection-pill"><span /> Conectado</span>
          </div>

          <label>Asignación del paciente
            <select value={selected?.id || ''} onChange={(e) => setSelected(assignments.find((a) => a.id === e.target.value) || null)} disabled={Boolean(live)}>
              <option value="">Seleccionar paciente y ejercicio…</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>{a.profiles?.full_name} · {a.exercises?.name}</option>)}
            </select>
          </label>

          {!live && (
            <button className="primary-button full top-gap" onClick={startSession} disabled={!selected}><Play size={17} /> Iniciar sesión</button>
          )}

          {live && (
            <div className="live-session">
              <div className="live-session-head"><span className="live-dot"><Radio size={14} /> EN VIVO</span><span>Sesión #{live.id.slice(0, 6)}</span></div>
              <h3>{selected?.profiles?.full_name || 'Paciente'}</h3>
              <p className="live-exercise">{selected?.exercises?.name || 'Ejercicio'}</p>

              {sensors.length ? (
                <>
                  <label>Sensor
                    <select value={selectedSensor?.id || ''} onChange={(e) => setSelectedSensorId(e.target.value)}>
                      {sensors.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.body_zone}</option>)}
                    </select>
                  </label>

                  {selectedSensor && (
                    <div className="range-card">
                      <div><Gauge size={18} /><span>Rango esperado</span></div>
                      <strong>{selectedSensor.min_value} – {selectedSensor.max_value} {selectedSensor.unit}</strong>
                    </div>
                  )}

                  <label>Valor recibido / prueba manual
                    <input type="number" step="0.01" value={reading} onChange={(e) => setReading(e.target.value)} placeholder="Ej. 87.4" />
                  </label>

                  <div className="button-row">
                    <button className="secondary-button" onClick={saveReading} disabled={reading === ''}><Save size={17} /> Guardar lectura</button>
                    <button className="danger-button filled" onClick={finish}><StopCircle size={17} /> Finalizar</button>
                  </div>
                </>
              ) : (
                <div className="alert warning">El ejercicio seleccionado todavía no tiene sensores configurados.</div>
              )}
            </div>
          )}
        </section>

        <section className="panel live-data-panel">
          <div className="panel-heading-row">
            <div><span className="section-kicker">DATOS DE SENSORES</span><h3><Activity size={18} /> Lecturas recientes</h3></div>
          </div>
          {live ? (
            latestReadings.length ? (
              <div className="reading-list">
                {latestReadings.map((r) => (
                  <div className="reading-row" key={r.id}>
                    <div className={`reading-status ${r.in_range ? 'reading-ok' : 'reading-bad'}`}>{r.in_range ? <CheckCircle2 size={17} /> : <Activity size={17} />}</div>
                    <div><strong>{r.value} {r.unit}</strong><span>{r.in_range ? 'Dentro de rango' : 'Fuera de rango'}</span></div>
                    <time>{new Date(r.recorded_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                  </div>
                ))}
              </div>
            ) : <div className="empty"><Activity size={34} /><p>La sesión está activa. Las lecturas aparecerán aquí.</p></div>
          ) : <div className="empty"><Radio size={34} /><p>Inicia una sesión para visualizar datos en tiempo real.</p></div>}
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-heading-row">
          <div><span className="section-kicker">HISTORIAL</span><h3><History size={18} /> Sesiones registradas</h3></div>
          <span className="mini-pill">{sessions.length} sesiones</span>
        </div>
        <SessionHistory sessions={sessions} />
      </section>
    </div>
  );
}

function PatientSessions({ profile }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    supabase.from('sessions')
      .select('id, status, started_at, ended_at, exercises:exercise_id(name)')
      .eq('patient_id', profile.id)
      .order('started_at', { ascending: false })
      .then(({ data }) => setSessions(data || []));
  }, [profile.id]);

  const completed = sessions.filter((session) => session.status === 'completada').length;
  const inProgress = sessions.filter((session) => session.status === 'en_progreso').length;

  return (
    <div className="patient-friendly-page">
      <PageTitle
        eyebrow="MI SEGUIMIENTO"
        title="Mis sesiones"
        subtitle="Revisa de forma simple las sesiones que ya realizaste y las que todavía están en curso."
      />

      <div className="patient-session-summary">
        <div><History size={26} /><span>Total</span><strong>{sessions.length}</strong></div>
        <div><CheckCircle2 size={26} /><span>Completadas</span><strong>{completed}</strong></div>
        <div><Activity size={26} /><span>En curso</span><strong>{inProgress}</strong></div>
      </div>

      <section className="patient-simple-panel">
        <div className="patient-panel-title">
          <div><History size={24} /><div><span>HISTORIAL</span><h2>Mis sesiones registradas</h2></div></div>
        </div>

        {sessions.length ? (
          <div className="patient-session-list">
            {sessions.map((session) => (
              <article className="patient-session-card" key={session.id}>
                <div className={`patient-session-status ${session.status === 'completada' ? 'done' : session.status === 'cancelada' ? 'cancelled' : 'progress'}`}>
                  {session.status === 'completada' ? <CheckCircle2 size={23} /> : <Activity size={23} />}
                </div>
                <div className="patient-session-copy">
                  <strong>{session.exercises?.name || 'Ejercicio'}</strong>
                  <span>{new Date(session.started_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
                <span className={`patient-friendly-status ${session.status}`}>
                  {formatStatus(session.status)}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty patient-empty-state"><History size={36} /><h2>Todavía no hay sesiones</h2><p>Cuando realices tu primer ejercicio, aparecerá aquí.</p></div>
        )}
      </section>
    </div>
  );
}

function SessionHistory({ sessions, patient = false }) {
  if (!sessions.length) return <div className="empty"><History size={32} /><p>Todavía no hay sesiones registradas.</p></div>;

  return (
    <div className="session-history-list">
      {sessions.map((s) => (
        <div className="session-history-row" key={s.id}>
          <div className="session-history-icon"><Activity size={18} /></div>
          <div className="session-history-main">
            <strong>{patient ? (s.exercises?.name || 'Ejercicio') : (s.profiles?.full_name || 'Paciente')}</strong>
            <span>{patient ? new Date(s.started_at).toLocaleDateString('es-CL') : (s.exercises?.name || 'Ejercicio')}</span>
          </div>
          {!patient && <div className="session-date">{new Date(s.started_at).toLocaleDateString('es-CL')}</div>}
          <span className={`status ${s.status === 'completada' ? 'ok' : s.status === 'cancelada' ? 'off' : 'pending'}`}>{formatStatus(s.status)}</span>
        </div>
      ))}
    </div>
  );
}

function formatStatus(status) {
  return status === 'en_progreso' ? 'En progreso' : status === 'completada' ? 'Completada' : 'Cancelada';
}
