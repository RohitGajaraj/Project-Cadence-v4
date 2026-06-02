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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_id: string | null
          agent_name: string
          agent_slug: string
          created_at: string
          duration_ms: number | null
          id: string
          input: string
          output: string | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name: string
          agent_slug: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input: string
          output?: string | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string
          agent_slug?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: string
          output?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          color: string
          created_at: string
          cron_input: string | null
          cron_schedule: string | null
          enabled: boolean
          id: string
          last_scheduled_run_at: string | null
          name: string
          role: string
          slug: string
          system_prompt: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          cron_input?: string | null
          cron_schedule?: string | null
          enabled?: boolean
          id?: string
          last_scheduled_run_at?: string | null
          name: string
          role: string
          slug: string
          system_prompt: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          cron_input?: string | null
          cron_schedule?: string | null
          enabled?: boolean
          id?: string
          last_scheduled_run_at?: string | null
          name?: string
          role?: string
          slug?: string
          system_prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_budgets: {
        Row: {
          alert_at_pct: number
          created_at: string
          daily_token_cap: number | null
          daily_tokens_used: number
          daily_usd_cap: number | null
          daily_usd_used: number
          day_window: string
          id: string
          month_window: string
          monthly_token_cap: number | null
          monthly_tokens_used: number
          monthly_usd_cap: number | null
          monthly_usd_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_at_pct?: number
          created_at?: string
          daily_token_cap?: number | null
          daily_tokens_used?: number
          daily_usd_cap?: number | null
          daily_usd_used?: number
          day_window?: string
          id?: string
          month_window?: string
          monthly_token_cap?: number | null
          monthly_tokens_used?: number
          monthly_usd_cap?: number | null
          monthly_usd_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_at_pct?: number
          created_at?: string
          daily_token_cap?: number | null
          daily_tokens_used?: number
          daily_usd_cap?: number | null
          daily_usd_used?: number
          day_window?: string
          id?: string
          month_window?: string
          monthly_token_cap?: number | null
          monthly_tokens_used?: number
          monthly_usd_cap?: number | null
          monthly_usd_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_evals: {
        Row: {
          citations: Json
          coherence: number | null
          created_at: string
          event_id: string
          groundedness: number | null
          hallucination_score: number | null
          id: string
          judge_model: string | null
          judge_rationale: string | null
          pii_risk: number | null
          prompt_injection_risk: number | null
          relevance: number | null
          status: string
          toxicity: number | null
          unsupported_claims: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          citations?: Json
          coherence?: number | null
          created_at?: string
          event_id: string
          groundedness?: number | null
          hallucination_score?: number | null
          id?: string
          judge_model?: string | null
          judge_rationale?: string | null
          pii_risk?: number | null
          prompt_injection_risk?: number | null
          relevance?: number | null
          status?: string
          toxicity?: number | null
          unsupported_claims?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          citations?: Json
          coherence?: number | null
          created_at?: string
          event_id?: string
          groundedness?: number | null
          hallucination_score?: number | null
          id?: string
          judge_model?: string | null
          judge_rationale?: string | null
          pii_risk?: number | null
          prompt_injection_risk?: number | null
          relevance?: number | null
          status?: string
          toxicity?: number | null
          unsupported_claims?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_events: {
        Row: {
          cache_hit: boolean
          completion_tokens: number
          created_at: string
          error_code: string | null
          error_message: string | null
          est_cost_usd: number
          fallback: boolean
          id: string
          input_preview: string | null
          latency_ms: number
          model: string
          output_preview: string | null
          parent_event_id: string | null
          prompt_tokens: number
          provider: string
          request_hash: string | null
          status: string
          surface: string
          surface_ref: string | null
          total_tokens: number
          trace_id: string | null
          ttft_ms: number | null
          user_id: string
          via: string
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          est_cost_usd?: number
          fallback?: boolean
          id?: string
          input_preview?: string | null
          latency_ms?: number
          model: string
          output_preview?: string | null
          parent_event_id?: string | null
          prompt_tokens?: number
          provider?: string
          request_hash?: string | null
          status?: string
          surface: string
          surface_ref?: string | null
          total_tokens?: number
          trace_id?: string | null
          ttft_ms?: number | null
          user_id: string
          via?: string
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          est_cost_usd?: number
          fallback?: boolean
          id?: string
          input_preview?: string | null
          latency_ms?: number
          model?: string
          output_preview?: string | null
          parent_event_id?: string | null
          prompt_tokens?: number
          provider?: string
          request_hash?: string | null
          status?: string
          surface?: string
          surface_ref?: string | null
          total_tokens?: number
          trace_id?: string | null
          ttft_ms?: number | null
          user_id?: string
          via?: string
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          event_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: Json
          calendar_id: string
          created_at: string
          description: string | null
          end_at: string | null
          external_id: string
          hangout_link: string | null
          html_link: string | null
          id: string
          last_synced_at: string
          location: string | null
          organizer_email: string | null
          start_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          attendees?: Json
          calendar_id?: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          external_id: string
          hangout_link?: string | null
          html_link?: string | null
          id?: string
          last_synced_at?: string
          location?: string | null
          organizer_email?: string | null
          start_at: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          attendees?: Json
          calendar_id?: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          external_id?: string
          hangout_link?: string | null
          html_link?: string | null
          id?: string
          last_synced_at?: string
          location?: string | null
          organizer_email?: string | null
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          model: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          brief_date: string
          created_at: string
          focus_score: number
          id: string
          summary: string
          user_id: string
        }
        Insert: {
          brief_date: string
          created_at?: string
          focus_score?: number
          id?: string
          summary?: string
          user_id: string
        }
        Update: {
          brief_date?: string
          created_at?: string
          focus_score?: number
          id?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          created_at: string
          id: string
          meeting_id: string | null
          project_id: string | null
          rationale: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id?: string | null
          project_id?: string | null
          rationale?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string | null
          project_id?: string | null
          rationale?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      doc_versions: {
        Row: {
          content_json: Json
          created_at: string
          doc_id: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content_json: Json
          created_at?: string
          doc_id: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          doc_id?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_versions_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "docs"
            referencedColumns: ["id"]
          },
        ]
      }
      docs: {
        Row: {
          archived: boolean
          content_json: Json
          content_text: string
          created_at: string
          icon: string | null
          id: string
          parent_id: string | null
          position: number
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          content_json?: Json
          content_text?: string
          created_at?: string
          icon?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          content_json?: Json
          content_text?: string
          created_at?: string
          icon?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "docs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_case_results: {
        Row: {
          actual: string | null
          case_id: string
          created_at: string
          event_id: string | null
          id: string
          passed: boolean
          reasons: Json
          run_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          actual?: string | null
          case_id: string
          created_at?: string
          event_id?: string | null
          id?: string
          passed?: boolean
          reasons?: Json
          run_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          actual?: string | null
          case_id?: string
          created_at?: string
          event_id?: string | null
          id?: string
          passed?: boolean
          reasons?: Json
          run_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      eval_cases: {
        Row: {
          assertions: Json
          created_at: string
          expected: string | null
          id: string
          input: string
          name: string
          suite_id: string
          user_id: string
        }
        Insert: {
          assertions?: Json
          created_at?: string
          expected?: string | null
          id?: string
          input: string
          name: string
          suite_id: string
          user_id: string
        }
        Update: {
          assertions?: Json
          created_at?: string
          expected?: string | null
          id?: string
          input?: string
          name?: string
          suite_id?: string
          user_id?: string
        }
        Relationships: []
      }
      eval_runs: {
        Row: {
          avg_score: number | null
          created_at: string
          fail_count: number
          id: string
          model: string
          pass_count: number
          status: string
          suite_id: string
          total_cost_usd: number
          user_id: string
        }
        Insert: {
          avg_score?: number | null
          created_at?: string
          fail_count?: number
          id?: string
          model: string
          pass_count?: number
          status?: string
          suite_id: string
          total_cost_usd?: number
          user_id: string
        }
        Update: {
          avg_score?: number | null
          created_at?: string
          fail_count?: number
          id?: string
          model?: string
          pass_count?: number
          status?: string
          suite_id?: string
          total_cost_usd?: number
          user_id?: string
        }
        Relationships: []
      }
      eval_suites: {
        Row: {
          built_in: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          surface: string | null
          user_id: string
        }
        Insert: {
          built_in?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          surface?: string | null
          user_id: string
        }
        Update: {
          built_in?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          surface?: string | null
          user_id?: string
        }
        Relationships: []
      }
      guardrail_hits: {
        Row: {
          action: string
          created_at: string
          event_id: string | null
          id: string
          kind: string
          matched: string | null
          rule_id: string | null
          rule_name: string
          side: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind: string
          matched?: string | null
          rule_id?: string | null
          rule_name: string
          side: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          matched?: string | null
          rule_id?: string | null
          rule_name?: string
          side?: string
          user_id?: string
        }
        Relationships: []
      }
      guardrail_rules: {
        Row: {
          action: string
          applies_to: string
          built_in: boolean
          created_at: string
          enabled: boolean
          id: string
          kind: string
          name: string
          pattern: string
          user_id: string
        }
        Insert: {
          action?: string
          applies_to?: string
          built_in?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          name: string
          pattern: string
          user_id: string
        }
        Update: {
          action?: string
          applies_to?: string
          built_in?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          name?: string
          pattern?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          action_items: Json
          created_at: string
          decisions_made: Json
          end_at: string
          id: string
          notes: string | null
          processed_at: string | null
          stakeholder: string | null
          start_at: string
          summary: string | null
          title: string
          transcript: string | null
          user_id: string
        }
        Insert: {
          action_items?: Json
          created_at?: string
          decisions_made?: Json
          end_at: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          stakeholder?: string | null
          start_at: string
          summary?: string | null
          title: string
          transcript?: string | null
          user_id: string
        }
        Update: {
          action_items?: Json
          created_at?: string
          decisions_made?: Json
          end_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          stakeholder?: string | null
          start_at?: string
          summary?: string | null
          title?: string
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          confidence: number
          created_at: string
          ease: number
          hypothesis: string | null
          ice_score: number | null
          id: string
          impact: number
          problem: string
          project_id: string | null
          status: string
          target_user: string | null
          theme_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          ease?: number
          hypothesis?: string | null
          ice_score?: number | null
          id?: string
          impact?: number
          problem?: string
          project_id?: string | null
          status?: string
          target_user?: string | null
          theme_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          ease?: number
          hypothesis?: string | null
          ice_score?: number | null
          id?: string
          impact?: number
          problem?: string
          project_id?: string | null
          status?: string
          target_user?: string | null
          theme_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prds: {
        Row: {
          body_md: string
          created_at: string
          id: string
          model: string | null
          opportunity_id: string | null
          project_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_md?: string
          created_at?: string
          id?: string
          model?: string | null
          opportunity_id?: string | null
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_md?: string
          created_at?: string
          id?: string
          model?: string | null
          opportunity_id?: string | null
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_model: string
          display_name: string | null
          full_name: string | null
          id: string
          onboarded: boolean
          role: string | null
          timezone: string | null
          updated_at: string
          working_hours_end: number
          working_hours_start: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_model?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          onboarded?: boolean
          role?: string | null
          timezone?: string | null
          updated_at?: string
          working_hours_end?: number
          working_hours_start?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_model?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          onboarded?: boolean
          role?: string | null
          timezone?: string | null
          updated_at?: string
          working_hours_end?: number
          working_hours_start?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          north_star: string | null
          status: string
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          north_star?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          north_star?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prototype_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          kind: string
          message_id: string | null
          name: string
          prototype_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string
          message_id?: string | null
          name: string
          prototype_id: string
          size_bytes?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string
          message_id?: string | null
          name?: string
          prototype_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      prototype_files: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string
          path: string
          prototype_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          path: string
          prototype_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          path?: string
          prototype_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_files_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_messages: {
        Row: {
          applied: boolean
          changes_json: Json
          content: string
          created_at: string
          id: string
          prototype_id: string
          role: string
          user_id: string
        }
        Insert: {
          applied?: boolean
          changes_json?: Json
          content?: string
          created_at?: string
          id?: string
          prototype_id: string
          role: string
          user_id: string
        }
        Update: {
          applied?: boolean
          changes_json?: Json
          content?: string
          created_at?: string
          id?: string
          prototype_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_messages_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      prototypes: {
        Row: {
          created_at: string
          description: string | null
          entry_path: string
          id: string
          is_public: boolean
          name: string
          prd_id: string | null
          project_id: string | null
          share_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_path?: string
          id?: string
          is_public?: boolean
          name: string
          prd_id?: string | null
          project_id?: string | null
          share_slug?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_path?: string
          id?: string
          is_public?: boolean
          name?: string
          prd_id?: string | null
          project_id?: string | null
          share_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototypes_prd_id_fkey"
            columns: ["prd_id"]
            isOneToOne: false
            referencedRelation: "prds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prototypes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string | null
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source_id: string | null
          source_kind: string
          title: string | null
          token_estimate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          content_hash?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id?: string | null
          source_kind: string
          title?: string | null
          token_estimate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id?: string | null
          source_kind?: string
          title?: string | null
          token_estimate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduler_proposals: {
        Row: {
          calendar_event_id: string | null
          chosen_slot: Json | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          slots: Json
          source_id: string | null
          source_kind: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          chosen_slot?: Json | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          slots?: Json
          source_id?: string | null
          source_kind?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          chosen_slot?: Json | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          slots?: Json
          source_id?: string | null
          source_kind?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          project_id: string | null
          sentiment: string | null
          source: string
          tags: string[]
          theme_id: string | null
          title: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          project_id?: string | null
          sentiment?: string | null
          source?: string
          tags?: string[]
          theme_id?: string | null
          title?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          project_id?: string | null
          sentiment?: string | null
          source?: string
          tags?: string[]
          theme_id?: string | null
          title?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_mappings: {
        Row: {
          conflict: boolean
          created_at: string
          external_id: string
          external_url: string | null
          id: string
          last_pulled_at: string | null
          last_pushed_at: string | null
          local_id: string
          local_kind: string
          provider: string
          updated_at: string
          user_id: string
          version_local: number
          version_remote: number
        }
        Insert: {
          conflict?: boolean
          created_at?: string
          external_id: string
          external_url?: string | null
          id?: string
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          local_id: string
          local_kind: string
          provider: string
          updated_at?: string
          user_id: string
          version_local?: number
          version_remote?: number
        }
        Update: {
          conflict?: boolean
          created_at?: string
          external_id?: string
          external_url?: string | null
          id?: string
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          local_id?: string
          local_kind?: string
          provider?: string
          updated_at?: string
          user_id?: string
          version_local?: number
          version_remote?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          estimate_hours: number | null
          id: string
          is_deep_work: boolean
          prd_id: string | null
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          is_deep_work?: boolean
          prd_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          is_deep_work?: boolean
          prd_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          confidence: number
          created_at: string
          frequency: number
          id: string
          project_id: string | null
          severity: number
          status: string
          summary: string
          title: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          frequency?: number
          id?: string
          project_id?: string | null
          severity?: number
          status?: string
          summary?: string
          title: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          frequency?: number
          id?: string
          project_id?: string | null
          severity?: number
          status?: string
          summary?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_calls: {
        Row: {
          agent_id: string | null
          args: Json
          created_at: string
          error: string | null
          event_id: string | null
          id: string
          latency_ms: number
          ok: boolean
          result: Json | null
          tool_name: string
          trace_id: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          args?: Json
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          latency_ms?: number
          ok?: boolean
          result?: Json | null
          tool_name: string
          trace_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          args?: Json
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          latency_ms?: number
          ok?: boolean
          result?: Json | null
          tool_name?: string
          trace_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key: string
          base_url: string | null
          created_at: string
          id: string
          label: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          base_url?: string | null
          created_at?: string
          id?: string
          label?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          base_url?: string | null
          created_at?: string
          id?: string
          label?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          account_label: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          metadata: Json
          provider: string
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          provider: string
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_label?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_rag_chunks: {
        Args: {
          for_user: string
          match_count?: number
          query_embedding: string
          source_kinds?: string[]
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_kind: string
          title: string
        }[]
      }
      match_signals: {
        Args: {
          for_user?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      seed_default_agents: { Args: { _user_id: string }; Returns: undefined }
      seed_default_guardrails: {
        Args: { _user_id: string }
        Returns: undefined
      }
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
