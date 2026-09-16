import { supabase } from './supabase';

export const levelOrder = [
  { name: 'Comenzando', min: 0, icon: '🌱' },
  { name: 'En progreso', min: 1, icon: '🚶' },
  { name: 'Constante', min: 5, icon: '💪' },
  { name: 'Comprometido', min: 10, icon: '⭐' },
  { name: 'Gran progreso', min: 25, icon: '🏆' },
  { name: 'Imparable', min: 50, icon: '🔥' }
];

export function getLevelMeta(name = 'Comenzando') {
  return levelOrder.find((item) => item.name === name) || levelOrder[0];
}

export async function loadPatientRewards(patientId) {
  const [{ data: rewards }, { data: earned }, { data: catalog }] = await Promise.all([
    supabase
      .from('patient_rewards')
      .select('patient_id,total_points,current_streak,best_streak,level,last_completed_date,updated_at')
      .eq('patient_id', patientId)
      .maybeSingle(),
    supabase
      .from('patient_achievements')
      .select('achievement_id,earned_at')
      .eq('patient_id', patientId),
    supabase
      .from('achievements')
      .select('id,name,description,icon,required_sessions,points_reward')
      .order('required_sessions', { ascending: true })
  ]);

  return {
    rewards: rewards || {
      patient_id: patientId,
      total_points: 0,
      current_streak: 0,
      best_streak: 0,
      level: 'Comenzando',
      last_completed_date: null
    },
    earned: earned || [],
    catalog: catalog || []
  };
}

export function getCurrentWeek() {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - day + 1);

  const formatter = new Intl.DateTimeFormat('es-CL', { weekday: 'short' });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      label: formatter.format(date).replace('.', '').slice(0, 1).toUpperCase(),
      number: date.getDate(),
      isToday: toDateKey(date) === toDateKey(today)
    };
  });
}

export function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
