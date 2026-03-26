
-- Teacher chats table
CREATE TABLE public.teacher_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES public.classi(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_chats" ON public.teacher_chats
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Teacher chat messages table
CREATE TABLE public.teacher_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.teacher_chats(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_chat_messages" ON public.teacher_chat_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_chats
      WHERE teacher_chats.id = teacher_chat_messages.chat_id
        AND teacher_chats.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_chats
      WHERE teacher_chats.id = teacher_chat_messages.chat_id
        AND teacher_chats.teacher_id = auth.uid()
    )
  );
