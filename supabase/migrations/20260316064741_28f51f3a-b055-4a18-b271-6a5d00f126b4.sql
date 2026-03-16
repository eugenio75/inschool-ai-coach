CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'delete-completed-tasks-midnight',
  '0 0 * * *',
  $$DELETE FROM public.homework_tasks WHERE completed = true$$
);