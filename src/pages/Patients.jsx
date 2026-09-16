import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Plus, Search, UserPlus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageTitle } from './Dashboard';

export default function Patients({ profile }) {
  const [patients, setPatients] = useState([]);
  const [kines, setKines] = useState([]);
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  async function load() {
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, phone, active, created_at, assigned_kinesiologo_id')
      .eq('role', 'paciente')
      .order('created_at', { ascending: false });

    if (profile.role === 'kinesiologo') query = query.eq('assigned_kinesiologo_id', profile.id);
    const { data, error } = await query;
    if (error) {
      setMessage(error.message);
      setMessageType('error');
    }
    setPatients(data || []);
  }

  useEffect(() => {
    load();
    if (profile.role === 'admin') {
      supabase.from('profiles').select('id, full_name').eq('role', 'kinesiologo').eq('active', true).order('full_name')
        .then(({ data }) => setKines(data || []));
    }
  }, [profile.id, profile.role]);

  const filtered = useMemo(
    () => patients.filter((p) => `${p.full_name} ${p.email || ''}`.toLowerCase().includes(search.toLowerCase())),
    [patients, search]
  );

  async function createPatient(e) {
    e.preventDefault();
    setMessage('');
    const form = new FormData(e.currentTarget);
    const payload = {
      full_name: form.get('full_name'),
      email: form.get('email'),
      password: form.get('password'),
      phone: form.get('phone'),
      role: 'paciente',
      assigned_kinesiologo_id: profile.role === 'kinesiologo' ? profile.id : form.get('assigned_kinesiologo_id') || null
    };

    const { data, error } = await supabase.functions.invoke('create-user', { body: payload });
    if (error || data?.error) {
      setMessage(error?.message || data?.error || 'No se pudo crear el paciente.');
      setMessageType('error');
      return;
    }

    setMessage('Paciente creado correctamente.');
    setMessageType('success');
    setShow(false);
    await load();
  }

  return (
    <div>
      <PageTitle
        eyebrow={profile.role === 'kinesiologo' ? 'ATENCIÓN CLÍNICA' : 'GESTIÓN DE PACIENTES'}
        title={profile.role === 'kinesiologo' ? 'Mis pacientes' : 'Pacientes'}
        subtitle={profile.role === 'kinesiologo' ? 'Pacientes asociados a tu perfil profesional.' : 'Registro y administración de pacientes del centro.'}
        action={<button className="primary-button" onClick={() => setShow(true)}><UserPlus size={18} /> Registrar paciente</button>}
      />

      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <div className="summary-strip">
        <div className="summary-strip-icon"><Users size={21} /></div>
        <div><strong>{patients.length}</strong><span>{profile.role === 'kinesiologo' ? 'pacientes bajo tu seguimiento' : 'pacientes registrados visibles'}</span></div>
      </div>

      <div className="toolbar modern-toolbar">
        <div className="input-icon search-box"><Search size={18} /><input placeholder="Buscar por nombre o correo…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <div className="patient-grid">
        {filtered.map((p) => (
          <article className="patient-card" key={p.id}>
            <div className="patient-card-head">
              <div className="patient-avatar">{p.full_name?.charAt(0)?.toUpperCase() || 'P'}</div>
              <div className="patient-card-title"><strong>{p.full_name}</strong><span className={`status ${p.active ? 'ok' : 'off'}`}>{p.active ? 'Activo' : 'Inactivo'}</span></div>
            </div>
            <div className="patient-contact"><Mail size={15} /><span>{p.email || 'Sin correo'}</span></div>
            <div className="patient-contact"><Phone size={15} /><span>{p.phone || 'Sin teléfono registrado'}</span></div>
            <div className="patient-card-footer">ID de paciente: <span>{p.id.slice(0, 8)}</span></div>
          </article>
        ))}
        {!filtered.length && <div className="panel empty empty-wide"><Users size={34} /><p>No hay pacientes para mostrar.</p></div>}
      </div>

      {show && (
        <Modal title="Registrar paciente" onClose={() => setShow(false)}>
          <form className="form-stack" onSubmit={createPatient}>
            <div className="form-note">El paciente recibirá acceso como <strong>Paciente</strong>. Sus funciones serán limitadas a su rehabilitación y seguimiento.</div>
            <label>Nombre completo<input name="full_name" required placeholder="Nombre Apellido" /></label>
            <label>Correo<input name="email" type="email" required placeholder="paciente@correo.cl" /></label>
            <label>Contraseña inicial<input name="password" type="password" minLength="6" required placeholder="Mínimo 6 caracteres" /></label>
            <label>Teléfono<input name="phone" placeholder="+56 9..." /></label>
            {profile.role === 'admin' && (
              <label>Kinesiólogo responsable
                <select name="assigned_kinesiologo_id">
                  <option value="">Sin asignar por ahora</option>
                  {kines.map((k) => <option key={k.id} value={k.id}>{k.full_name}</option>)}
                </select>
              </label>
            )}
            <button className="primary-button full"><Plus size={18} /> Crear paciente</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header"><div><span className="section-kicker">SRD</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}
