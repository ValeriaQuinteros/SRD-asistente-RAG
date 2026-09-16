import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Gauge,
  Play,
  Sparkles,
  Star,
  StopCircle,
  Trophy,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadPatientRewards } from '../lib/rewards';
import { PageTitle } from './Dashboard';

export default function PatientHome({ profile }) {
  const [items, setItems] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [rewards, setRewards] = useState({ total_points: 0, current_streak: 0, level: 'Comenzando' });

  async function load() {
    const [assignmentsResult, sessionsResult] = await Promise.all([
      supabase
        .from('assignments')
        .select('id, series, repetitions, frequency, start_date, end_date, kinesiologo_id, exercises:exercise_id(id,name,description,instructions,sensors(*))')
        .eq('patient_id', profile.id)
        .eq('active', true),
      supabase
        .from('sessions')
        .select('id, assignment_id, exercise_id, status, started_at, ended_at, exercises:exercise_id(name)')
        .eq('patient_id', profile.id)
        .order('started_at', { ascending: false })
    ]);

    if (assignmentsResult.error) {
      setMessage(assignmentsResult.error.message);
      setMessageType('error');
    }

    setItems(assignmentsResult.data || []);
    setSessions(sessionsResult.data || []);

    try {
      const rewardData = await loadPatientRewards(profile.id);
      setRewards(rewardData.rewards);
    } catch (error) {
      console.warn('Recompensas todavía no configuradas:', error);
    }
  }

  useEffect(() => {
    load();
  }, [profile.id]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.status === 'en_progreso') || null,
    [sessions]
  );

  const completed = useMemo(
    () => sessions.filter((session) => session.status === 'completada').length,
    [sessions]
  );

  async function start(assignment) {
    if (activeSession) {
      setMessage('Ya tienes una sesión en curso. Finalízala antes de iniciar otro ejercicio.');
      setMessageType('warning');
      return;
    }

    setBusy(true);
    setMessage('');

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        patient_id: profile.id,
        exercise_id: assignment.exercises.id,
        assignment_id: assignment.id,
        kinesiologo_id: assignment.kinesiologo_id || profile.assigned_kinesiologo_id || null,
        status: 'en_progreso'
      })
      .select('id, assignment_id, exercise_id, status, started_at')
      .single();

    if (error) {
      setBusy(false);
      setMessage(error.message);
      setMessageType('error');
      return;
    }

    setMessage(`Tu sesión de ${assignment.exercises.name} comenzó correctamente.`);
    setMessageType('success');
    await load();
    setBusy(false);
  }

  async function finishCurrentSession() {
    if (!activeSession || busy) return;

    setBusy(true);
    setMessage('');

    const pointsBefore = Number(rewards.total_points || 0);

    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'completada',
        ended_at: new Date().toISOString()
      })
      .eq('id', activeSession.id)
      .eq('patient_id', profile.id);

    if (error) {
      setBusy(false);
      setMessage(error.message);
      setMessageType('error');
      return;
    }

    let rewardData = { rewards };
    try {
      rewardData = await loadPatientRewards(profile.id);
      setRewards(rewardData.rewards);
    } catch (rewardError) {
      console.warn('No se pudo actualizar recompensa:', rewardError);
    }

    const pointsAfter = Number(rewardData.rewards?.total_points || pointsBefore);
    const gained = Math.max(0, pointsAfter - pointsBefore);

    setCelebration({
      exerciseName: activeSession.exercises?.name || 'tu ejercicio',
      points: gained,
      totalPoints: pointsAfter,
      streak: rewardData.rewards?.current_streak || 0,
      level: rewardData.rewards?.level || 'Comenzando'
    });

    setMessage('¡Sesión completada! Tu progreso quedó guardado.');
    setMessageType('success');
    setBusy(false);
    await load();
  }

  return (
    <div className="patient-friendly-page">
      <PageTitle
        eyebrow="MI PLAN"
        title="Mi rehabilitación"
        subtitle="Aquí encontrarás solo lo que necesitas para realizar tus ejercicios de manera sencilla."
      />

      {message && <div className={`alert patient-alert ${messageType}`}>{message}</div>}

      {activeSession ? (
        <section className="current-session-card">
          <div className="current-session-icon"><Activity size={32} /></div>
          <div className="current-session-copy">
            <span className="patient-kicker">SESIÓN EN CURSO</span>
            <h2>{activeSession.exercises?.name || 'Tu ejercicio actual'}</h2>
            <p>Cuando hayas terminado las indicaciones de tu kinesiólogo, presiona el botón para finalizar.</p>
          </div>
          <button className="patient-finish-action" onClick={finishCurrentSession} disabled={busy}>
            <StopCircle size={23} /> {busy ? 'Guardando…' : 'Finalizar mi sesión'}
          </button>
        </section>
      ) : (
        <section className="patient-progress-banner patient-progress-banner-large">
          <div className="progress-banner-icon"><Activity size={30} /></div>
          <div>
            <span>Tu seguimiento SRD</span>
            <strong>{items.length} ejercicios activos · {completed} sesiones completadas</strong>
          </div>
          <Link className="progress-rewards-link" to="/rewards"><Star size={18} /> {rewards.total_points || 0} puntos</Link>
        </section>
      )}

      <div className="patient-simple-exercise-list">
        {items.map((assignment) => (
          <article className="patient-simple-exercise" key={assignment.id}>
            <div className="patient-exercise-number"><Dumbbell size={26} /></div>
            <div className="patient-simple-exercise-main">
              <span className="status ok"><CheckCircle2 size={14} /> Asignado por tu kinesiólogo</span>
              <h2>{assignment.exercises.name}</h2>
              <p>{assignment.exercises.description || 'Realiza este ejercicio siguiendo las indicaciones entregadas por tu profesional.'}</p>

              <div className="patient-prescription-grid">
                <div><strong>{assignment.series}</strong><span>Series</span></div>
                <div><strong>{assignment.repetitions}</strong><span>Repeticiones</span></div>
                <div><CalendarDays size={20} /><span>{assignment.frequency}</span></div>
              </div>

              {assignment.exercises.instructions && (
                <div className="patient-instruction-box">
                  <strong>Antes de comenzar</strong>
                  <span>{assignment.exercises.instructions}</span>
                </div>
              )}

              {assignment.exercises.sensors?.length > 0 && (
                <details className="patient-details">
                  <summary><Gauge size={18} /> Ver sensores configurados <ChevronDown size={18} /></summary>
                  <div className="patient-sensor-list">
                    {assignment.exercises.sensors.map((sensor) => (
                      <div key={sensor.id}>
                        <strong>{sensor.name}</strong>
                        <span>{sensor.body_zone} · Rango esperado {sensor.min_value}–{sensor.max_value} {sensor.unit}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <button
              className="patient-main-action patient-exercise-action"
              onClick={() => start(assignment)}
              disabled={Boolean(activeSession) || busy}
            >
              <Play size={23} />
              {activeSession ? 'Termina tu sesión actual' : busy ? 'Iniciando…' : 'Iniciar mi sesión'}
            </button>
          </article>
        ))}

        {!items.length && (
          <div className="patient-simple-panel empty patient-empty-state">
            <Dumbbell size={38} />
            <h2>No tienes ejercicios asignados</h2>
            <p>Cuando tu kinesiólogo prepare un ejercicio, aparecerá automáticamente en esta pantalla.</p>
          </div>
        )}
      </div>

      {celebration && (
        <CelebrationModal data={celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  );
}

function CelebrationModal({ data, onClose }) {
  return (
    <div className="modal-backdrop celebration-backdrop" role="dialog" aria-modal="true" aria-label="Sesión completada">
      <div className="celebration-modal">
        <button className="celebration-close" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => <i key={index} style={{ '--i': index }} />)}
        </div>
        <div className="celebration-icon"><Trophy size={46} /></div>
        <span className="patient-kicker">¡SESIÓN COMPLETADA!</span>
        <h2>¡Muy bien! 🎉</h2>
        <p>Completaste <strong>{data.exerciseName}</strong>. Tu avance quedó guardado correctamente.</p>

        <div className="celebration-stats">
          <div><Star size={22} /><strong>+{data.points}</strong><span>Puntos ganados</span></div>
          <div><Sparkles size={22} /><strong>{data.totalPoints}</strong><span>Puntos totales</span></div>
          <div><Activity size={22} /><strong>{data.streak}</strong><span>Racha actual</span></div>
        </div>

        <div className="celebration-level">Nivel actual: <strong>{data.level}</strong></div>
        <div className="celebration-actions">
          <Link to="/rewards" className="patient-secondary-action" onClick={onClose}><Star size={19} /> Ver mis logros</Link>
          <button className="patient-main-action" onClick={onClose}><CheckCircle2 size={21} /> Volver</button>
        </div>
      </div>
    </div>
  );
}
