import React, { useEffect, useMemo, useState } from 'react';
import { Power, Search, ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageTitle } from './Dashboard';

const roleLabels = { admin: 'Administrador', kinesiologo: 'Kinesiólogo', paciente: 'Paciente' };

function normalizeChileanPhone(rawPhone) {
  const phone = String(rawPhone || '').trim();
  if (!phone) return { valid: true, value: null };
  if (!/^[+\d\s()-]+$/.test(phone)) return { valid: false, value: null };

  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('56') && digits.length === 11) digits = digits.slice(2);
  if (digits.length !== 9) return { valid: false, value: null };

  return { valid: true, value: `+56${digits}` };
}

export default function Users({ profile }) {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setMessageType('error');
      return;
    }

    setUsers(data || []);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => users.filter((u) => `${u.full_name || ''} ${u.email || ''} ${u.phone || ''} ${u.role || ''}`.toLowerCase().includes(search.toLowerCase())),
    [search, users]
  );

  async function create(e) {
    e.preventDefault();
    if (creating) return;

    setMessage('');
    const formElement = e.currentTarget;
    const form = new FormData(formElement);

    const fullName = String(form.get('full_name') || '').trim();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const role = String(form.get('role') || '');
    const rawPhone = String(form.get('phone') || '').trim();

    if (fullName.length < 3) {
      setMessage('El nombre completo debe contener al menos 3 caracteres.');
      setMessageType('error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Ingresa un correo electrónico válido.');
      setMessageType('error');
      return;
    }

    if (password.length < 6) {
      setMessage('La contraseña debe contener al menos 6 caracteres.');
      setMessageType('error');
      return;
    }

    const normalizedPhone = normalizeChileanPhone(rawPhone);
    if (!normalizedPhone.valid) {
      setMessage('El teléfono debe contener 9 dígitos. Ejemplo: 912345678 o +56 9 1234 5678.');
      setMessageType('error');
      return;
    }

    if (!['admin', 'kinesiologo', 'paciente'].includes(role)) {
      setMessage('El rol seleccionado no es válido.');
      setMessageType('error');
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setMessage('Tu sesión expiró. Cierra sesión y vuelve a ingresar.');
      setMessageType('error');
      return;
    }

    try {
      setCreating(true);
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          full_name: fullName,
          email,
          password,
          role,
          phone: normalizedPhone.value
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error || data?.error) {
        setMessage(data?.error || error?.message || 'No se pudo crear el usuario.');
        setMessageType('error');
        return;
      }

      setMessage(`${roleLabels[role] || 'Usuario'} creado correctamente.`);
      setMessageType('success');
      formElement.reset();
      await load();
    } catch (error) {
      setMessage(error?.message || 'Ocurrió un error inesperado al crear el usuario.');
      setMessageType('error');
    } finally {
      setCreating(false);
    }
  }

  async function toggle(user) {
    if (user.id === profile.id) {
      setMessage('No puedes desactivar tu propia cuenta mientras estás usando el sistema.');
      setMessageType('warning');
      return;
    }

    const { error } = await supabase.from('profiles').update({ active: !user.active }).eq('id', user.id);
    if (error) {
      setMessage(error.message);
      setMessageType('error');
    } else {
      setMessage(user.active ? 'Usuario desactivado correctamente.' : 'Usuario activado correctamente.');
      setMessageType('success');
      await load();
    }
  }

  return (
    <div>
      <PageTitle eyebrow="ADMINISTRACIÓN" title="Usuarios y roles" subtitle="Crea cuentas y controla quién puede acceder a cada función de SRD." />
      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <div className="two-column user-layout">
        <form className="panel form-stack sticky-panel" onSubmit={create}>
          <div className="panel-heading-row"><div><span className="section-kicker">NUEVA CUENTA</span><h3><UserPlus size={19} /> Crear usuario</h3></div></div>
          <div className="form-note"><ShieldCheck size={16} /> El rol define automáticamente las pantallas y acciones disponibles.</div>
          <label>Nombre completo<input name="full_name" placeholder="Ej: María González" minLength={3} required /></label>
          <label>Correo<input name="email" type="email" placeholder="Ej: maria@srd.cl" required /></label>
          <label>Contraseña inicial<input name="password" type="password" placeholder="Mínimo 6 caracteres" minLength={6} required /></label>
          <label>Teléfono<input name="phone" type="tel" placeholder="Ej: 912345678" maxLength={17} /><small className="field-help">9 dígitos. Ejemplo: 912345678</small></label>
          <label>Rol
            <select name="role" defaultValue="kinesiologo" required>
              <option value="kinesiologo">Kinesiólogo</option>
              <option value="paciente">Paciente</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <button className="primary-button full" type="submit" disabled={creating}><UserPlus size={17} /> {creating ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        </form>

        <section className="panel">
          <div className="panel-heading-row"><div><span className="section-kicker">ACCESOS</span><h3><UsersIcon size={19} /> Usuarios registrados</h3></div><span className="mini-pill">{users.length}</span></div>
          <div className="input-icon search-box user-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario…" /></div>

          <div className="user-list">
            {filtered.map((u) => (
              <div className="user-row" key={u.id}>
                <div className="user-list-avatar">{u.full_name?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div className="user-row-main"><strong>{u.full_name}</strong><span>{u.email}</span>{u.phone && <span>{u.phone}</span>}</div>
                <span className={`role-pill role-${u.role}`}>{roleLabels[u.role] || u.role}</span>
                <span className={`status ${u.active ? 'ok' : 'off'}`}>{u.active ? 'Activo' : 'Inactivo'}</span>
                <button type="button" className="ghost-button compact" onClick={() => toggle(u)} title={u.active ? 'Desactivar usuario' : 'Activar usuario'}><Power size={15} /></button>
              </div>
            ))}
            {!filtered.length && <div className="empty"><UsersIcon size={30} /><p>No hay usuarios para mostrar.</p></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
