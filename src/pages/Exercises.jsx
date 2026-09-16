import React, { useEffect, useState } from 'react';
import { Edit3, Gauge, Plus, Power, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageTitle } from './Dashboard';

const emptySensor = { name: '', body_zone: '', min_value: '', max_value: '', unit: 'grados' };

export default function Exercises({ profile }) {
  const [items, setItems] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  async function load() {
    const { data, error } = await supabase.from('exercises').select('*, sensors(*)').order('created_at', { ascending: false });
    if (error) {
      setMessage(error.message);
      setMessageType('error');
    }
    setItems(data || []);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setMessage('');
    setEditing({ id: null, name: '', description: '', instructions: '', active: true, sensors: [{ ...emptySensor }] });
    setShow(true);
  }

  function openEdit(ex) {
    setMessage('');
    setEditing({
      ...ex,
      sensors: ex.sensors?.length ? ex.sensors.map((s) => ({ ...s })) : [{ ...emptySensor }]
    });
    setShow(true);
  }

  function updateSensor(index, key, value) {
    setEditing((prev) => {
      const sensors = [...prev.sensors];
      sensors[index] = { ...sensors[index], [key]: value };
      return { ...prev, sensors };
    });
  }

  function addSensor() {
    if (editing.sensors.length >= 3) return;
    setEditing((prev) => ({ ...prev, sensors: [...prev.sensors, { ...emptySensor }] }));
  }

  function removeSensor(index) {
    setEditing((prev) => ({ ...prev, sensors: prev.sensors.filter((_, i) => i !== index) }));
  }

  async function save(e) {
    e.preventDefault();
    setMessage('');

    if (!editing.sensors.length || editing.sensors.length > 3) {
      setMessage('Cada ejercicio debe tener entre 1 y 3 sensores.');
      setMessageType('error');
      return;
    }

    if (editing.sensors.some((s) => Number(s.min_value) > Number(s.max_value))) {
      setMessage('El rango mínimo de cada sensor debe ser menor o igual al máximo.');
      setMessageType('error');
      return;
    }

    const exercisePayload = {
      name: editing.name,
      description: editing.description,
      instructions: editing.instructions,
      active: editing.active,
      created_by: profile.id,
      updated_at: new Date().toISOString()
    };

    let exerciseId = editing.id;
    let error;

    if (exerciseId) {
      ({ error } = await supabase.from('exercises').update(exercisePayload).eq('id', exerciseId));
      if (!error) await supabase.from('sensors').delete().eq('exercise_id', exerciseId);
    } else {
      const result = await supabase.from('exercises').insert(exercisePayload).select('id').single();
      error = result.error;
      exerciseId = result.data?.id;
    }

    if (!error && exerciseId) {
      const sensorRows = editing.sensors.map((s) => ({
        exercise_id: exerciseId,
        name: s.name,
        body_zone: s.body_zone,
        min_value: Number(s.min_value),
        max_value: Number(s.max_value),
        unit: s.unit
      }));
      ({ error } = await supabase.from('sensors').insert(sensorRows));
    }

    if (error) {
      setMessage(error.message);
      setMessageType('error');
      return;
    }

    setShow(false);
    setMessage('Ejercicio guardado correctamente.');
    setMessageType('success');
    await load();
  }

  async function toggle(ex) {
    const { error } = await supabase.from('exercises').update({ active: !ex.active, updated_at: new Date().toISOString() }).eq('id', ex.id);
    if (error) {
      setMessage(error.message);
      setMessageType('error');
    } else {
      setMessage(ex.active ? 'Ejercicio desactivado.' : 'Ejercicio activado.');
      setMessageType('success');
      load();
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="CATÁLOGO CLÍNICO"
        title="Ejercicios de rehabilitación"
        subtitle="Crea, edita y desactiva ejercicios. Configura hasta tres sensores y sus rangos esperados."
        action={<button className="primary-button" onClick={openNew}><Plus size={18} /> Crear ejercicio</button>}
      />

      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <div className="exercise-grid">
        {items.map((ex) => (
          <article className="exercise-card" key={ex.id}>
            <div className="exercise-card-top">
              <span className={`status ${ex.active ? 'ok' : 'off'}`}>{ex.active ? 'Activo' : 'Desactivado'}</span>
              <span className="sensor-count"><Gauge size={14} /> {ex.sensors?.length || 0}/3 sensores</span>
            </div>
            <div className="exercise-icon"><DumbbellMini /></div>
            <h3>{ex.name}</h3>
            <p>{ex.description || 'Sin descripción registrada.'}</p>
            <div className="sensor-tags">
              {ex.sensors?.map((s) => (
                <span key={s.id}>
                  <strong>{s.name}</strong>
                  <small>{s.body_zone} · {s.min_value}–{s.max_value} {s.unit}</small>
                </span>
              ))}
            </div>
            <div className="card-actions">
              <button className="secondary-button" onClick={() => openEdit(ex)}><Edit3 size={16} /> Editar</button>
              <button className="ghost-button" onClick={() => toggle(ex)}><Power size={16} /> {ex.active ? 'Desactivar' : 'Activar'}</button>
            </div>
          </article>
        ))}
        {!items.length && <div className="panel empty empty-wide">Aún no hay ejercicios. Crea el primero para comenzar.</div>}
      </div>

      {show && <ExerciseModal editing={editing} setEditing={setEditing} updateSensor={updateSensor} addSensor={addSensor} removeSensor={removeSensor} save={save} close={() => setShow(false)} message={messageType === 'error' ? message : ''} />}
    </div>
  );
}

function DumbbellMini() {
  return <div className="dumbbell-mark"><span /><b /><span /></div>;
}

function ExerciseModal({ editing, setEditing, updateSensor, addSensor, removeSensor, save, close, message }) {
  return (
    <div className="modal-backdrop"><div className="modal large">
      <div className="modal-header">
        <div><span className="section-kicker">CONFIGURACIÓN DE EJERCICIO</span><h2>{editing.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2></div>
        <button className="icon-button" onClick={close}>×</button>
      </div>
      <form className="form-stack" onSubmit={save}>
        <label>Nombre<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required placeholder="Ej. Flexión de rodilla" /></label>
        <label>Descripción<textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows="2" placeholder="Objetivo general del ejercicio." /></label>
        <label>Instrucciones para el paciente<textarea value={editing.instructions || ''} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} rows="3" placeholder="Indicaciones que verá el paciente durante su rehabilitación." /></label>

        <div className="section-heading">
          <div><span className="section-kicker">SENSORES</span><h3>Rangos esperados</h3><p>Configura de 1 a 3 sensores por ejercicio.</p></div>
          <button type="button" className="secondary-button" onClick={addSensor} disabled={editing.sensors.length >= 3}><Plus size={16} /> Agregar sensor</button>
        </div>

        {editing.sensors.map((s, i) => (
          <div className="sensor-form" key={i}>
            <div className="sensor-form-title"><strong>Sensor {i + 1} de 3</strong>{editing.sensors.length > 1 && <button type="button" className="danger-button" onClick={() => removeSensor(i)}><Trash2 size={15} /></button>}</div>
            <div className="form-grid">
              <label>Nombre<input value={s.name} onChange={(e) => updateSensor(i, 'name', e.target.value)} required placeholder="Sensor rodilla" /></label>
              <label>Zona corporal<input value={s.body_zone} onChange={(e) => updateSensor(i, 'body_zone', e.target.value)} required placeholder="Rodilla derecha" /></label>
              <label>Rango mínimo<input type="number" step="0.01" value={s.min_value} onChange={(e) => updateSensor(i, 'min_value', e.target.value)} required /></label>
              <label>Rango máximo<input type="number" step="0.01" value={s.max_value} onChange={(e) => updateSensor(i, 'max_value', e.target.value)} required /></label>
              <label>Unidad<input value={s.unit} onChange={(e) => updateSensor(i, 'unit', e.target.value)} required placeholder="grados" /></label>
            </div>
          </div>
        ))}

        {message && <div className="alert error">{message}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancelar</button><button className="primary-button">Guardar ejercicio</button></div>
      </form>
    </div></div>
  );
}
