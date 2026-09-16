import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) setError('No pudimos iniciar sesión. Revisa tu correo y contraseña.');
    else navigate(location.state?.from || '/dashboard', { replace: true });

    setBusy(false);
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-showcase">
          <div className="showcase-content">
            <span className="showcase-badge"><Activity size={16} /> Rehabilitación conectada</span>
            <h2>Tecnología para acompañar cada movimiento.</h2>
            <p>Seguimiento de pacientes, ejercicios, sensores y sesiones en una plataforma segura para SRD.</p>
            <div className="showcase-points">
              <span><i /> Monitoreo de ejercicios</span>
              <span><i /> Datos de sensores Arduino</span>
              <span><i /> Acceso diferenciado por rol</span>
            </div>
          </div>
        </section>

        <section className="login-card">
          <img src="/logo-srd.jpg" alt="SRD Sala de Rehabilitación Deportiva" className="login-logo" />
          <div className="login-heading">
            <span className="eyebrow"><ShieldCheck size={15} /> Acceso seguro</span>
            <h1>Bienvenido a SRD</h1>
            <p>Ingresa con tu cuenta. Las funciones disponibles cambian según seas administrador, kinesiólogo o paciente.</p>
          </div>

          <form onSubmit={submit} className="form-stack">
            <label>
              Correo electrónico
              <div className="input-icon">
                <Mail size={18} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.cl" autoComplete="email" required />
              </div>
            </label>

            <label>
              Contraseña
              <div className="input-icon">
                <LockKeyhole size={18} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
              </div>
            </label>

            {error && <div className="alert error">{error}</div>}

            <button className="primary-button full login-button" disabled={busy}>
              {busy ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="login-security">
            <strong>Privacidad y roles</strong>
            <span>La información clínica se protege mediante autenticación y políticas de acceso en la base de datos.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
