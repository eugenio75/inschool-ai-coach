export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          child_profile_id: string
          created_at: string
          description: string | null
          earned: boolean | null
          earned_date: string | null
          emoji: string
          id: string
          name: string
          quality: string
        }
        Insert: {
          child_profile_id: string
          created_at?: string
          description?: string | null
          earned?: boolean | null
          earned_date?: string | null
          emoji: string
          id?: string
          name: string
          quality: string
        }
        Update: {
          child_profile_id?: string
          created_at?: string
          description?: string | null
          earned?: boolean | null
          earned_date?: string | null
          emoji?: string
          id?: string
          name?: string
          quality?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          access_code: string | null
          age: number | null
          avatar_emoji: string | null
          city: string | null
          class_section: string | null
          created_at: string
          difficult_subjects: string[] | null
          favorite_subjects: string[] | null
          focus_time: number | null
          gender: string | null
          id: string
          interests: string[] | null
          name: string
          onboarding_completed: boolean | null
          parent_id: string
          school_level: string | null
          school_name: string | null
          struggles: string[] | null
          support_style: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          age?: number | null
          avatar_emoji?: string | null
          city?: string | null
          class_section?: string | null
          created_at?: string
          difficult_subjects?: string[] | null
          favorite_subjects?: string[] | null
          focus_time?: number | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          name: string
          onboarding_completed?: boolean | null
          parent_id: string
          school_level?: string | null
          school_name?: string | null
          struggles?: string[] | null
          support_style?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          age?: number | null
          avatar_emoji?: string | null
          city?: string | null
          class_section?: string | null
          created_at?: string
          difficult_subjects?: string[] | null
          favorite_subjects?: string[] | null
          focus_time?: number | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          name?: string
          onboarding_completed?: boolean | null
          parent_id?: string
          school_level?: string | null
          school_name?: string | null
          struggles?: string[] | null
          support_style?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      classi: {
        Row: {
          codice_invito: string | null
          created_at: string | null
          docente_profile_id: string
          id: string
          materia: string | null
          nome: string
          num_studenti: number | null
          ordine_scolastico: string | null
        }
        Insert: {
          codice_invito?: string | null
          created_at?: string | null
          docente_profile_id: string
          id?: string
          materia?: string | null
          nome: string
          num_studenti?: number | null
          ordine_scolastico?: string | null
        }
        Update: {
          codice_invito?: string | null
          created_at?: string | null
          docente_profile_id?: string
          id?: string
          materia?: string | null
          nome?: string
          num_studenti?: number | null
          ordine_scolastico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classi_docente_profile_id_fkey"
            columns: ["docente_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          created_at: string | null
          id: string
          materia: string | null
          messaggi: Json | null
          profile_id: string
          ruolo_utente: string | null
          titolo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          materia?: string | null
          messaggi?: Json | null
          profile_id: string
          ruolo_utente?: string | null
          titolo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          materia?: string | null
          messaggi?: Json | null
          profile_id?: string
          ruolo_utente?: string | null
          titolo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_missions: {
        Row: {
          child_profile_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          mission_date: string
          mission_type: string
          points_reward: number
          title: string
        }
        Insert: {
          child_profile_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          mission_date?: string
          mission_type: string
          points_reward?: number
          title: string
        }
        Update: {
          child_profile_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          mission_date?: string
          mission_type?: string
          points_reward?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_missions_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emotional_alerts: {
        Row: {
          alert_level: string
          child_profile_id: string
          created_at: string
          id: string
          message: string
          pattern_data: Json | null
          read: boolean
          title: string
        }
        Insert: {
          alert_level?: string
          child_profile_id: string
          created_at?: string
          id?: string
          message: string
          pattern_data?: Json | null
          read?: boolean
          title: string
        }
        Update: {
          alert_level?: string
          child_profile_id?: string
          created_at?: string
          id?: string
          message?: string
          pattern_data?: Json | null
          read?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "emotional_alerts_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emotional_checkins: {
        Row: {
          checkin_date: string
          child_profile_id: string
          created_at: string
          emotional_tone: string | null
          energy_level: string | null
          id: string
          responses: Json
          signals: string[] | null
        }
        Insert: {
          checkin_date?: string
          child_profile_id: string
          created_at?: string
          emotional_tone?: string | null
          energy_level?: string | null
          id?: string
          responses?: Json
          signals?: string[] | null
        }
        Update: {
          checkin_date?: string
          child_profile_id?: string
          created_at?: string
          emotional_tone?: string | null
          energy_level?: string | null
          id?: string
          responses?: Json
          signals?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "emotional_checkins_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      esami_utente: {
        Row: {
          completato: boolean | null
          created_at: string | null
          data_prevista: string | null
          id: string
          nome_esame: string
          profile_id: string
        }
        Insert: {
          completato?: boolean | null
          created_at?: string | null
          data_prevista?: string | null
          id?: string
          nome_esame: string
          profile_id: string
        }
        Update: {
          completato?: boolean | null
          created_at?: string | null
          data_prevista?: string | null
          id?: string
          nome_esame?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esami_utente_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          autonomy_points: number | null
          child_profile_id: string
          completed_at: string
          consistency_points: number | null
          duration_seconds: number
          emotion: string | null
          focus_points: number | null
          id: string
          task_id: string | null
        }
        Insert: {
          autonomy_points?: number | null
          child_profile_id: string
          completed_at?: string
          consistency_points?: number | null
          duration_seconds?: number
          emotion?: string | null
          focus_points?: number | null
          id?: string
          task_id?: string | null
        }
        Update: {
          autonomy_points?: number | null
          child_profile_id?: string
          completed_at?: string
          consistency_points?: number | null
          duration_seconds?: number
          emotion?: string | null
          focus_points?: number | null
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "homework_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification: {
        Row: {
          autonomy_points: number | null
          child_profile_id: string
          consistency_points: number | null
          created_at: string
          focus_points: number | null
          id: string
          last_activity_date: string | null
          next_shield_at: number | null
          streak: number | null
          streak_shields: number | null
          updated_at: string
        }
        Insert: {
          autonomy_points?: number | null
          child_profile_id: string
          consistency_points?: number | null
          created_at?: string
          focus_points?: number | null
          id?: string
          last_activity_date?: string | null
          next_shield_at?: number | null
          streak?: number | null
          streak_shields?: number | null
          updated_at?: string
        }
        Update: {
          autonomy_points?: number | null
          child_profile_id?: string
          consistency_points?: number | null
          created_at?: string
          focus_points?: number | null
          id?: string
          last_activity_date?: string | null
          next_shield_at?: number | null
          streak?: number | null
          streak_shields?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: true
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_tasks: {
        Row: {
          child_profile_id: string
          completed: boolean | null
          created_at: string
          description: string | null
          difficulty: number | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          key_concepts: string[] | null
          micro_steps: Json | null
          recall_questions: string[] | null
          source_image_url: string | null
          source_type: string | null
          subject: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          child_profile_id: string
          completed?: boolean | null
          created_at?: string
          description?: string | null
          difficulty?: number | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          key_concepts?: string[] | null
          micro_steps?: Json | null
          recall_questions?: string[] | null
          source_image_url?: string | null
          source_type?: string | null
          subject: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          child_profile_id?: string
          completed?: boolean | null
          created_at?: string
          description?: string | null
          difficulty?: number | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          key_concepts?: string[] | null
          micro_steps?: Json | null
          recall_questions?: string[] | null
          source_image_url?: string | null
          source_type?: string | null
          subject?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_tasks_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_items: {
        Row: {
          child_profile_id: string
          concept: string
          created_at: string
          id: string
          last_reviewed: string | null
          recall_questions: string[] | null
          strength: number | null
          subject: string
          summary: string | null
        }
        Insert: {
          child_profile_id: string
          concept: string
          created_at?: string
          id?: string
          last_reviewed?: string | null
          recall_questions?: string[] | null
          strength?: number | null
          subject: string
          summary?: string | null
        }
        Update: {
          child_profile_id?: string
          concept?: string
          created_at?: string
          id?: string
          last_reviewed?: string | null
          recall_questions?: string[] | null
          strength?: number | null
          subject?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_items_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_settings: {
        Row: {
          created_at: string
          id: string
          parent_pin: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_pin?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_pin?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ricerche_bibliografiche: {
        Row: {
          argomento: string
          created_at: string | null
          id: string
          num_fonti: number | null
          profile_id: string
          risultati: Json | null
        }
        Insert: {
          argomento: string
          created_at?: string | null
          id?: string
          num_fonti?: number | null
          profile_id: string
          risultati?: Json | null
        }
        Update: {
          argomento?: string
          created_at?: string | null
          id?: string
          num_fonti?: number | null
          profile_id?: string
          risultati?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ricerche_bibliografiche_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessioni_studio: {
        Row: {
          created_at: string | null
          durata_minuti: number
          id: string
          materia: string | null
          profile_id: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          durata_minuti: number
          id?: string
          materia?: string | null
          profile_id: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          durata_minuti?: number
          id?: string
          materia?: string | null
          profile_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessioni_studio_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          adaptive_profile: Json | null
          bloom_level_current: number | null
          cognitive_dynamic_profile: Json | null
          created_at: string | null
          current_step: number | null
          data: Json | null
          emotional_cognitive_correlation: number | null
          id: string
          mood_streak: number | null
          profile_id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          adaptive_profile?: Json | null
          bloom_level_current?: number | null
          cognitive_dynamic_profile?: Json | null
          created_at?: string | null
          current_step?: number | null
          data?: Json | null
          emotional_cognitive_correlation?: number | null
          id?: string
          mood_streak?: number | null
          profile_id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          adaptive_profile?: Json | null
          bloom_level_current?: number | null
          cognitive_dynamic_profile?: Json | null
          created_at?: string | null
          current_step?: number | null
          data?: Json | null
          emotional_cognitive_correlation?: number | null
          id?: string
          mood_streak?: number | null
          profile_id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verifiche: {
        Row: {
          argomento: string
          contenuto: string | null
          created_at: string | null
          difficolta: string | null
          docente_profile_id: string
          id: string
          materia: string | null
          numero_domande: number | null
          tipo: string | null
        }
        Insert: {
          argomento: string
          contenuto?: string | null
          created_at?: string | null
          difficolta?: string | null
          docente_profile_id: string
          id?: string
          materia?: string | null
          numero_domande?: number | null
          tipo?: string | null
        }
        Update: {
          argomento?: string
          contenuto?: string | null
          created_at?: string | null
          difficolta?: string | null
          docente_profile_id?: string
          id?: string
          materia?: string | null
          numero_domande?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifiche_docente_profile_id_fkey"
            columns: ["docente_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_child_access_code: { Args: never; Returns: string }
      owns_child_profile: { Args: { profile_id: string }; Returns: boolean }
      validate_child_code: { Args: { code: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
