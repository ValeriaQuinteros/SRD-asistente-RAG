import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Exercises from './pages/Exercises';
import Assignments from './pages/Assignments';
import Sessions from './pages/Sessions';
import PatientHome from './pages/PatientHome';
import Users from './pages/Users';
import Rewards from './pages/Rewards';
import PatientHelp from './pages/PatientHelp';
import Assistant from './pages/Assistant';

function ProtectedRoute({ session, profile, roles, children }) {
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <div className="loading-page"><span className="loading-mark">SRD</span><span>Cargando perfil…</span></div>;

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('No se pudo cargar el perfil:', error);
      setProfile(null);
      return;
    }

    if (!data.active) {
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }

    setProfile(data);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) await loadProfile(nextSession.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="loading-page"><span className="loading-mark">SRD</span><span>Cargando plataforma…</span></div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route element={
        <ProtectedRoute session={session} profile={profile}>
          <Layout profile={profile} />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard profile={profile} />} />

        <Route path="/patients" element={
          <ProtectedRoute session={session} profile={profile} roles={['admin', 'kinesiologo']}>
            <Patients profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/exercises" element={
          <ProtectedRoute session={session} profile={profile} roles={['admin', 'kinesiologo']}>
            <Exercises profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/assignments" element={
          <ProtectedRoute session={session} profile={profile} roles={['admin', 'kinesiologo']}>
            <Assignments profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/sessions" element={
          <ProtectedRoute session={session} profile={profile} roles={['admin', 'kinesiologo', 'paciente']}>
            <Sessions profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/assistant" element={
          <ProtectedRoute session={session} profile={profile} roles={['admin', 'kinesiologo', 'paciente']}>
            <Assistant profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/users" element={
          <ProtectedRoute session={session} profile={profile} roles={['admin']}>
            <Users profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/my-care" element={
          <ProtectedRoute session={session} profile={profile} roles={['paciente']}>
            <PatientHome profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/rewards" element={
          <ProtectedRoute session={session} profile={profile} roles={['paciente']}>
            <Rewards profile={profile} />
          </ProtectedRoute>
        } />

        <Route path="/help" element={
          <ProtectedRoute session={session} profile={profile} roles={['paciente']}>
            <PatientHelp profile={profile} />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
