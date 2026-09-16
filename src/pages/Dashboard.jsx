import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Flame,
  HelpCircle,
  Medal,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserCog,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentWeek, getLevelMeta, loadPatientRewards, toDateKey } from '../lib/rewards';

const roleCopy = {
  admin: {
    eyebrow: 'CONTROL GENERAL SRD',
    title: 'Gestión del centro en un solo lugar',
    text: 'Administra usuarios, revisa la operación clínica y mantén el control de pacientes, ejercicios y sesiones.',
    icon: ShieldCheck
  },
  kinesiologo: {
    eyebrow: 'SEGUIMIENTO CLÍNICO',
    title: 'Tus pacientes, ejercicios y sesiones',
    text: 'Organiza la rehabilitación, asigna ejercicios y supervisa la información registrada durante cada sesión.',
    icon: Activity
  }
};

export default function Dashboard({ profile }) {
  if (profile.role === 'paciente') return <PatientDashboard profile={profile} />;
  return <StaffDashboard profile={profile} />;
}

function PatientDashboard({ profile }) {
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [rewards, setRewards] = useState({ total_points: 0, current_streak: 0, best_streak: 0, level: 'Comenzando' });
  const [earnedCount, setEarnedCount] = useState(0);

  useEffect(() => {
    async function load() {
      const [assignmentsResult, sessionsResult] = await Promise.all([
        supabase
          .from('assignments')
          .select('id,series,repetitions,frequency,exercises:exercise_id(id,name,description)')
          .eq('patient_id', profile.id)
          .eq('active', true),
        supabase
          .from('sessions')
          .select('id,status,started_at,ended_at,exercise_id,exercises:exercise_id(name)')
          .eq('patient_id', profile.id)
          .order('started_at', { ascending: false })
      ]);

      setAssignments(assignmentsResult.data || []);
      setSessions(sessionsResult.data || []);

      try {
        const rewardData = await loadPatientRewards(profile.id);
        setRewards(rewardData.rewards);
        setEarnedCount(rewardData.earned.length);
      } catch (error) {
        console.warn('Gamificación todavía no configurada:', error);
      }
    }

    load();
  }, [profile.id]);

  const firstName = profile.full_name?.split(' ')[0] || 'Paciente';
  const nextAssignment = assignments[0] || null;
  const completedSessions = sessions.filter((s) => s.status === 'completada');
  const inProgress = sessions.find((s) => s.status === 'en_progreso');
  const week = getCurrentWeek();
  const completedDates = useMemo(
    () => new Set(completedSessions.map((session) => toDateKey(session.ended_at || session.started_at))),
    [completedSessions]
  );
  const level = getLevelMeta(rewards.level);

  return (
    <div className="patient-dashboard">
      <section className="patient-welcome-card">
        <div className="patient-welcome-copy">
          <span className="patient-kicker">TU RECUPERACIÓN SRD</span>
          <h1>Hola, {firstName} 👋</h1>
          <p>Todo lo importante está aquí. Avanza paso a paso y, si tienes dudas, puedes usar el botón de ayuda.</p>
        </div>
        <div className="patient-welcome-icon"><Sparkles size={42} /></div>
      </section>

      <section className="patient-today-card">
        <div className="patient-today-icon"><Dumbbell size={30} /></div>
        <div className="patient-today-copy">
          <span className="patient-kicker">TU SESIÓN</span>
          <h2>{inProgress ? 'Tienes una sesión en curso' : nextAssignment ? 'Tu ejercicio está listo' : 'No tienes ejercicios pendientes'}</h2>
          {inProgress ? (
            <p>Continúa tu sesión y finalízala cuando hayas terminado las indicaciones de tu kinesiólogo.</p>
          ) : nextAssignment ? (
            <p><strong>{nextAssignment.exercises?.name}</strong> · {nextAssignment.series} series de {nextAssignment.repetitions} repeticiones</p>
          ) : (
            <p>Cuando tu kinesiólogo asigne un ejercicio, aparecerá aquí.</p>
          )}
        </div>
        <Link className="patient-main-action" to="/my-care">
          <PlayCircle size={24} />
          {inProgress ? 'Continuar mi sesión' : 'Ver mi rehabilitación'}
        </Link>
      </section>

      <div className="patient-reward-grid">
        <Link to="/rewards" className="patient-reward-card points-card">
          <div className="reward-icon"><Star size={25} /></div>
          <span>Mis puntos</span>
          <strong>{rewards.total_points || 0}</strong>
          <small>Por tu constancia</small>
        </Link>
        <Link to="/rewards" className="patient-reward-card streak-card">
          <div className="reward-icon"><Flame size={25} /></div>
          <span>Racha actual</span>
          <strong>{rewards.current_streak || 0}</strong>
          <small>Sesiones / días de constancia</small>
        </Link>
        <Link to="/rewards" className="patient-reward-card level-card">
          <div className="reward-emoji" aria-hidden="true">{level.icon}</div>
          <span>Mi nivel</span>
          <strong className="reward-level-name">{rewards.level || 'Comenzando'}</strong>
          <small>{earnedCount} logros conseguidos</small>
        </Link>
      </div>

      <div className="patient-home-grid">
        <section className="patient-simple-panel">
          <div className="patient-panel-title">
            <div><CalendarDays size={24} /><div><span>ESTA SEMANA</span><h2>Mi avance</h2></div></div>
            <strong>{completedSessions.length} sesiones completadas</strong>
          </div>
          <div className="week-tracker" aria-label="Progreso semanal">
            {week.map((day) => {
              const done = completedDates.has(day.key);
              return (
                <div className={`week-day ${done ? 'done' : ''} ${day.isToday ? 'today' : ''}`} key={day.key}>
                  <span>{day.label}</span>
                  <b>{day.number}</b>
                  <small>{done ? <CheckCircle2 size={18} /> : '—'}</small>
                </div>
              );
            })}
          </div>
          <p className="friendly-note">Cada sesión completada suma a tu progreso. No necesitas competir con nadie: el objetivo es avanzar a tu propio ritmo.</p>
        </section>

        <section className="patient-simple-panel help-panel">
          <div className="help-big-icon"><HelpCircle size={32} /></div>
          <span className="patient-kicker">AYUDA RÁPIDA</span>
          <h2>¿Necesitas ayuda?</h2>
          <p>Encuentra instrucciones simples para iniciar una sesión, usar tus ejercicios o saber qué hacer si pierdes la conexión.</p>
          <Link className="patient-secondary-action" to="/help">Ver ayuda paso a paso <ArrowRight size={19} /></Link>
        </section>
      </div>

      <section className="patient-achievement-strip">
        <div className="achievement-strip-icon"><Trophy size={27} /></div>
        <div>
          <span>RECOMPENSAS</span>
          <strong>Has conseguido {earnedCount} {earnedCount === 1 ? 'logro' : 'logros'}.</strong>
        </div>
        <Link to="/rewards">Ver mis logros <Medal size={18} /></Link>
      </section>
    </div>
  );
}

function StaffDashboard({ profile }) {
  const [stats, setStats] = useState({ patients: 0, exercises: 0, assignments: 0, sessions: 0 });

  useEffect(() => {
    async function load() {
      let patientsQuery = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'paciente').eq('active', true);
      let assignmentQuery = supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('active', true);
      let sessionQuery = supabase.from('sessions').select('id', { count: 'exact', head: true });

      if (profile.role === 'kinesiologo') {
        patientsQuery = patientsQuery.eq('assigned_kinesiologo_id', profile.id);
        assignmentQuery = assignmentQuery.eq('kinesiologo_id', profile.id);
        sessionQuery = sessionQuery.eq('kinesiologo_id', profile.id);
      }

      const [p, e, a, s] = await Promise.all([
        patientsQuery,
        supabase.from('exercises').select('id', { count: 'exact', head: true }).eq('active', true),
        assignmentQuery,
        sessionQuery
      ]);

      setStats({
        patients: p.count || 0,
        exercises: e.count || 0,
        assignments: a.count || 0,
        sessions: s.count || 0
      });
    }

    load();
  }, [profile.id, profile.role]);

  const copy = roleCopy[profile.role];
  const HeroIcon = copy.icon;
  const firstName = profile.full_name?.split(' ')[0] || 'Usuario';

  const cards = [
    { label: profile.role === 'kinesiologo' ? 'Mis pacientes' : 'Pacientes activos', value: stats.patients, icon: Users, tone: 'blue' },
    { label: 'Ejercicios activos', value: stats.exercises, icon: Dumbbell, tone: 'green' },
    { label: 'Asignaciones activas', value: stats.assignments, icon: ClipboardCheck, tone: 'cyan' },
    { label: 'Sesiones registradas', value: stats.sessions, icon: Activity, tone: 'amber' }
  ];

  const quickActions = profile.role === 'admin'
    ? [
        { to: '/users', title: 'Gestionar usuarios', text: 'Crear administradores, kinesiólogos y pacientes.', icon: UserCog },
        { to: '/patients', title: 'Revisar pacientes', text: 'Consulta los pacientes registrados y su estado.', icon: Users },
        { to: '/exercises', title: 'Catálogo de ejercicios', text: 'Crea ejercicios y configura hasta 3 sensores.', icon: Dumbbell }
      ]
    : [
        { to: '/patients', title: 'Mis pacientes', text: 'Registra y consulta pacientes asociados a tu atención.', icon: Users },
        { to: '/assignments', title: 'Asignar ejercicios', text: 'Define series, repeticiones y frecuencia.', icon: ClipboardCheck },
        { to: '/sessions', title: 'Monitorear sesiones', text: 'Revisa las sesiones y las lecturas de sensores.', icon: Activity }
      ];

  return (
    <div>
      <PageTitle eyebrow="PORTAL SRD" title={`Hola, ${firstName} 👋`} subtitle="Resumen de actividad de la plataforma." />

      <section className={`dashboard-hero role-${profile.role}`}>
        <div className="dashboard-hero-copy">
          <span className="hero-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.text}</p>
        </div>
        <div className="hero-visual"><HeroIcon size={64} strokeWidth={1.45} /></div>
      </section>

      <div className="stats-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon tone-${tone}`}><Icon size={22} /></div>
            <div><span>{label}</span><strong>{value}</strong></div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel panel-featured">
          <div className="panel-heading-row">
            <div><span className="section-kicker">ACCESOS RÁPIDOS</span><h3>¿Qué necesitas hacer?</h3></div>
          </div>
          <div className="quick-action-grid">
            {quickActions.map(({ to, title, text, icon: Icon }) => (
              <Link className="quick-action" to={to} key={to}>
                <div className="quick-action-icon"><Icon size={21} /></div>
                <div className="quick-action-copy"><strong>{title}</strong><span>{text}</span></div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </section>

        <aside className="panel security-card">
          <div className="security-badge"><ShieldCheck size={22} /></div>
          <span className="section-kicker">ACCESO POR ROL</span>
          <h3>Información protegida</h3>
          <p>La plataforma muestra solo las funciones y datos autorizados para tu perfil.</p>
          <div className="security-line"><span /> Autenticación activa</div>
          <div className="security-line"><span /> Políticas RLS en Supabase</div>
          <div className="security-line"><span /> Sesiones asociadas al usuario</div>
        </aside>
      </div>
    </div>
  );
}

export function PageTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="section-kicker">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
