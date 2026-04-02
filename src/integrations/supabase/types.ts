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
      assignment_results: {
        Row: {
          answers: Json | null
          assignment_id: string | null
          completed_at: string | null
          created_at: string | null
          errors_summary: Json | null
          id: string
          score: number | null
          session_id: string | null
          status: string | null
          student_id: string
        }
        Insert: {
          answers?: Json | null
          assignment_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          errors_summary?: Json | null
          id?: string
          score?: number | null
          session_id?: string | null
          status?: string | null
          student_id: string
        }
        Update: {
          answers?: Json | null
          assignment_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          errors_summary?: Json | null
          id?: string
          score?: number | null
          session_id?: string | null
          status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guided_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
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
          date_of_birth: string | null
          difficult_subjects: string[] | null
          favorite_subjects: string[] | null
          focus_time: number | null
          gender: string | null
          id: string
          interests: string[] | null
          last_name: string | null
          name: string
          onboarding_completed: boolean | null
          parent_id: string
          school_code: string | null
          school_level: string | null
          school_name: string | null
          struggles: string[] | null
          support_style: string | null
          teacher_insights_consent: boolean
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          age?: number | null
          avatar_emoji?: string | null
          city?: string | null
          class_section?: string | null
          created_at?: string
          date_of_birth?: string | null
          difficult_subjects?: string[] | null
          favorite_subjects?: string[] | null
          focus_time?: number | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          last_name?: string | null
          name: string
          onboarding_completed?: boolean | null
          parent_id: string
          school_code?: string | null
          school_level?: string | null
          school_name?: string | null
          struggles?: string[] | null
          support_style?: string | null
          teacher_insights_consent?: boolean
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          age?: number | null
          avatar_emoji?: string | null
          city?: string | null
          class_section?: string | null
          created_at?: string
          date_of_birth?: string | null
          difficult_subjects?: string[] | null
          favorite_subjects?: string[] | null
          focus_time?: number | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          last_name?: string | null
          name?: string
          onboarding_completed?: boolean | null
          parent_id?: string
          school_code?: string | null
          school_level?: string | null
          school_name?: string | null
          struggles?: string[] | null
          support_style?: string | null
          teacher_insights_consent?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      class_enrollments: {
        Row: {
          class_id: string | null
          enrolled_at: string | null
          id: string
          status: string | null
          student_id: string
        }
        Insert: {
          class_id?: string | null
          enrolled_at?: string | null
          id?: string
          status?: string | null
          student_id: string
        }
        Update: {
          class_id?: string | null
          enrolled_at?: string | null
          id?: string
          status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
        ]
      }
      classi: {
        Row: {
          codice_invito: string | null
          created_at: string | null
          docente_profile_id: string
          id: string
          is_sample: boolean
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
          is_sample?: boolean
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
          is_sample?: boolean
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
      crisis_events: {
        Row: {
          created_at: string
          id: string
          session_status: string
          trigger_message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_status?: string
          trigger_message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_status?: string
          trigger_message?: string
          user_id?: string
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
      flashcards: {
        Row: {
          answer: string
          created_at: string | null
          difficulty: number | null
          id: string
          is_flagged: boolean | null
          last_shown_at: string | null
          next_review_at: string | null
          question: string
          source_session_id: string | null
          subject: string
          times_correct: number | null
          times_shown: number | null
          times_wrong: number | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          difficulty?: number | null
          id?: string
          is_flagged?: boolean | null
          last_shown_at?: string | null
          next_review_at?: string | null
          question: string
          source_session_id?: string | null
          subject: string
          times_correct?: number | null
          times_shown?: number | null
          times_wrong?: number | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          difficulty?: number | null
          id?: string
          is_flagged?: boolean | null
          last_shown_at?: string | null
          next_review_at?: string | null
          question?: string
          source_session_id?: string | null
          subject?: string
          times_correct?: number | null
          times_shown?: number | null
          times_wrong?: number | null
          user_id?: string
        }
        Relationships: []
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
      guided_sessions: {
        Row: {
          bloom_level_reached: number | null
          completed_at: string | null
          conversation_id: string | null
          current_step: number | null
          duration_seconds: number | null
          emotional_checkin: string | null
          homework_id: string | null
          id: string
          last_difficulty: string | null
          started_at: string | null
          status: string | null
          total_steps: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bloom_level_reached?: number | null
          completed_at?: string | null
          conversation_id?: string | null
          current_step?: number | null
          duration_seconds?: number | null
          emotional_checkin?: string | null
          homework_id?: string | null
          id?: string
          last_difficulty?: string | null
          started_at?: string | null
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bloom_level_reached?: number | null
          completed_at?: string | null
          conversation_id?: string | null
          current_step?: number | null
          duration_seconds?: number | null
          emotional_checkin?: string | null
          homework_id?: string | null
          id?: string
          last_difficulty?: string | null
          started_at?: string | null
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_sessions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_tasks"
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
          source_files: Json | null
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
          source_files?: Json | null
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
          source_files?: Json | null
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
      learning_errors: {
        Row: {
          created_at: string | null
          description: string | null
          error_type: string | null
          id: string
          resolved: boolean | null
          session_id: string | null
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          error_type?: string | null
          id?: string
          resolved?: boolean | null
          session_id?: string | null
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          error_type?: string | null
          id?: string
          resolved?: boolean | null
          session_id?: string | null
          subject?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      material_favorites: {
        Row: {
          created_at: string
          id: string
          material_id: string
          material_type: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          material_type: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          material_type?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_favorites_profile_id_fkey"
            columns: ["profile_id"]
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
      parent_communications: {
        Row: {
          body: string
          class_id: string | null
          id: string
          sent_at: string | null
          status: string | null
          student_id: string | null
          subject: string | null
          teacher_id: string | null
          type: string | null
        }
        Insert: {
          body: string
          class_id?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          student_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          type?: string | null
        }
        Update: {
          body?: string
          class_id?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          student_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_communications_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notifications: {
        Row: {
          alert_level: string
          child_profile_id: string
          created_at: string
          id: string
          link_url: string | null
          message: string
          read: boolean
          title: string
        }
        Insert: {
          alert_level?: string
          child_profile_id: string
          created_at?: string
          id?: string
          link_url?: string | null
          message: string
          read?: boolean
          title: string
        }
        Update: {
          alert_level?: string
          child_profile_id?: string
          created_at?: string
          id?: string
          link_url?: string | null
          message?: string
          read?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_child_profile_id_fkey"
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
      schools: {
        Row: {
          codice_meccanografico: string
          comune: string | null
          created_at: string | null
          denominazione: string
          id: string
          indirizzo: string | null
          provincia: string | null
          regione: string | null
          tipo_gestione: string | null
          tipo_scuola: string | null
        }
        Insert: {
          codice_meccanografico: string
          comune?: string | null
          created_at?: string | null
          denominazione: string
          id?: string
          indirizzo?: string | null
          provincia?: string | null
          regione?: string | null
          tipo_gestione?: string | null
          tipo_scuola?: string | null
        }
        Update: {
          codice_meccanografico?: string
          comune?: string | null
          created_at?: string | null
          denominazione?: string
          id?: string
          indirizzo?: string | null
          provincia?: string | null
          regione?: string | null
          tipo_gestione?: string | null
          tipo_scuola?: string | null
        }
        Relationships: []
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
      student_materials: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          material_type: string
          profile_id: string
          subject: string
          title: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          material_type?: string
          profile_id: string
          subject: string
          title: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          material_type?: string
          profile_id?: string
          subject?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_materials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_type: string | null
          hint_count: number | null
          homework_id: string | null
          id: string
          session_id: string | null
          status: string | null
          step_number: number
          step_text: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_type?: string | null
          hint_count?: number | null
          homework_id?: string | null
          id?: string
          session_id?: string | null
          status?: string | null
          step_number: number
          step_text: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_type?: string | null
          hint_count?: number | null
          homework_id?: string | null
          id?: string
          session_id?: string | null
          status?: string | null
          step_number?: number
          step_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_steps_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_steps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guided_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_activity_feed: {
        Row: {
          action_label: string | null
          action_route: string | null
          class_id: string | null
          created_at: string | null
          id: string
          message: string
          read_at: string | null
          severity: string | null
          student_id: string | null
          teacher_id: string
          type: string | null
        }
        Insert: {
          action_label?: string | null
          action_route?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          severity?: string | null
          student_id?: string | null
          teacher_id: string
          type?: string | null
        }
        Update: {
          action_label?: string | null
          action_route?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          severity?: string | null
          student_id?: string | null
          teacher_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_activity_feed_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          assigned_at: string | null
          class_id: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          student_id: string | null
          subject: string | null
          teacher_id: string
          title: string
          type: string
        }
        Insert: {
          assigned_at?: string | null
          class_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          student_id?: string | null
          subject?: string | null
          teacher_id: string
          title: string
          type: string
        }
        Update: {
          assigned_at?: string | null
          class_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          student_id?: string | null
          subject?: string | null
          teacher_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_calendar_events: {
        Row: {
          class_id: string | null
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_calendar_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content?: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "teacher_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_chats: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_chats_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_materials: {
        Row: {
          assigned_at: string | null
          class_id: string | null
          content: string
          created_at: string | null
          id: string
          is_sample: boolean
          level: string | null
          parent_material_id: string | null
          status: string | null
          subject: string | null
          target_profile: string | null
          teacher_id: string
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          class_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_sample?: boolean
          level?: string | null
          parent_material_id?: string | null
          status?: string | null
          subject?: string | null
          target_profile?: string | null
          teacher_id: string
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          class_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_sample?: boolean
          level?: string | null
          parent_material_id?: string | null
          status?: string | null
          subject?: string | null
          target_profile?: string | null
          teacher_id?: string
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_materials_parent_material_id_fkey"
            columns: ["parent_material_id"]
            isOneToOne: false
            referencedRelation: "teacher_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reported_by: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reported_by: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reported_by?: string
          teacher_id?: string
        }
        Relationships: []
      }
      translation_cache: {
        Row: {
          id: string
          key: string
          lang: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          lang: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          lang?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          age_at_registration: number | null
          created_at: string
          id: string
          marketing_consent: boolean | null
          marketing_consent_at: string | null
          parental_consent: boolean | null
          parental_consent_at: string | null
          privacy_accepted: boolean
          privacy_accepted_at: string | null
          role_at_registration: string | null
          tos_accepted: boolean
          tos_accepted_at: string | null
          user_id: string
        }
        Insert: {
          age_at_registration?: number | null
          created_at?: string
          id?: string
          marketing_consent?: boolean | null
          marketing_consent_at?: string | null
          parental_consent?: boolean | null
          parental_consent_at?: string | null
          privacy_accepted?: boolean
          privacy_accepted_at?: string | null
          role_at_registration?: string | null
          tos_accepted?: boolean
          tos_accepted_at?: string | null
          user_id: string
        }
        Update: {
          age_at_registration?: number | null
          created_at?: string
          id?: string
          marketing_consent?: boolean | null
          marketing_consent_at?: string | null
          parental_consent?: boolean | null
          parental_consent_at?: string | null
          privacy_accepted?: boolean
          privacy_accepted_at?: string | null
          role_at_registration?: string | null
          tos_accepted?: boolean
          tos_accepted_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      get_child_daily_missions: {
        Args: { p_date?: string; p_profile_id: string }
        Returns: Json
      }
      get_child_gamification: { Args: { p_profile_id: string }; Returns: Json }
      get_discoverable_teachers: {
        Args: { school_code_param: string }
        Returns: {
          badge: string
          last_name: string
          name: string
          teacher_id: string
        }[]
      }
      get_discoverable_teachers_with_classes: {
        Args: { school_code_param: string }
        Returns: Json
      }
      get_student_classes: {
        Args: { student_profile_id: string }
        Returns: Json
      }
      join_class_by_code: {
        Args: { code: string; student_profile_id: string }
        Returns: Json
      }
      leave_class: {
        Args: { enrollment_id: string; student_profile_id: string }
        Returns: Json
      }
      owns_child_profile: { Args: { profile_id: string }; Returns: boolean }
      search_cities: {
        Args: { limit_n?: number; query: string }
        Returns: {
          comune: string
        }[]
      }
      search_schools: {
        Args: { city_filter?: string; limit_n?: number; query: string }
        Returns: {
          codice_meccanografico: string
          comune: string
          denominazione: string
          indirizzo: string
          provincia: string
          tipo_scuola: string
        }[]
      }
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
