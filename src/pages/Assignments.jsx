import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardCheck, Plus, Power, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageTitle } from './Dashboard';

export default function Assignments({ profile }) {
  const [patients, setPatients] = useState([]);
  const [kines, setKines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  async function load() {
    let patientQuery = supabase.from('profiles').select('id, full_name').eq('role', 'paciente').eq('active', true).order('full_name');
    let assignmentQuery = supabase
      .from('assignments')
      .select('id, patient_id, exercise_id, kinesiologo_id, series, repetitions, frequency, start_date, end_date, active, profiles:patient_id(full_name), exercises:exercise_id(name), kine:kinesiologo_id(full_name)')
      .order('created_at', { ascending: false });

    if (profile.role === 'kinesiologo') {
      patientQuery = patientQuery.eq('assigned_kinesiologo_id', profile.id);
      assignmentQuery = assignmentQuery.eq('kinesiologo_id', profile.id);
    }

    const requests = [
      patientQuery,
      supabase.from('exercises').select('id, name').eq('active', true).order('name'),
      assignmentQuery
    ];

    if (profile.role === 'admin') {
      requests.push(supabase.from('profiles').select('id, full_name').eq('role', 'kinesiologo').eq('active', true).order('full_name'));
    }

    const results = await Promise.all(requests);
    const [p, e, a, k] = results;

    setPatients(p.data || []);
    setExercises(e.data || []);
    setItems(a.data || []);
    setKines(k?.data || []);
  }

  useEffect(() => { load(); }, [profile.id, profile.role]);

  const activeCount = useMemo(() => items.filter((item) => item.active).length, [items]);

  async function create(e) {
    e.preventDefault();
    setMessage('');
    const form = new FormData(e.currentTarget);
    const kinesiologoId = profile.role === 'kinesiologo' ? profile.id : form.get('kinesiologo_id');

    if (!kinesiologoId) {
      setMessage('Selecciona el kinesiólogo responsable de la asignación.');
      setMessageType('error');
      return;
    }

    const { error } = await supabase.from('assignments').insert({
      patient_id: form.get('patient_id'),
      exercise_id: form.get('exercise_id'),
      kinesiologo_id: kinesiologoId,
      series: Number(form.get('series')),
      repetitions: Number(form.get('repetitions')),
      frequency: form.get('frequency'),
      start_date: form.get('start_date') || null,
      end_date: form.get('end_date') || null
    });

    if (error) {
      setMessage(error.message);
      setMessageType('error');
    } else {
      setMessage('Ejercicio asignado correctamente.');
      setMessageType('success');
      e.currentTarget.reset();
      load();
    }
  }

  async function toggle(item) {
    const { error } = await supabase.from('assignments').update({ active: !item.active }).eq('id', item.id);
    if (error) {
      setMessage(error.message);
      setMessageType('error');
    } else {
      setMessage(item.active ? 'Asignación desactivada.' : 'Asignación reactivada.');
      setMessageType('success');
      load();
    }
  }

  return (
    <div>
      <PageTitle eyebrow="PLAN DE REHABILITACIÓN" title="Asignación de ejercicios" subtitle="Relaciona ejercicios con pacientes y define la pauta indicada por el kinesiólogo." />
      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <div className="summary-strip">
        <div className="summary-strip-icon"><ClipboardCheck size={21} /></div>
        <div><strong>{activeCount}</strong><span>asignaciones activas</span></div>
      </div>

      <div className="two-column assignment-layout">
        <form className="panel form-stack sticky-panel" onSubmit={create}>
          <div className="panel-heading-row">
            <div><span className="section-kicker">NUEVA PAUTA</span><h3><Plus size={18} /> Crear asignación</h3></div>
          </div>

          <label>Paciente
            <select name="patient_id" required>
              <option value="">Seleccionar paciente…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </label>

          <label>Ejercicio
            <select name="exercise_id" required>
              <option value="">Seleccionar ejercicio…</option>
              {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>

          {profile.role === 'admin' && (
            <label>Kinesiólogo responsable
              <select name="kinesiologo_id" required>
                <option value="">Seleccionar kinesiólogo…</option>
                {kines.map((k) => <option key={k.id} value={k.id}>{k.full_name}</option>)}
              </select>
            </label>
          )}

          <div className="form-grid">
            <label>Series<input name="series" type="number" min="1" defaultValue="3" required /></label>
            <label>Repeticiones<input name="repetitions" type="number" min="1" defaultValue="10" required /></label>
          </div>

          <label>Frecuencia<input name="frequency" defaultValue="3 veces por semana" required /></label>

          <div className="form-grid">
            <label>Fecha de inicio<input name="start_date" type="date" /></label>
            <label>Fecha de término<input name="end_date" type="date" /></label>
          </div>

          <button className="primary-button full"><ClipboardCheck size={18} /> Asignar ejercicio</button>
        </form>

        <section className="panel">
          <div className="panel-heading-row">
            <div><span className="section-kicker">SEGUIMIENTO</span><h3>Asignaciones registradas</h3></div>
            <span className="mini-pill">{items.length} total</span>
          </div>

          <div className="assignment-list">
            {items.map((item) => (
              <article className={`assignment-card ${!item.active ? 'assignment-off' : ''}`} key={item.id}>
                <div className="assignment-card-main">
                  <div className="assignment-icon"><ClipboardCheck size={20} /></div>
                  <div>
                    <strong>{item.profiles?.full_name || 'Paciente'}</strong>
                    <span>{item.exercises?.name || 'Ejercicio'}</span>
                  </div>
                </div>
                <div className="assignment-meta">
                  <span><UserRound size={14} /> {item.kine?.full_name || 'Sin kinesiólogo'}</span>
                  <span><ClipboardCheck size={14} /> {item.series} series × {item.repetitions} rep.</span>
                  <span><CalendarDays size={14} /> {item.frequency}</span>
                </div>
                <div className="assignment-footer">
                  <span className={`status ${item.active ? 'ok' : 'off'}`}>{item.active ? 'Activa' : 'Inactiva'}</span>
                  <button className="ghost-button compact" onClick={() => toggle(item)}><Power size={15} /> {item.active ? 'Desactivar' : 'Reactivar'}</button>
                </div>
              </article>
            ))}
            {!items.length && <div className="empty"><ClipboardCheck size={32} /><p>Todavía no hay ejercicios asignados.</p></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
