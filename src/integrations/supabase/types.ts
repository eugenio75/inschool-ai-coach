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
          created_at: string
          difficult_subjects: string[] | null
          favorite_subjects: string[] | null
          focus_time: number | null
          id: string
          interests: string[] | null
          name: string
          parent_id: string
          school_level: string | null
          struggles: string[] | null
          support_style: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          age?: number | null
          avatar_emoji?: string | null
          created_at?: string
          difficult_subjects?: string[] | null
          favorite_subjects?: string[] | null
          focus_time?: number | null
          id?: string
          interests?: string[] | null
          name: string
          parent_id: string
          school_level?: string | null
          struggles?: string[] | null
          support_style?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          age?: number | null
          avatar_emoji?: string | null
          created_at?: string
          difficult_subjects?: string[] | null
          favorite_subjects?: string[] | null
          focus_time?: number | null
          id?: string
          interests?: string[] | null
          name?: string
          parent_id?: string
          school_level?: string | null
          struggles?: string[] | null
          support_style?: string | null
          updated_at?: string
        }
        Relationships: []
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
