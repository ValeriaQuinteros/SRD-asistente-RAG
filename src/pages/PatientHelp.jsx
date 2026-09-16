import React from 'react';
import { Activity, CircleHelp, CloudOff, Dumbbell, LogOut, MousePointerClick, PhoneCall, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageTitle } from './Dashboard';

const steps = [
  {
    icon: MousePointerClick,
    title: '1. Entra a “Mi rehabilitación”',
    text: 'Ahí verás únicamente los ejercicios que tu kinesiólogo te dejó preparados.'
  },
  {
    icon: Dumbbell,
    title: '2. Revisa tu ejercicio',
    text: 'Lee el nombre, las series, repeticiones y las indicaciones. Si algo no está claro, consulta antes de continuar.'
  },
  {
    icon: Activity,
    title: '3. Presiona “Iniciar mi sesión”',
    text: 'Realiza tu ejercicio siguiendo la guía indicada. Cuando termines, presiona “Finalizar mi sesión”.'
  }
];

export default function PatientHelp() {
  return (
    <div className="patient-friendly-page">
      <PageTitle
        eyebrow="AYUDA"
        title="¿Necesitas ayuda?"
        subtitle="Estas instrucciones están escritas paso a paso para que usar SRD sea sencillo desde celular, tablet o computador."
      />

      <section className="help-hero-card">
        <div className="help-hero-icon"><CircleHelp size={38} /></div>
        <div>
          <h2>Cómo realizar una sesión</h2>
          <p>No necesitas conocer de tecnología. Sigue estos tres pasos y la plataforma te irá indicando qué hacer.</p>
        </div>
      </section>

      <div className="help-step-grid">
        {steps.map(({ icon: Icon, title, text }) => (
          <article className="help-step-card" key={title}>
            <div className="help-step-icon"><Icon size={27} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="help-detail-grid">
        <section className="patient-simple-panel">
          <div className="help-detail-title"><CloudOff size={24} /><h2>Si se corta Internet</h2></div>
          <p>No cierres todo inmediatamente. Espera unos segundos y revisa tu conexión. Cuando vuelva Internet, actualiza la página. Si una sesión no quedó registrada, comunícalo a tu kinesiólogo.</p>
        </section>

        <section className="patient-simple-panel">
          <div className="help-detail-title"><ShieldCheck size={24} /><h2>Tu información está protegida</h2></div>
          <p>Solo puedes ver la información asociada a tu propia cuenta. No compartas tu contraseña y recuerda cerrar sesión si usas un dispositivo que no es tuyo.</p>
        </section>

        <section className="patient-simple-panel">
          <div className="help-detail-title"><LogOut size={24} /><h2>Cómo cerrar sesión</h2></div>
          <p>Abre el menú y presiona el botón rojo “Cerrar sesión”. Así evitas que otra persona entre a tu cuenta desde ese dispositivo.</p>
        </section>

        <section className="patient-simple-panel">
          <div className="help-detail-title"><PhoneCall size={24} /><h2>¿Todavía tienes dudas?</h2></div>
          <p>Contacta a la clínica o a tu kinesiólogo por el canal que te hayan indicado. No realices un ejercicio si no estás seguro de las instrucciones.</p>
        </section>
      </div>

      <div className="help-bottom-action">
        <Link to="/my-care" className="patient-main-action"><Dumbbell size={22} /> Ir a mi rehabilitación</Link>
      </div>
    </div>
  );
}
