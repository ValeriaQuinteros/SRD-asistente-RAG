import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Accessibility,
  Activity,
  Award,
  ClipboardList,
  Dumbbell,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleMore,
  ShieldCheck,
  Type,
  UserRound,
  Users,
  X,
  ZapOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const roleLabels = {
  admin: 'Administrador',
  kinesiologo: 'Kinesiólogo',
  paciente: 'Paciente'
};

const roleDescriptions = {
  admin: 'Gestión general del centro',
  kinesiologo: 'Seguimiento clínico y sesiones',
  paciente: 'Tu plan personal de rehabilitación'
};

const defaultAccessibility = {
  largeText: false,
  highContrast: false,
  reduceMotion: false
};

function readAccessibilityPreferences() {
  try {
    return {
      ...defaultAccessibility,
      ...JSON.parse(localStorage.getItem('srd-accessibility') || '{}')
    };
  } catch {
    return defaultAccessibility;
  }
}

export default function Layout({ profile }) {
  const [open, setOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibility, setAccessibility] = useState(readAccessibilityPreferences);
  const navigate = useNavigate();

  const patientLinks = [
    { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { to: '/my-care', label: 'Mi rehabilitación', icon: Dumbbell },
    { to: '/sessions', label: 'Mis sesiones', icon: Activity },
    { to: '/assistant', label: 'Asistente IA', icon: MessageCircleMore },
    { to: '/rewards', label: 'Mis logros', icon: Award },
    { to: '/help', label: 'Ayuda', icon: HelpCircle }
  ];

  const staffLinks = [
    { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin', 'kinesiologo'] },
    { to: '/users', label: 'Usuarios', icon: UserRound, roles: ['admin'] },
    { to: '/patients', label: profile?.role === 'kinesiologo' ? 'Mis pacientes' : 'Pacientes', icon: Users, roles: ['admin', 'kinesiologo'] },
    { to: '/exercises', label: 'Ejercicios', icon: Dumbbell, roles: ['admin', 'kinesiologo'] },
    { to: '/assignments', label: 'Asignaciones', icon: ClipboardList, roles: ['admin', 'kinesiologo'] },
    { to: '/sessions', label: 'Sesiones', icon: Activity, roles: ['admin', 'kinesiologo'] },
    { to: '/assistant', label: 'Asistente IA', icon: MessageCircleMore, roles: ['admin', 'kinesiologo'] }
  ].filter((item) => item.roles.includes(profile?.role));

  const links = profile?.role === 'paciente' ? patientLinks : staffLinks;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-large-text', accessibility.largeText);
    root.classList.toggle('a11y-high-contrast', accessibility.highContrast);
    root.classList.toggle('a11y-reduce-motion', accessibility.reduceMotion);
    localStorage.setItem('srd-accessibility', JSON.stringify(accessibility));
  }, [accessibility]);

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  function togglePreference(key) {
    setAccessibility((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className={`app-shell ${profile?.role === 'paciente' ? 'patient-shell' : ''}`}>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${profile?.role === 'paciente' ? 'patient-sidebar' : ''}`}>
        <div className="brand">
          <img src="/logo-srd.jpg" alt="SRD Sala de Rehabilitación Deportiva" />
        </div>

        <div className="sidebar-role-card">
          <div className="sidebar-role-icon"><ShieldCheck size={18} /></div>
          <div>
            <strong>{roleLabels[profile?.role] || 'Usuario'}</strong>
            <span>{roleDescriptions[profile?.role] || 'Acceso seguro'}</span>
          </div>
        </div>

        <div className="nav-caption">{profile?.role === 'paciente' ? 'MI MENÚ' : 'MENÚ PRINCIPAL'}</div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={profile?.role === 'paciente' ? 22 : 19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {profile?.role === 'paciente' && (
            <button className="accessibility-button" onClick={() => setAccessibilityOpen(true)}>
              <Accessibility size={20} /> Accesibilidad
            </button>
          )}
          <div className="secure-note"><span className="secure-dot" /> Sesión protegida</div>
          <button className="logout-button" onClick={logout}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {open && <div className="mobile-overlay" onClick={() => setOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-label="Abrir menú">
            {open ? <X /> : <Menu />}
          </button>

          <div className="topbar-brand">
            <span className="topbar-kicker">SRD</span>
            <span className="topbar-title">Plataforma de Rehabilitación</span>
          </div>

          <div className="topbar-spacer" />

          {profile?.role === 'paciente' && (
            <button className="topbar-accessibility" onClick={() => setAccessibilityOpen(true)} title="Opciones de accesibilidad">
              <Accessibility size={19} /> <span>Accesibilidad</span>
            </button>
          )}

          <div className="user-chip">
            <div className="avatar">{profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <div>
              <strong>{profile?.full_name || 'Usuario'}</strong>
              <small>{roleLabels[profile?.role] || profile?.role}</small>
            </div>
          </div>
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>

      {accessibilityOpen && (
        <div className="modal-backdrop" onClick={() => setAccessibilityOpen(false)}>
          <div className="modal accessibility-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">PERSONALIZA LA VISTA</span>
                <h2>Accesibilidad</h2>
              </div>
              <button className="icon-button" onClick={() => setAccessibilityOpen(false)} aria-label="Cerrar"><X /></button>
            </div>

            <p className="accessibility-intro">Puedes activar estas opciones si te resulta más cómodo leer textos grandes, usar mayor contraste o reducir las animaciones.</p>

            <button className={`accessibility-option ${accessibility.largeText ? 'selected' : ''}`} onClick={() => togglePreference('largeText')}>
              <div className="accessibility-option-icon"><Type size={24} /></div>
              <div><strong>Texto más grande</strong><span>Aumenta el tamaño de textos y botones.</span></div>
              <b>{accessibility.largeText ? 'Activado' : 'Desactivado'}</b>
            </button>

            <button className={`accessibility-option ${accessibility.highContrast ? 'selected' : ''}`} onClick={() => togglePreference('highContrast')}>
              <div className="accessibility-option-icon"><Accessibility size={24} /></div>
              <div><strong>Alto contraste</strong><span>Oscurece los textos y resalta los bordes.</span></div>
              <b>{accessibility.highContrast ? 'Activado' : 'Desactivado'}</b>
            </button>

            <button className={`accessibility-option ${accessibility.reduceMotion ? 'selected' : ''}`} onClick={() => togglePreference('reduceMotion')}>
              <div className="accessibility-option-icon"><ZapOff size={24} /></div>
              <div><strong>Reducir animaciones</strong><span>Evita movimientos innecesarios en la pantalla.</span></div>
              <b>{accessibility.reduceMotion ? 'Activado' : 'Desactivado'}</b>
            </button>

            <button className="primary-button full accessibility-done" onClick={() => setAccessibilityOpen(false)}>Listo</button>
          </div>
        </div>
      )}
    </div>
  );
}
