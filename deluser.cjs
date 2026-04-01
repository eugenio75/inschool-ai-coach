const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://iylspdscllcstgfipydc.supabase.co', process.env.SUPABASE_SERVICE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});
(async () => {
  const userId = '2692504c-d13a-478c-89c9-fe9f52364b2e';
  const tables = ['classi','class_enrollments','homework_tasks','guided_sessions','study_steps','flashcards','badges','learning_errors','emotional_checkins','daily_missions','focus_sessions','memory_items','gamification','child_profiles'];
  const cols = ['user_id','parent_id','teacher_id','docente_id','profile_id','child_profile_id','student_id','reported_by'];
  for (const t of tables) {
    for (const col of cols) {
      const { data } = await sb.from(t).select('id').eq(col, userId).limit(1);
      if (data && data.length > 0) {
        await sb.from(t).delete().eq(col, userId);
        console.log('Eliminato:', t, col);
      }
    }
  }
  const { error } = await sb.auth.admin.deleteUser(userId);
  console.log(error ? 'ERRORE: ' + error.message : 'Utente eliminato con successo');
})();
