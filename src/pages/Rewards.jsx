import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Flame, LockKeyhole, Medal, Star, Trophy } from 'lucide-react';
import { loadPatientRewards } from '../lib/rewards';
import { supabase } from '../lib/supabase';
import { PageTitle } from './Dashboard';

export default function Rewards({ profile }) {
  const [rewardData, setRewardData] = useState({
    rewards: { total_points: 0, current_streak: 0, best_streak: 0, level: 'Comenzando' },
    earned: [],
    catalog: []
  });
  const [completedSessions, setCompletedSessions] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [rewardsResult, sessionsResult] = await Promise.all([
          loadPatientRewards(profile.id),
          supabase
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', profile.id)
            .eq('status', 'completada')
        ]);
        setRewardData(rewardsResult);
        setCompletedSessions(sessionsResult.count || 0);
      } catch (error) {
        console.warn('No se pudo cargar la gamificación:', error);
      }
    }
    load();
  }, [profile.id]);

  const earnedIds = useMemo(
    () => new Set(rewardData.earned.map((item) => item.achievement_id)),
    [rewardData.earned]
  );

  const nextAchievement = rewardData.catalog.find((item) => !earnedIds.has(item.id));
  const progress = nextAchievement
    ? Math.min(100, Math.round((completedSessions / nextAchievement.required_sessions) * 100))
    : 100;

  return (
    <div className="patient-friendly-page">
      <PageTitle
        eyebrow="MIS RECOMPENSAS"
        title="Mis logros"
        subtitle="Cada sesión completada suma puntos y reconoce tu constancia. Aquí no compites con nadie: solo celebramos tu propio avance."
      />

      <div className="reward-summary-grid">
        <div className="reward-summary-card reward-blue">
          <Star size={29} />
          <span>Puntos acumulados</span>
          <strong>{rewardData.rewards.total_points || 0}</strong>
          <small>100 puntos por sesión + bonos por logros</small>
        </div>
        <div className="reward-summary-card reward-green">
          <Flame size={29} />
          <span>Racha actual</span>
          <strong>{rewardData.rewards.current_streak || 0}</strong>
          <small>Mejor racha: {rewardData.rewards.best_streak || 0}</small>
        </div>
        <div className="reward-summary-card reward-gold">
          <Trophy size={29} />
          <span>Mi nivel</span>
          <strong className="reward-level-large">{rewardData.rewards.level || 'Comenzando'}</strong>
          <small>{completedSessions} sesiones completadas</small>
        </div>
      </div>

      <section className="patient-simple-panel next-reward-panel">
        <div className="patient-panel-title">
          <div><Medal size={25} /><div><span>PRÓXIMO OBJETIVO</span><h2>{nextAchievement ? nextAchievement.name : '¡Todos los logros conseguidos!'}</h2></div></div>
        </div>
        {nextAchievement ? (
          <>
            <p>{nextAchievement.description}</p>
            <div className="reward-progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="reward-progress-copy"><strong>{completedSessions} de {nextAchievement.required_sessions} sesiones</strong><span>+{nextAchievement.points_reward} puntos al conseguirlo</span></div>
          </>
        ) : (
          <p>Has completado todos los hitos disponibles. Sigue cuidando tu constancia y celebrando cada avance.</p>
        )}
      </section>

      <section className="patient-simple-panel">
        <div className="patient-panel-title">
          <div><Award size={25} /><div><span>INSIGNIAS</span><h2>Mi colección de logros</h2></div></div>
          <strong>{earnedIds.size} conseguidos</strong>
        </div>

        <div className="achievement-grid">
          {rewardData.catalog.map((achievement) => {
            const earned = earnedIds.has(achievement.id);
            return (
              <article className={`achievement-card ${earned ? 'earned' : 'locked'}`} key={achievement.id}>
                <div className="achievement-icon" aria-hidden="true">{achievement.icon}</div>
                <div className="achievement-copy">
                  <div className="achievement-state">
                    {earned ? <><CheckCircle2 size={17} /> Conseguido</> : <><LockKeyhole size={16} /> Por conseguir</>}
                  </div>
                  <h3>{achievement.name}</h3>
                  <p>{achievement.description}</p>
                  <small>{achievement.required_sessions} sesiones · +{achievement.points_reward} puntos</small>
                </div>
              </article>
            );
          })}
          {!rewardData.catalog.length && (
            <div className="empty empty-wide"><Medal size={34} /><p>Los logros aparecerán cuando activemos la actualización de recompensas en Supabase.</p></div>
          )}
        </div>
      </section>

      <div className="friendly-reward-note">
        <Medal size={22} />
        <div><strong>Tu recuperación no es una competencia.</strong><span>Los puntos reconocen la constancia y el cumplimiento de sesiones, no comparan tu rendimiento físico con el de otras personas.</span></div>
      </div>
    </div>
  );
}
