CREATE TABLE public.crisis_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  trigger_message text NOT NULL,
  session_status text NOT NULL DEFAULT 'crisis'
);

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from edge function); no client access
CREATE POLICY "No public access to crisis_events"
  ON public.crisis_events
  FOR ALL
  TO authenticated
  USING (false);