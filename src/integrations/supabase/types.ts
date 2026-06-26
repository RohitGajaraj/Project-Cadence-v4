export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      account_billing_secrets: {
        Row: {
          account_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_billing_secrets_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_credits: {
        Row: {
          account_id: string;
          balance_credits: number;
          cycle_anchor: string;
          monthly_grant_credits: number;
          topup_credits: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          balance_credits?: number;
          cycle_anchor?: string;
          monthly_grant_credits?: number;
          topup_credits?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          balance_credits?: number;
          cycle_anchor?: string;
          monthly_grant_credits?: number;
          topup_credits?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_credits_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_members: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          plan_tier: string;
          plan_updated_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id: string;
          plan_tier?: string;
          plan_updated_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          plan_tier?: string;
          plan_updated_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          id: string;
          payload: Json;
          target_id: string | null;
          target_kind: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          target_id?: string | null;
          target_kind: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          target_id?: string | null;
          target_kind?: string;
        };
        Relationships: [];
      };
      agent_approvals: {
        Row: {
          agent_id: string | null;
          agent_slug: string | null;
          args: Json;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          error: string | null;
          escalated_at: string | null;
          escalated_to: string | null;
          escalation_state: string;
          expires_at: string | null;
          id: string;
          mission_id: string | null;
          rationale: string | null;
          result: Json | null;
          run_id: string | null;
          status: string;
          tool_name: string;
          trace_id: string | null;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          agent_id?: string | null;
          agent_slug?: string | null;
          args?: Json;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          error?: string | null;
          escalated_at?: string | null;
          escalated_to?: string | null;
          escalation_state?: string;
          expires_at?: string | null;
          id?: string;
          mission_id?: string | null;
          rationale?: string | null;
          result?: Json | null;
          run_id?: string | null;
          status?: string;
          tool_name: string;
          trace_id?: string | null;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          agent_id?: string | null;
          agent_slug?: string | null;
          args?: Json;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          error?: string | null;
          escalated_at?: string | null;
          escalated_to?: string | null;
          escalation_state?: string;
          expires_at?: string | null;
          id?: string;
          mission_id?: string | null;
          rationale?: string | null;
          result?: Json | null;
          run_id?: string | null;
          status?: string;
          tool_name?: string;
          trace_id?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      agent_autonomy: {
        Row: {
          agent_id: string;
          arc: string;
          created_at: string;
          id: string;
          set_at: string;
          set_by: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_id: string;
          arc?: string;
          created_at?: string;
          id?: string;
          set_at?: string;
          set_by?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_id?: string;
          arc?: string;
          created_at?: string;
          id?: string;
          set_at?: string;
          set_by?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_autonomy_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_memory: {
        Row: {
          agent_id: string | null;
          agent_slug: string | null;
          content: string;
          created_at: string;
          embedding: string | null;
          expires_at: string | null;
          id: string;
          importance: number;
          kind: string;
          last_used_at: string | null;
          metadata: Json;
          scope: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          agent_id?: string | null;
          agent_slug?: string | null;
          content: string;
          created_at?: string;
          embedding?: string | null;
          expires_at?: string | null;
          id?: string;
          importance?: number;
          kind?: string;
          last_used_at?: string | null;
          metadata?: Json;
          scope?: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          agent_id?: string | null;
          agent_slug?: string | null;
          content?: string;
          created_at?: string;
          embedding?: string | null;
          expires_at?: string | null;
          id?: string;
          importance?: number;
          kind?: string;
          last_used_at?: string | null;
          metadata?: Json;
          scope?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_memory_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_messages: {
        Row: {
          consumed_at: string | null;
          consumed_by_run_id: string | null;
          created_at: string;
          from_agent_id: string | null;
          from_agent_slug: string | null;
          id: string;
          kind: string;
          mission_id: string;
          payload: Json;
          source_run_id: string | null;
          source_trace_id: string | null;
          to_agent_id: string;
          to_agent_slug: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          consumed_at?: string | null;
          consumed_by_run_id?: string | null;
          created_at?: string;
          from_agent_id?: string | null;
          from_agent_slug?: string | null;
          id?: string;
          kind?: string;
          mission_id: string;
          payload?: Json;
          source_run_id?: string | null;
          source_trace_id?: string | null;
          to_agent_id: string;
          to_agent_slug: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          consumed_at?: string | null;
          consumed_by_run_id?: string | null;
          created_at?: string;
          from_agent_id?: string | null;
          from_agent_slug?: string | null;
          id?: string;
          kind?: string;
          mission_id?: string;
          payload?: Json;
          source_run_id?: string | null;
          source_trace_id?: string | null;
          to_agent_id?: string;
          to_agent_slug?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_messages_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_run_checkpoints: {
        Row: {
          created_at: string;
          id: string;
          run_id: string;
          state: Json;
          step_index: number;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          run_id: string;
          state: Json;
          step_index: number;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          run_id?: string;
          state?: Json;
          step_index?: number;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_run_checkpoints_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "agent_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_run_checkpoints_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_runs: {
        Row: {
          agent_id: string | null;
          agent_name: string;
          agent_slug: string;
          created_at: string;
          delegate_meta: Json | null;
          duration_ms: number | null;
          failure_kind: string | null;
          halted_at: string | null;
          halted_reason: string | null;
          id: string;
          input: string;
          last_checkpoint_at: string | null;
          mission_id: string | null;
          mission_spend_cap_usd: number | null;
          mission_token_cap: number | null;
          model: string | null;
          output: string | null;
          spend_used_usd: number;
          status: string;
          step_index: number;
          tokens_used: number;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          agent_id?: string | null;
          agent_name: string;
          agent_slug: string;
          created_at?: string;
          delegate_meta?: Json | null;
          duration_ms?: number | null;
          failure_kind?: string | null;
          halted_at?: string | null;
          halted_reason?: string | null;
          id?: string;
          input: string;
          last_checkpoint_at?: string | null;
          mission_id?: string | null;
          mission_spend_cap_usd?: number | null;
          mission_token_cap?: number | null;
          model?: string | null;
          output?: string | null;
          spend_used_usd?: number;
          status?: string;
          step_index?: number;
          tokens_used?: number;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          agent_id?: string | null;
          agent_name?: string;
          agent_slug?: string;
          created_at?: string;
          delegate_meta?: Json | null;
          duration_ms?: number | null;
          failure_kind?: string | null;
          halted_at?: string | null;
          halted_reason?: string | null;
          id?: string;
          input?: string;
          last_checkpoint_at?: string | null;
          mission_id?: string | null;
          mission_spend_cap_usd?: number | null;
          mission_token_cap?: number | null;
          model?: string | null;
          output?: string | null;
          spend_used_usd?: number;
          status?: string;
          step_index?: number;
          tokens_used?: number;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_tools: {
        Row: {
          built_in: boolean;
          category: string;
          config: Json;
          created_at: string;
          description: string;
          display_name: string;
          enabled: boolean;
          id: string;
          mode: string;
          tool_name: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          built_in?: boolean;
          category?: string;
          config?: Json;
          created_at?: string;
          description: string;
          display_name: string;
          enabled?: boolean;
          id?: string;
          mode?: string;
          tool_name: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          built_in?: boolean;
          category?: string;
          config?: Json;
          created_at?: string;
          description?: string;
          display_name?: string;
          enabled?: boolean;
          id?: string;
          mode?: string;
          tool_name?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_tools_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      agents: {
        Row: {
          color: string;
          created_at: string;
          cron_input: string | null;
          cron_schedule: string | null;
          enabled: boolean;
          id: string;
          last_scheduled_run_at: string | null;
          max_tool_risk: string | null;
          name: string;
          role: string;
          slug: string;
          system_prompt: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          color?: string;
          created_at?: string;
          cron_input?: string | null;
          cron_schedule?: string | null;
          enabled?: boolean;
          id?: string;
          last_scheduled_run_at?: string | null;
          max_tool_risk?: string | null;
          name: string;
          role: string;
          slug: string;
          system_prompt: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          color?: string;
          created_at?: string;
          cron_input?: string | null;
          cron_schedule?: string | null;
          enabled?: boolean;
          id?: string;
          last_scheduled_run_at?: string | null;
          max_tool_risk?: string | null;
          name?: string;
          role?: string;
          slug?: string;
          system_prompt?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_budget_alerts: {
        Row: {
          acknowledged: boolean;
          created_at: string;
          id: string;
          kind: string;
          pct: number;
          scope: string;
          surface: string | null;
          usd_cap: number;
          usd_used: number;
          user_id: string;
          window_kind: string;
          workspace_id: string;
        };
        Insert: {
          acknowledged?: boolean;
          created_at?: string;
          id?: string;
          kind: string;
          pct: number;
          scope: string;
          surface?: string | null;
          usd_cap: number;
          usd_used: number;
          user_id: string;
          window_kind: string;
          workspace_id?: string;
        };
        Update: {
          acknowledged?: boolean;
          created_at?: string;
          id?: string;
          kind?: string;
          pct?: number;
          scope?: string;
          surface?: string | null;
          usd_cap?: number;
          usd_used?: number;
          user_id?: string;
          window_kind?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_budget_alerts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_budgets: {
        Row: {
          alert_at_pct: number;
          created_at: string;
          daily_token_cap: number | null;
          daily_tokens_used: number;
          daily_usd_cap: number | null;
          daily_usd_used: number;
          day_window: string;
          id: string;
          month_window: string;
          monthly_token_cap: number | null;
          monthly_tokens_used: number;
          monthly_usd_cap: number | null;
          monthly_usd_used: number;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          alert_at_pct?: number;
          created_at?: string;
          daily_token_cap?: number | null;
          daily_tokens_used?: number;
          daily_usd_cap?: number | null;
          daily_usd_used?: number;
          day_window?: string;
          id?: string;
          month_window?: string;
          monthly_token_cap?: number | null;
          monthly_tokens_used?: number;
          monthly_usd_cap?: number | null;
          monthly_usd_used?: number;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          alert_at_pct?: number;
          created_at?: string;
          daily_token_cap?: number | null;
          daily_tokens_used?: number;
          daily_usd_cap?: number | null;
          daily_usd_used?: number;
          day_window?: string;
          id?: string;
          month_window?: string;
          monthly_token_cap?: number | null;
          monthly_tokens_used?: number;
          monthly_usd_cap?: number | null;
          monthly_usd_used?: number;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_budgets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_evals: {
        Row: {
          citations: Json;
          coherence: number | null;
          created_at: string;
          event_id: string;
          groundedness: number | null;
          hallucination_score: number | null;
          id: string;
          judge_model: string | null;
          judge_rationale: string | null;
          pii_risk: number | null;
          prompt_injection_risk: number | null;
          relevance: number | null;
          status: string;
          toxicity: number | null;
          unsupported_claims: Json;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          citations?: Json;
          coherence?: number | null;
          created_at?: string;
          event_id: string;
          groundedness?: number | null;
          hallucination_score?: number | null;
          id?: string;
          judge_model?: string | null;
          judge_rationale?: string | null;
          pii_risk?: number | null;
          prompt_injection_risk?: number | null;
          relevance?: number | null;
          status?: string;
          toxicity?: number | null;
          unsupported_claims?: Json;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          citations?: Json;
          coherence?: number | null;
          created_at?: string;
          event_id?: string;
          groundedness?: number | null;
          hallucination_score?: number | null;
          id?: string;
          judge_model?: string | null;
          judge_rationale?: string | null;
          pii_risk?: number | null;
          prompt_injection_risk?: number | null;
          relevance?: number | null;
          status?: string;
          toxicity?: number | null;
          unsupported_claims?: Json;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_evals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_events: {
        Row: {
          cache_hit: boolean;
          completion_tokens: number;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          est_cost_usd: number;
          fallback: boolean;
          id: string;
          input_preview: string | null;
          latency_ms: number;
          model: string;
          output_preview: string | null;
          parent_event_id: string | null;
          product_id: string | null;
          prompt_tokens: number;
          provider: string;
          request_hash: string | null;
          status: string;
          surface: string;
          surface_ref: string | null;
          system_preview: string | null;
          total_tokens: number;
          trace_id: string | null;
          ttft_ms: number | null;
          user_id: string;
          via: string;
          workspace_id: string;
        };
        Insert: {
          cache_hit?: boolean;
          completion_tokens?: number;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          est_cost_usd?: number;
          fallback?: boolean;
          id?: string;
          input_preview?: string | null;
          latency_ms?: number;
          model: string;
          output_preview?: string | null;
          parent_event_id?: string | null;
          product_id?: string | null;
          prompt_tokens?: number;
          provider?: string;
          request_hash?: string | null;
          status?: string;
          surface: string;
          surface_ref?: string | null;
          system_preview?: string | null;
          total_tokens?: number;
          trace_id?: string | null;
          ttft_ms?: number | null;
          user_id: string;
          via?: string;
          workspace_id?: string;
        };
        Update: {
          cache_hit?: boolean;
          completion_tokens?: number;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          est_cost_usd?: number;
          fallback?: boolean;
          id?: string;
          input_preview?: string | null;
          latency_ms?: number;
          model?: string;
          output_preview?: string | null;
          parent_event_id?: string | null;
          product_id?: string | null;
          prompt_tokens?: number;
          provider?: string;
          request_hash?: string | null;
          status?: string;
          surface?: string;
          surface_ref?: string | null;
          system_preview?: string | null;
          total_tokens?: number;
          trace_id?: string | null;
          ttft_ms?: number | null;
          user_id?: string;
          via?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_events_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_feedback: {
        Row: {
          comment: string | null;
          created_at: string;
          event_id: string;
          id: string;
          rating: number;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          rating: number;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          rating?: number;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_feedback_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_response_cache: {
        Row: {
          cache_key: string;
          completion_tokens: number;
          created_at: string;
          expires_at: string;
          id: string;
          model: string;
          output_text: string;
          prompt_tokens: number;
          user_id: string;
        };
        Insert: {
          cache_key: string;
          completion_tokens: number;
          created_at?: string;
          expires_at: string;
          id?: string;
          model: string;
          output_text: string;
          prompt_tokens: number;
          user_id: string;
        };
        Update: {
          cache_key?: string;
          completion_tokens?: number;
          created_at?: string;
          expires_at?: string;
          id?: string;
          model?: string;
          output_text?: string;
          prompt_tokens?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_surface_budgets: {
        Row: {
          created_at: string;
          daily_usd_cap: number | null;
          daily_usd_used: number;
          day_window: string;
          enabled: boolean;
          id: string;
          month_window: string;
          monthly_usd_cap: number | null;
          monthly_usd_used: number;
          surface: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          daily_usd_cap?: number | null;
          daily_usd_used?: number;
          day_window?: string;
          enabled?: boolean;
          id?: string;
          month_window?: string;
          monthly_usd_cap?: number | null;
          monthly_usd_used?: number;
          surface: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          daily_usd_cap?: number | null;
          daily_usd_used?: number;
          day_window?: string;
          enabled?: boolean;
          id?: string;
          month_window?: string;
          monthly_usd_cap?: number | null;
          monthly_usd_used?: number;
          surface?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_surface_budgets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          published_at: string | null;
          slug: string;
          status: string;
          submitted_at: string | null;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          slug: string;
          status?: string;
          submitted_at?: string | null;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          slug?: string;
          status?: string;
          submitted_at?: string | null;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      api_calls: {
        Row: {
          cost_usd: number | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          input_tokens: number | null;
          metadata: Json | null;
          output_tokens: number | null;
          result: string;
          token_id: string;
          tool_name: string;
          workspace_id: string;
        };
        Insert: {
          cost_usd?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          input_tokens?: number | null;
          metadata?: Json | null;
          output_tokens?: number | null;
          result?: string;
          token_id: string;
          tool_name: string;
          workspace_id: string;
        };
        Update: {
          cost_usd?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          input_tokens?: number | null;
          metadata?: Json | null;
          output_tokens?: number | null;
          result?: string;
          token_id?: string;
          tool_name?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_calls_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "mcp_tokens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "api_calls_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      artifact_lineage: {
        Row: {
          ai_event_id: string | null;
          child_id: string;
          child_kind: string;
          created_at: string;
          created_by_agent: string | null;
          id: string;
          inference: Json | null;
          invalidated_by: string | null;
          parent_id: string;
          parent_kind: string;
          rationale: string | null;
          relation: string;
          user_id: string;
          valid_to: string | null;
          workspace_id: string;
        };
        Insert: {
          ai_event_id?: string | null;
          child_id: string;
          child_kind: string;
          created_at?: string;
          created_by_agent?: string | null;
          id?: string;
          inference?: Json | null;
          invalidated_by?: string | null;
          parent_id: string;
          parent_kind: string;
          rationale?: string | null;
          relation?: string;
          user_id: string;
          valid_to?: string | null;
          workspace_id?: string;
        };
        Update: {
          ai_event_id?: string | null;
          child_id?: string;
          child_kind?: string;
          created_at?: string;
          created_by_agent?: string | null;
          id?: string;
          inference?: Json | null;
          invalidated_by?: string | null;
          parent_id?: string;
          parent_kind?: string;
          rationale?: string | null;
          relation?: string;
          user_id?: string;
          valid_to?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "artifact_lineage_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      auto_approve_domains: {
        Row: {
          created_at: string;
          created_by: string | null;
          default_role: string;
          domain: string;
          id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          default_role?: string;
          domain: string;
          id?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          default_role?: string;
          domain?: string;
          id?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      builder_file_claims: {
        Row: {
          claimed_at: string;
          created_at: string;
          id: string;
          mission_id: string | null;
          mission_title: string | null;
          path: string;
          released_at: string | null;
          released_reason: string | null;
          repo: string;
          run_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          claimed_at?: string;
          created_at?: string;
          id?: string;
          mission_id?: string | null;
          mission_title?: string | null;
          path: string;
          released_at?: string | null;
          released_reason?: string | null;
          repo: string;
          run_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          claimed_at?: string;
          created_at?: string;
          id?: string;
          mission_id?: string | null;
          mission_title?: string | null;
          path?: string;
          released_at?: string | null;
          released_reason?: string | null;
          repo?: string;
          run_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "builder_file_claims_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "builder_file_claims_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "agent_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          all_day: boolean;
          attendees: Json;
          calendar_id: string;
          created_at: string;
          description: string | null;
          end_at: string | null;
          external_id: string;
          hangout_link: string | null;
          html_link: string | null;
          id: string;
          last_synced_at: string;
          location: string | null;
          organizer_email: string | null;
          start_at: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          all_day?: boolean;
          attendees?: Json;
          calendar_id?: string;
          created_at?: string;
          description?: string | null;
          end_at?: string | null;
          external_id: string;
          hangout_link?: string | null;
          html_link?: string | null;
          id?: string;
          last_synced_at?: string;
          location?: string | null;
          organizer_email?: string | null;
          start_at: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          all_day?: boolean;
          attendees?: Json;
          calendar_id?: string;
          created_at?: string;
          description?: string | null;
          end_at?: string | null;
          external_id?: string;
          hangout_link?: string | null;
          html_link?: string | null;
          id?: string;
          last_synced_at?: string;
          location?: string | null;
          organizer_email?: string | null;
          start_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      connection_bindings: {
        Row: {
          config: Json;
          connection_id: string;
          created_at: string;
          created_by: string;
          id: string;
          product_id: string | null;
          provider: string;
          resource_id: string;
          resource_kind: string;
          resource_label: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          config?: Json;
          connection_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          product_id?: string | null;
          provider: string;
          resource_id: string;
          resource_kind: string;
          resource_label?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          config?: Json;
          connection_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          product_id?: string | null;
          provider?: string;
          resource_id?: string;
          resource_kind?: string;
          resource_label?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connection_bindings_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_bindings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_bindings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      connection_secrets: {
        Row: {
          ciphertext: string;
          created_at: string;
          id: string;
          iv: string;
          key_version: number;
          updated_at: string;
        };
        Insert: {
          ciphertext: string;
          created_at?: string;
          id?: string;
          iv: string;
          key_version?: number;
          updated_at?: string;
        };
        Update: {
          ciphertext?: string;
          created_at?: string;
          id?: string;
          iv?: string;
          key_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      connections: {
        Row: {
          account_email: string | null;
          account_label: string | null;
          auth_kind: string;
          created_at: string;
          external_handle: string | null;
          id: string;
          last_verified_at: string | null;
          metadata: Json;
          provider: string;
          scopes: string[];
          secret_id: string | null;
          status: string;
          status_detail: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_email?: string | null;
          account_label?: string | null;
          auth_kind: string;
          created_at?: string;
          external_handle?: string | null;
          id?: string;
          last_verified_at?: string | null;
          metadata?: Json;
          provider: string;
          scopes?: string[];
          secret_id?: string | null;
          status?: string;
          status_detail?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_email?: string | null;
          account_label?: string | null;
          auth_kind?: string;
          created_at?: string;
          external_handle?: string | null;
          id?: string;
          last_verified_at?: string | null;
          metadata?: Json;
          provider?: string;
          scopes?: string[];
          secret_id?: string | null;
          status?: string;
          status_detail?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connections_secret_id_fkey";
            columns: ["secret_id"];
            isOneToOne: false;
            referencedRelation: "connection_secrets";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          model: string;
          product_id: string | null;
          project_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          model?: string;
          product_id?: string | null;
          project_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          model?: string;
          product_id?: string | null;
          project_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      copilot_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "copilot_messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      cost_incidents: {
        Row: {
          amount_usd: number | null;
          created_at: string;
          detail: string;
          id: string;
          title: string;
          trace_id: string | null;
          user_id: string | null;
          window_kind: string | null;
          workspace_id: string;
        };
        Insert: {
          amount_usd?: number | null;
          created_at?: string;
          detail: string;
          id?: string;
          title: string;
          trace_id?: string | null;
          user_id?: string | null;
          window_kind?: string | null;
          workspace_id: string;
        };
        Update: {
          amount_usd?: number | null;
          created_at?: string;
          detail?: string;
          id?: string;
          title?: string;
          trace_id?: string | null;
          user_id?: string | null;
          window_kind?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cost_incidents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_caps: {
        Row: {
          account_id: string;
          cap_credits: number;
          created_at: string;
          enabled: boolean;
          id: string;
          scope: string;
          target_id: string;
          updated_at: string;
          window_kind: string;
        };
        Insert: {
          account_id: string;
          cap_credits: number;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          scope: string;
          target_id: string;
          updated_at?: string;
          window_kind?: string;
        };
        Update: {
          account_id?: string;
          cap_credits?: number;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          scope?: string;
          target_id?: string;
          updated_at?: string;
          window_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_caps_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_ledger: {
        Row: {
          account_id: string;
          ai_event_id: string | null;
          created_at: string;
          delta_credits: number;
          id: string;
          product_id: string | null;
          reason: string;
          surface: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id: string;
          ai_event_id?: string | null;
          created_at?: string;
          delta_credits: number;
          id?: string;
          product_id?: string | null;
          reason: string;
          surface?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string;
          ai_event_id?: string | null;
          created_at?: string;
          delta_credits?: number;
          id?: string;
          product_id?: string | null;
          reason?: string;
          surface?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_topups: {
        Row: {
          account_id: string | null;
          amount_cents: number;
          created_at: string | null;
          credits_added: number;
          currency: string;
          environment: string;
          id: string;
          price_lookup_key: string;
          status: string;
          stripe_payment_intent_id: string | null;
          stripe_session_id: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          amount_cents: number;
          created_at?: string | null;
          credits_added: number;
          currency?: string;
          environment?: string;
          id?: string;
          price_lookup_key: string;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_session_id: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          amount_cents?: number;
          created_at?: string | null;
          credits_added?: number;
          currency?: string;
          environment?: string;
          id?: string;
          price_lookup_key?: string;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_topups_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_briefs: {
        Row: {
          brief_date: string;
          created_at: string;
          focus_score: number;
          id: string;
          summary: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          brief_date: string;
          created_at?: string;
          focus_score?: number;
          id?: string;
          summary?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          brief_date?: string;
          created_at?: string;
          focus_score?: number;
          id?: string;
          summary?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_briefs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      decisions: {
        Row: {
          created_at: string;
          decided_by_agent_slug: string | null;
          id: string;
          is_public: boolean;
          meeting_id: string | null;
          mission_id: string | null;
          prd_id: string | null;
          product_id: string | null;
          project_id: string | null;
          rationale: string | null;
          share_slug: string | null;
          source_kind: string | null;
          status: string;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          decided_by_agent_slug?: string | null;
          id?: string;
          is_public?: boolean;
          meeting_id?: string | null;
          mission_id?: string | null;
          prd_id?: string | null;
          product_id?: string | null;
          project_id?: string | null;
          rationale?: string | null;
          share_slug?: string | null;
          source_kind?: string | null;
          status?: string;
          title: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          decided_by_agent_slug?: string | null;
          id?: string;
          is_public?: boolean;
          meeting_id?: string | null;
          mission_id?: string | null;
          prd_id?: string | null;
          product_id?: string | null;
          project_id?: string | null;
          rationale?: string | null;
          share_slug?: string | null;
          source_kind?: string | null;
          status?: string;
          title?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decisions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_prd_id_fkey";
            columns: ["prd_id"];
            isOneToOne: false;
            referencedRelation: "prds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      doc_versions: {
        Row: {
          content_json: Json;
          created_at: string;
          doc_id: string;
          id: string;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          content_json: Json;
          created_at?: string;
          doc_id: string;
          id?: string;
          title: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          content_json?: Json;
          created_at?: string;
          doc_id?: string;
          id?: string;
          title?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doc_versions_doc_id_fkey";
            columns: ["doc_id"];
            isOneToOne: false;
            referencedRelation: "docs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "doc_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      docs: {
        Row: {
          archived: boolean;
          content_json: Json;
          content_text: string;
          created_at: string;
          icon: string | null;
          id: string;
          parent_id: string | null;
          position: number;
          product_id: string | null;
          project_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          archived?: boolean;
          content_json?: Json;
          content_text?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          parent_id?: string | null;
          position?: number;
          product_id?: string | null;
          project_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          archived?: boolean;
          content_json?: Json;
          content_text?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          parent_id?: string | null;
          position?: number;
          product_id?: string | null;
          project_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "docs_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "docs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "docs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "docs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "docs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      drift_baselines: {
        Row: {
          baseline_days: number;
          cost_pct_threshold: number;
          created_at: string;
          enabled: boolean;
          error_rate_pct_threshold: number;
          id: string;
          latency_pct_threshold: number;
          score_pct_threshold: number;
          tokens_pct_threshold: number;
          updated_at: string;
          user_id: string;
          window_days: number;
        };
        Insert: {
          baseline_days?: number;
          cost_pct_threshold?: number;
          created_at?: string;
          enabled?: boolean;
          error_rate_pct_threshold?: number;
          id?: string;
          latency_pct_threshold?: number;
          score_pct_threshold?: number;
          tokens_pct_threshold?: number;
          updated_at?: string;
          user_id: string;
          window_days?: number;
        };
        Update: {
          baseline_days?: number;
          cost_pct_threshold?: number;
          created_at?: string;
          enabled?: boolean;
          error_rate_pct_threshold?: number;
          id?: string;
          latency_pct_threshold?: number;
          score_pct_threshold?: number;
          tokens_pct_threshold?: number;
          updated_at?: string;
          user_id?: string;
          window_days?: number;
        };
        Relationships: [];
      };
      drift_incidents: {
        Row: {
          baseline_value: number;
          created_at: string;
          current_value: number;
          delta_pct: number;
          detail: Json;
          detected_at: string;
          id: string;
          metric: string;
          model: string;
          prompt_version_id: string | null;
          resolved_at: string | null;
          severity: string;
          status: string;
          surface: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          baseline_value: number;
          created_at?: string;
          current_value: number;
          delta_pct: number;
          detail?: Json;
          detected_at?: string;
          id?: string;
          metric: string;
          model: string;
          prompt_version_id?: string | null;
          resolved_at?: string | null;
          severity?: string;
          status?: string;
          surface: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          baseline_value?: number;
          created_at?: string;
          current_value?: number;
          delta_pct?: number;
          detail?: Json;
          detected_at?: string;
          id?: string;
          metric?: string;
          model?: string;
          prompt_version_id?: string | null;
          resolved_at?: string | null;
          severity?: string;
          status?: string;
          surface?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drift_incidents_prompt_version_id_fkey";
            columns: ["prompt_version_id"];
            isOneToOne: false;
            referencedRelation: "prompt_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      drift_snapshots: {
        Row: {
          avg_cost_usd: number;
          avg_eval_score: number | null;
          avg_latency_ms: number;
          avg_total_tokens: number;
          bucket_date: string;
          created_at: string;
          error_count: number;
          id: string;
          model: string;
          p95_latency_ms: number;
          prompt_version_id: string | null;
          request_count: number;
          surface: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avg_cost_usd?: number;
          avg_eval_score?: number | null;
          avg_latency_ms?: number;
          avg_total_tokens?: number;
          bucket_date: string;
          created_at?: string;
          error_count?: number;
          id?: string;
          model: string;
          p95_latency_ms?: number;
          prompt_version_id?: string | null;
          request_count?: number;
          surface: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avg_cost_usd?: number;
          avg_eval_score?: number | null;
          avg_latency_ms?: number;
          avg_total_tokens?: number;
          bucket_date?: string;
          created_at?: string;
          error_count?: number;
          id?: string;
          model?: string;
          p95_latency_ms?: number;
          prompt_version_id?: string | null;
          request_count?: number;
          surface?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drift_snapshots_prompt_version_id_fkey";
            columns: ["prompt_version_id"];
            isOneToOne: false;
            referencedRelation: "prompt_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_case_results: {
        Row: {
          actual: string | null;
          ai_event_id: string | null;
          case_id: string;
          completion_tokens: number | null;
          cost_usd: number | null;
          created_at: string;
          error: string | null;
          event_id: string | null;
          id: string;
          judge_event_id: string | null;
          judge_reasoning: string | null;
          latency_ms: number | null;
          passed: boolean;
          prompt_tokens: number | null;
          reasons: Json;
          run_id: string;
          score: number | null;
          status: string;
          user_id: string;
        };
        Insert: {
          actual?: string | null;
          ai_event_id?: string | null;
          case_id: string;
          completion_tokens?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          error?: string | null;
          event_id?: string | null;
          id?: string;
          judge_event_id?: string | null;
          judge_reasoning?: string | null;
          latency_ms?: number | null;
          passed?: boolean;
          prompt_tokens?: number | null;
          reasons?: Json;
          run_id: string;
          score?: number | null;
          status?: string;
          user_id: string;
        };
        Update: {
          actual?: string | null;
          ai_event_id?: string | null;
          case_id?: string;
          completion_tokens?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          error?: string | null;
          event_id?: string | null;
          id?: string;
          judge_event_id?: string | null;
          judge_reasoning?: string | null;
          latency_ms?: number | null;
          passed?: boolean;
          prompt_tokens?: number | null;
          reasons?: Json;
          run_id?: string;
          score?: number | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      eval_cases: {
        Row: {
          assertions: Json;
          created_at: string;
          enabled: boolean;
          expected: string | null;
          id: string;
          input: string;
          name: string;
          rubric: string | null;
          suite_id: string;
          tags: string[] | null;
          updated_at: string;
          user_id: string;
          weight: number;
        };
        Insert: {
          assertions?: Json;
          created_at?: string;
          enabled?: boolean;
          expected?: string | null;
          id?: string;
          input: string;
          name: string;
          rubric?: string | null;
          suite_id: string;
          tags?: string[] | null;
          updated_at?: string;
          user_id: string;
          weight?: number;
        };
        Update: {
          assertions?: Json;
          created_at?: string;
          enabled?: boolean;
          expected?: string | null;
          id?: string;
          input?: string;
          name?: string;
          rubric?: string | null;
          suite_id?: string;
          tags?: string[] | null;
          updated_at?: string;
          user_id?: string;
          weight?: number;
        };
        Relationships: [];
      };
      eval_runs: {
        Row: {
          avg_score: number | null;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          errored: number;
          fail_count: number;
          id: string;
          judge_model: string | null;
          model: string;
          notes: string | null;
          pass_count: number;
          prompt_version_id: string | null;
          started_at: string;
          status: string;
          suite_id: string;
          total_cases: number;
          total_cost_usd: number;
          total_latency_ms: number | null;
          trigger: string;
          user_id: string;
        };
        Insert: {
          avg_score?: number | null;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          errored?: number;
          fail_count?: number;
          id?: string;
          judge_model?: string | null;
          model: string;
          notes?: string | null;
          pass_count?: number;
          prompt_version_id?: string | null;
          started_at?: string;
          status?: string;
          suite_id: string;
          total_cases?: number;
          total_cost_usd?: number;
          total_latency_ms?: number | null;
          trigger?: string;
          user_id: string;
        };
        Update: {
          avg_score?: number | null;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          errored?: number;
          fail_count?: number;
          id?: string;
          judge_model?: string | null;
          model?: string;
          notes?: string | null;
          pass_count?: number;
          prompt_version_id?: string | null;
          started_at?: string;
          status?: string;
          suite_id?: string;
          total_cases?: number;
          total_cost_usd?: number;
          total_latency_ms?: number | null;
          trigger?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      eval_suites: {
        Row: {
          built_in: boolean;
          created_at: string;
          description: string | null;
          enabled: boolean;
          id: string;
          judge_model: string;
          last_run_at: string | null;
          model: string | null;
          name: string;
          pass_threshold: number;
          prompt_key: string | null;
          schedule_cron: string | null;
          surface: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          built_in?: boolean;
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          judge_model?: string;
          last_run_at?: string | null;
          model?: string | null;
          name: string;
          pass_threshold?: number;
          prompt_key?: string | null;
          schedule_cron?: string | null;
          surface?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          built_in?: boolean;
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          judge_model?: string;
          last_run_at?: string | null;
          model?: string | null;
          name?: string;
          pass_threshold?: number;
          prompt_key?: string | null;
          schedule_cron?: string | null;
          surface?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      event_queue: {
        Row: {
          approval_mode: string;
          attempt_count: number;
          created_at: string;
          decided_at: string | null;
          dispatched_at: string | null;
          error: string | null;
          event_type: string;
          id: string;
          mission_id: string | null;
          next_attempt_at: string | null;
          payload: Json;
          run_id: string | null;
          source_id: string;
          source_table: string;
          status: string;
          subscription_id: string;
          target_agent_slug: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          approval_mode: string;
          attempt_count?: number;
          created_at?: string;
          decided_at?: string | null;
          dispatched_at?: string | null;
          error?: string | null;
          event_type: string;
          id?: string;
          mission_id?: string | null;
          next_attempt_at?: string | null;
          payload?: Json;
          run_id?: string | null;
          source_id: string;
          source_table: string;
          status?: string;
          subscription_id: string;
          target_agent_slug: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          approval_mode?: string;
          attempt_count?: number;
          created_at?: string;
          decided_at?: string | null;
          dispatched_at?: string | null;
          error?: string | null;
          event_type?: string;
          id?: string;
          mission_id?: string | null;
          next_attempt_at?: string | null;
          payload?: Json;
          run_id?: string | null;
          source_id?: string;
          source_table?: string;
          status?: string;
          subscription_id?: string;
          target_agent_slug?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_queue_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "event_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_queue_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      event_subscriptions: {
        Row: {
          approval_mode: string;
          created_at: string;
          enabled: boolean;
          event_type: string;
          filter: Json;
          id: string;
          is_default: boolean;
          target_agent_slug: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          approval_mode?: string;
          created_at?: string;
          enabled?: boolean;
          event_type: string;
          filter?: Json;
          id?: string;
          is_default?: boolean;
          target_agent_slug: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          approval_mode?: string;
          created_at?: string;
          enabled?: boolean;
          event_type?: string;
          filter?: Json;
          id?: string;
          is_default?: boolean;
          target_agent_slug?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_subscriptions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      export_log: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          row_count: number;
          sections: string[] | null;
          target_id: string | null;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          row_count?: number;
          sections?: string[] | null;
          target_id?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          row_count?: number;
          sections?: string[] | null;
          target_id?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          enabled: boolean;
          id: string;
          key: string;
          payload: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          enabled?: boolean;
          id?: string;
          key: string;
          payload?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          key?: string;
          payload?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      guardrail_hits: {
        Row: {
          action: string;
          created_at: string;
          event_id: string | null;
          id: string;
          kind: string;
          matched: string | null;
          rule_id: string | null;
          rule_name: string;
          side: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          kind: string;
          matched?: string | null;
          rule_id?: string | null;
          rule_name: string;
          side: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          kind?: string;
          matched?: string | null;
          rule_id?: string | null;
          rule_name?: string;
          side?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardrail_hits_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      guardrail_rules: {
        Row: {
          action: string;
          applies_to: string;
          built_in: boolean;
          created_at: string;
          enabled: boolean;
          id: string;
          kind: string;
          name: string;
          pattern: string;
          user_id: string;
        };
        Insert: {
          action?: string;
          applies_to?: string;
          built_in?: boolean;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          kind: string;
          name: string;
          pattern: string;
          user_id: string;
        };
        Update: {
          action?: string;
          applies_to?: string;
          built_in?: boolean;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          kind?: string;
          name?: string;
          pattern?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          result: Json | null;
          run_id: string | null;
          scope: string;
          user_id: string | null;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          result?: Json | null;
          run_id?: string | null;
          scope: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          result?: Json | null;
          run_id?: string | null;
          scope?: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "agent_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "idempotency_keys_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ingest_rate_limits: {
        Row: {
          id: string;
          request_count: number;
          token_id: string;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          id?: string;
          request_count?: number;
          token_id: string;
          updated_at?: string;
          window_start?: string;
        };
        Update: {
          id?: string;
          request_count?: number;
          token_id?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingest_rate_limits_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: true;
            referencedRelation: "ingest_tokens";
            referencedColumns: ["id"];
          },
        ];
      };
      ingest_tokens: {
        Row: {
          created_at: string | null;
          id: string;
          label: string | null;
          revoked_at: string | null;
          token_hash: string;
          token_prefix: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          label?: string | null;
          revoked_at?: string | null;
          token_hash: string;
          token_prefix?: string | null;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          label?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
          token_prefix?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          state: string;
          token: string;
          workspace_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          state?: string;
          token: string;
          workspace_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          state?: string;
          token?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      job_runs: {
        Row: {
          duration_ms: number | null;
          error_kind: string | null;
          error_message: string | null;
          finished_at: string | null;
          id: number;
          job_name: string;
          payload_size: number | null;
          started_at: string;
          status: string;
          workspace_id: string | null;
        };
        Insert: {
          duration_ms?: number | null;
          error_kind?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: never;
          job_name: string;
          payload_size?: number | null;
          started_at?: string;
          status: string;
          workspace_id?: string | null;
        };
        Update: {
          duration_ms?: number | null;
          error_kind?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: never;
          job_name?: string;
          payload_size?: number | null;
          started_at?: string;
          status?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      kill_switches: {
        Row: {
          created_at: string;
          id: string;
          paused: boolean;
          reason: string | null;
          scope: string;
          set_at: string;
          set_by: string | null;
          updated_at: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          paused?: boolean;
          reason?: string | null;
          scope: string;
          set_at?: string;
          set_by?: string | null;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          paused?: boolean;
          reason?: string | null;
          scope?: string;
          set_at?: string;
          set_by?: string | null;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "kill_switches_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      learnings: {
        Row: {
          created_at: string;
          id: string;
          metric_label: string | null;
          metric_value: string | null;
          new_ice: number | null;
          opportunity_id: string | null;
          prd_id: string | null;
          prior_ice: number | null;
          summary: string;
          updated_at: string;
          user_id: string;
          verdict: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metric_label?: string | null;
          metric_value?: string | null;
          new_ice?: number | null;
          opportunity_id?: string | null;
          prd_id?: string | null;
          prior_ice?: number | null;
          summary: string;
          updated_at?: string;
          user_id: string;
          verdict: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          metric_label?: string | null;
          metric_value?: string | null;
          new_ice?: number | null;
          opportunity_id?: string | null;
          prd_id?: string | null;
          prior_ice?: number | null;
          summary?: string;
          updated_at?: string;
          user_id?: string;
          verdict?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learnings_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learnings_prd_id_fkey";
            columns: ["prd_id"];
            isOneToOne: false;
            referencedRelation: "prds";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_tokens: {
        Row: {
          created_at: string | null;
          id: string;
          last_used_at: string | null;
          metadata: Json | null;
          rate_limit_per_min: number | null;
          revoked_at: string | null;
          scopes: string[];
          secret_hash: string;
          slug: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          metadata?: Json | null;
          rate_limit_per_min?: number | null;
          revoked_at?: string | null;
          scopes?: string[];
          secret_hash: string;
          slug: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          metadata?: Json | null;
          rate_limit_per_min?: number | null;
          revoked_at?: string | null;
          scopes?: string[];
          secret_hash?: string;
          slug?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mcp_tokens_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          action_items: Json;
          audio_url: string | null;
          created_at: string;
          decisions_made: Json;
          end_at: string;
          id: string;
          notes: string | null;
          processed_at: string | null;
          stakeholder: string | null;
          start_at: string;
          summary: string | null;
          title: string;
          transcript: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          action_items?: Json;
          audio_url?: string | null;
          created_at?: string;
          decisions_made?: Json;
          end_at: string;
          id?: string;
          notes?: string | null;
          processed_at?: string | null;
          stakeholder?: string | null;
          start_at: string;
          summary?: string | null;
          title: string;
          transcript?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          action_items?: Json;
          audio_url?: string | null;
          created_at?: string;
          decisions_made?: Json;
          end_at?: string;
          id?: string;
          notes?: string | null;
          processed_at?: string | null;
          stakeholder?: string | null;
          start_at?: string;
          summary?: string | null;
          title?: string;
          transcript?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          model: string | null;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          content?: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          model?: string | null;
          role: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          model?: string | null;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_steps: {
        Row: {
          agent_slug: string;
          attempts: number;
          completed_at: string | null;
          created_at: string;
          depends_on: number[];
          dispatched_at: string | null;
          error: string | null;
          id: string;
          idx: number;
          max_attempts: number;
          message_id: string | null;
          mission_id: string;
          next_retry_at: string | null;
          rationale: string | null;
          result: Json | null;
          run_id: string | null;
          status: string;
          sub_goal: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          agent_slug: string;
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          depends_on?: number[];
          dispatched_at?: string | null;
          error?: string | null;
          id?: string;
          idx: number;
          max_attempts?: number;
          message_id?: string | null;
          mission_id: string;
          next_retry_at?: string | null;
          rationale?: string | null;
          result?: Json | null;
          run_id?: string | null;
          status?: string;
          sub_goal: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          agent_slug?: string;
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          depends_on?: number[];
          dispatched_at?: string | null;
          error?: string | null;
          id?: string;
          idx?: number;
          max_attempts?: number;
          message_id?: string | null;
          mission_id?: string;
          next_retry_at?: string | null;
          rationale?: string | null;
          result?: Json | null;
          run_id?: string | null;
          status?: string;
          sub_goal?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_steps_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "agent_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_steps_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_steps_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "agent_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      missions: {
        Row: {
          archived_at: string | null;
          completed_at: string | null;
          created_at: string;
          current_agent_id: string | null;
          goal: string;
          hop_count: number;
          id: string;
          replayed_from_mission_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_agent_id?: string | null;
          goal: string;
          hop_count?: number;
          id?: string;
          replayed_from_mission_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_agent_id?: string | null;
          goal?: string;
          hop_count?: number;
          id?: string;
          replayed_from_mission_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "missions_replayed_from_mission_id_fkey";
            columns: ["replayed_from_mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          project_id: string | null;
          tags: string[];
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          project_id?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          project_id?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          confidence: number;
          created_at: string;
          critic_review: Json | null;
          ease: number;
          hypothesis: string | null;
          ice_score: number | null;
          id: string;
          impact: number;
          is_public: boolean;
          problem: string;
          product_id: string | null;
          project_id: string | null;
          roadmap_bucket: string | null;
          roadmap_measure: string | null;
          roadmap_outcome: string | null;
          share_slug: string | null;
          status: string;
          target_user: string | null;
          theme_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          critic_review?: Json | null;
          ease?: number;
          hypothesis?: string | null;
          ice_score?: number | null;
          id?: string;
          impact?: number;
          is_public?: boolean;
          problem?: string;
          product_id?: string | null;
          project_id?: string | null;
          roadmap_bucket?: string | null;
          roadmap_measure?: string | null;
          roadmap_outcome?: string | null;
          share_slug?: string | null;
          status?: string;
          target_user?: string | null;
          theme_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          critic_review?: Json | null;
          ease?: number;
          hypothesis?: string | null;
          ice_score?: number | null;
          id?: string;
          impact?: number;
          is_public?: boolean;
          problem?: string;
          product_id?: string | null;
          project_id?: string | null;
          roadmap_bucket?: string | null;
          roadmap_measure?: string | null;
          roadmap_outcome?: string | null;
          share_slug?: string | null;
          status?: string;
          target_user?: string | null;
          theme_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      playbook_runs: {
        Row: {
          created_at: string;
          decision_id: string | null;
          id: string;
          playbook_id: string;
          playbook_version: number;
          resolved_at: string | null;
          station: string;
          user_id: string;
          verdict: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          decision_id?: string | null;
          id?: string;
          playbook_id: string;
          playbook_version?: number;
          resolved_at?: string | null;
          station: string;
          user_id?: string;
          verdict?: string | null;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          decision_id?: string | null;
          id?: string;
          playbook_id?: string;
          playbook_version?: number;
          resolved_at?: string | null;
          station?: string;
          user_id?: string;
          verdict?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playbook_runs_decision_id_fkey";
            columns: ["decision_id"];
            isOneToOne: false;
            referencedRelation: "decisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playbook_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prds: {
        Row: {
          body_md: string;
          citations: Json | null;
          created_at: string;
          critic_review: Json | null;
          github_issue_url: string | null;
          id: string;
          model: string | null;
          opportunity_id: string | null;
          outcome: Json | null;
          product_id: string | null;
          project_id: string | null;
          shipped_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body_md?: string;
          citations?: Json | null;
          created_at?: string;
          critic_review?: Json | null;
          github_issue_url?: string | null;
          id?: string;
          model?: string | null;
          opportunity_id?: string | null;
          outcome?: Json | null;
          product_id?: string | null;
          project_id?: string | null;
          shipped_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          body_md?: string;
          citations?: Json | null;
          created_at?: string;
          critic_review?: Json | null;
          github_issue_url?: string | null;
          id?: string;
          model?: string | null;
          opportunity_id?: string | null;
          outcome?: Json | null;
          product_id?: string | null;
          project_id?: string | null;
          shipped_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prds_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prds_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_bundles: {
        Row: {
          active: boolean;
          created_at: string;
          credits: number;
          id: string;
          monthly_cents: number;
          recommended: boolean;
          sort_order: number;
          stripe_price_id_monthly: string | null;
          stripe_price_id_yearly: string | null;
          tier: string;
          updated_at: string;
          yearly_cents: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          credits: number;
          id?: string;
          monthly_cents: number;
          recommended?: boolean;
          sort_order?: number;
          stripe_price_id_monthly?: string | null;
          stripe_price_id_yearly?: string | null;
          tier: string;
          updated_at?: string;
          yearly_cents: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          credits?: number;
          id?: string;
          monthly_cents?: number;
          recommended?: boolean;
          sort_order?: number;
          stripe_price_id_monthly?: string | null;
          stripe_price_id_yearly?: string | null;
          tier?: string;
          updated_at?: string;
          yearly_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_bundles_tier_fkey";
            columns: ["tier"];
            isOneToOne: false;
            referencedRelation: "pricing_plans";
            referencedColumns: ["tier"];
          },
        ];
      };
      pricing_features: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          label: string;
          sort_order: number;
          tier: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          label: string;
          sort_order?: number;
          tier: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          label?: string;
          sort_order?: number;
          tier?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_features_tier_fkey";
            columns: ["tier"];
            isOneToOne: false;
            referencedRelation: "pricing_plans";
            referencedColumns: ["tier"];
          },
        ];
      };
      pricing_plans: {
        Row: {
          active: boolean;
          audience: string;
          created_at: string;
          display_name: string;
          recommended: boolean;
          sort_order: number;
          tagline: string | null;
          tier: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          audience?: string;
          created_at?: string;
          display_name: string;
          recommended?: boolean;
          sort_order?: number;
          tagline?: string | null;
          tier: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          audience?: string;
          created_at?: string;
          display_name?: string;
          recommended?: boolean;
          sort_order?: number;
          tagline?: string | null;
          tier?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pricing_topup_bundles: {
        Row: {
          active: boolean;
          created_at: string;
          credits: number;
          id: string;
          price_cents: number;
          sort_order: number;
          stripe_price_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          credits: number;
          id?: string;
          price_cents: number;
          sort_order?: number;
          stripe_price_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          credits?: number;
          id?: string;
          price_cents?: number;
          sort_order?: number;
          stripe_price_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          default_model: string;
          display_name: string | null;
          full_name: string | null;
          id: string;
          onboarded: boolean;
          role: string | null;
          suspended: boolean;
          timezone: string | null;
          updated_at: string;
          voice_anchor_text: string | null;
          working_hours_end: number;
          working_hours_start: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          default_model?: string;
          display_name?: string | null;
          full_name?: string | null;
          id: string;
          onboarded?: boolean;
          role?: string | null;
          suspended?: boolean;
          timezone?: string | null;
          updated_at?: string;
          voice_anchor_text?: string | null;
          working_hours_end?: number;
          working_hours_start?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          default_model?: string;
          display_name?: string | null;
          full_name?: string | null;
          id?: string;
          onboarded?: boolean;
          role?: string | null;
          suspended?: boolean;
          timezone?: string | null;
          updated_at?: string;
          voice_anchor_text?: string | null;
          working_hours_end?: number;
          working_hours_start?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          north_star: string | null;
          status: string;
          target_date: string | null;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          north_star?: string | null;
          status?: string;
          target_date?: string | null;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          north_star?: string | null;
          status?: string;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prompt_assignments: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          split_pct: number;
          template_id: string;
          updated_at: string;
          user_id: string;
          variant_a_version_id: string | null;
          variant_b_version_id: string | null;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          split_pct?: number;
          template_id: string;
          updated_at?: string;
          user_id: string;
          variant_a_version_id?: string | null;
          variant_b_version_id?: string | null;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          split_pct?: number;
          template_id?: string;
          updated_at?: string;
          user_id?: string;
          variant_a_version_id?: string | null;
          variant_b_version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_assignments_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "prompt_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_assignments_variant_a_version_id_fkey";
            columns: ["variant_a_version_id"];
            isOneToOne: false;
            referencedRelation: "prompt_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_assignments_variant_b_version_id_fkey";
            columns: ["variant_b_version_id"];
            isOneToOne: false;
            referencedRelation: "prompt_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      prompt_runs: {
        Row: {
          created_at: string;
          event_id: string | null;
          id: string;
          rendered_input: string | null;
          template_id: string | null;
          user_id: string;
          variant: string | null;
          version_id: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          rendered_input?: string | null;
          template_id?: string | null;
          user_id: string;
          variant?: string | null;
          version_id?: string | null;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          rendered_input?: string | null;
          template_id?: string | null;
          user_id?: string;
          variant?: string | null;
          version_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_runs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "prompt_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_runs_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "prompt_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prompt_templates: {
        Row: {
          active_version_id: string | null;
          built_in: boolean;
          created_at: string;
          default_version_id: string | null;
          description: string | null;
          id: string;
          key: string;
          name: string;
          surface: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_version_id?: string | null;
          built_in?: boolean;
          created_at?: string;
          default_version_id?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          name: string;
          surface: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_version_id?: string | null;
          built_in?: boolean;
          created_at?: string;
          default_version_id?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          name?: string;
          surface?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      prompt_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          model: string | null;
          notes: string | null;
          status: string;
          system_prompt: string;
          temperature: number | null;
          template_id: string;
          updated_at: string;
          user_id: string;
          user_template: string;
          variables: Json;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          status?: string;
          system_prompt?: string;
          temperature?: number | null;
          template_id: string;
          updated_at?: string;
          user_id: string;
          user_template?: string;
          variables?: Json;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          status?: string;
          system_prompt?: string;
          temperature?: number | null;
          template_id?: string;
          updated_at?: string;
          user_id?: string;
          user_template?: string;
          variables?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_versions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "prompt_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      prototype_attachments: {
        Row: {
          created_at: string;
          extracted_text: string | null;
          id: string;
          kind: string;
          message_id: string | null;
          name: string;
          prototype_id: string;
          size_bytes: number;
          storage_path: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          extracted_text?: string | null;
          id?: string;
          kind?: string;
          message_id?: string | null;
          name: string;
          prototype_id: string;
          size_bytes?: number;
          storage_path: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          extracted_text?: string | null;
          id?: string;
          kind?: string;
          message_id?: string | null;
          name?: string;
          prototype_id?: string;
          size_bytes?: number;
          storage_path?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prototype_attachments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prototype_files: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          language: string;
          path: string;
          prototype_id: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          id?: string;
          language?: string;
          path: string;
          prototype_id: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          language?: string;
          path?: string;
          prototype_id?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prototype_files_prototype_id_fkey";
            columns: ["prototype_id"];
            isOneToOne: false;
            referencedRelation: "prototypes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prototype_files_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prototype_messages: {
        Row: {
          applied: boolean;
          changes_json: Json;
          content: string;
          created_at: string;
          id: string;
          prototype_id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          applied?: boolean;
          changes_json?: Json;
          content?: string;
          created_at?: string;
          id?: string;
          prototype_id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          applied?: boolean;
          changes_json?: Json;
          content?: string;
          created_at?: string;
          id?: string;
          prototype_id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prototype_messages_prototype_id_fkey";
            columns: ["prototype_id"];
            isOneToOne: false;
            referencedRelation: "prototypes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prototype_messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prototypes: {
        Row: {
          created_at: string;
          description: string | null;
          entry_path: string;
          id: string;
          is_public: boolean;
          name: string;
          prd_id: string | null;
          project_id: string | null;
          share_slug: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          entry_path?: string;
          id?: string;
          is_public?: boolean;
          name: string;
          prd_id?: string | null;
          project_id?: string | null;
          share_slug?: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          entry_path?: string;
          id?: string;
          is_public?: boolean;
          name?: string;
          prd_id?: string | null;
          project_id?: string | null;
          share_slug?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prototypes_prd_id_fkey";
            columns: ["prd_id"];
            isOneToOne: false;
            referencedRelation: "prds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prototypes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prototypes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      public_decision_rate_limits: {
        Row: {
          client_ip: string;
          id: string;
          request_count: number;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          client_ip: string;
          id?: string;
          request_count?: number;
          updated_at?: string;
          window_start?: string;
        };
        Update: {
          client_ip?: string;
          id?: string;
          request_count?: number;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      rag_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          content_hash: string | null;
          created_at: string;
          embedding: string | null;
          id: string;
          metadata: Json;
          product_id: string | null;
          source_id: string | null;
          source_kind: string;
          title: string | null;
          token_estimate: number;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          chunk_index?: number;
          content: string;
          content_hash?: string | null;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
          product_id?: string | null;
          source_id?: string | null;
          source_kind: string;
          title?: string | null;
          token_estimate?: number;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          content_hash?: string | null;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
          product_id?: string | null;
          source_id?: string | null;
          source_kind?: string;
          title?: string | null;
          token_estimate?: number;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rag_chunks_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rag_chunks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ritual_sessions: {
        Row: {
          calls_cleared: number | null;
          calls_shown: number | null;
          created_at: string;
          id: string;
          opened_at: string;
          opened_on: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          calls_cleared?: number | null;
          calls_shown?: number | null;
          created_at?: string;
          id?: string;
          opened_at?: string;
          opened_on?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          calls_cleared?: number | null;
          calls_shown?: number | null;
          created_at?: string;
          id?: string;
          opened_at?: string;
          opened_on?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ritual_sessions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_audit: {
        Row: {
          action: string;
          created_at: string;
          from_bucket: string | null;
          id: string;
          measure: string | null;
          opportunity_id: string;
          outcome: string | null;
          to_bucket: string | null;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          from_bucket?: string | null;
          id?: string;
          measure?: string | null;
          opportunity_id: string;
          outcome?: string | null;
          to_bucket?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          from_bucket?: string | null;
          id?: string;
          measure?: string | null;
          opportunity_id?: string;
          outcome?: string | null;
          to_bucket?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_audit_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduler_proposals: {
        Row: {
          calendar_event_id: string | null;
          chosen_slot: Json | null;
          created_at: string;
          description: string | null;
          duration_minutes: number;
          id: string;
          slots: Json;
          source_id: string | null;
          source_kind: string | null;
          status: string;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          calendar_event_id?: string | null;
          chosen_slot?: Json | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          slots?: Json;
          source_id?: string | null;
          source_kind?: string | null;
          status?: string;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          calendar_event_id?: string | null;
          chosen_slot?: Json | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          slots?: Json;
          source_id?: string | null;
          source_kind?: string | null;
          status?: string;
          title?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduler_proposals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      signals: {
        Row: {
          content: string;
          created_at: string;
          embedding: string | null;
          external_id: string | null;
          id: string;
          product_id: string | null;
          project_id: string | null;
          sentiment: string | null;
          source: string;
          tags: string[];
          theme_id: string | null;
          title: string | null;
          url: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          embedding?: string | null;
          external_id?: string | null;
          id?: string;
          product_id?: string | null;
          project_id?: string | null;
          sentiment?: string | null;
          source?: string;
          tags?: string[];
          theme_id?: string | null;
          title?: string | null;
          url?: string | null;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embedding?: string | null;
          external_id?: string | null;
          id?: string;
          product_id?: string | null;
          project_id?: string | null;
          sentiment?: string | null;
          source?: string;
          tags?: string[];
          theme_id?: string | null;
          title?: string | null;
          url?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signals_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      signup_approvals: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          note: string | null;
          requested_workspace_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          state: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          note?: string | null;
          requested_workspace_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          state?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          note?: string | null;
          requested_workspace_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          state?: string;
        };
        Relationships: [];
      };
      studio_changes: {
        Row: {
          base_content: string | null;
          base_sha: string | null;
          changeset_id: string;
          created_at: string;
          id: string;
          new_content: string | null;
          op: string;
          path: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          base_content?: string | null;
          base_sha?: string | null;
          changeset_id: string;
          created_at?: string;
          id?: string;
          new_content?: string | null;
          op: string;
          path: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          base_content?: string | null;
          base_sha?: string | null;
          changeset_id?: string;
          created_at?: string;
          id?: string;
          new_content?: string | null;
          op?: string;
          path?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_changes_changeset_id_fkey";
            columns: ["changeset_id"];
            isOneToOne: false;
            referencedRelation: "studio_changesets";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_changeset_constraints: {
        Row: {
          allowed_paths: string[];
          created_at: string;
          id: string;
          max_files: number | null;
          mission_id: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          allowed_paths?: string[];
          created_at?: string;
          id?: string;
          max_files?: number | null;
          mission_id: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          allowed_paths?: string[];
          created_at?: string;
          id?: string;
          max_files?: number | null;
          mission_id?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_changeset_constraints_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: true;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_changeset_revisions: {
        Row: {
          changeset_id: string;
          commit_sha: string;
          commit_url: string | null;
          created_at: string;
          files: Json;
          id: string;
          message: string;
          revision_no: number;
          user_id: string;
        };
        Insert: {
          changeset_id: string;
          commit_sha: string;
          commit_url?: string | null;
          created_at?: string;
          files?: Json;
          id?: string;
          message?: string;
          revision_no: number;
          user_id: string;
        };
        Update: {
          changeset_id?: string;
          commit_sha?: string;
          commit_url?: string | null;
          created_at?: string;
          files?: Json;
          id?: string;
          message?: string;
          revision_no?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_changeset_revisions_changeset_id_fkey";
            columns: ["changeset_id"];
            isOneToOne: false;
            referencedRelation: "studio_changesets";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_changesets: {
        Row: {
          base_sha: string | null;
          branch: string | null;
          created_at: string;
          id: string;
          mission_id: string | null;
          pr_number: number | null;
          pr_url: string | null;
          product_id: string | null;
          release_notes: string | null;
          release_notes_at: string | null;
          repo: string;
          status: string;
          summary: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          base_sha?: string | null;
          branch?: string | null;
          created_at?: string;
          id?: string;
          mission_id?: string | null;
          pr_number?: number | null;
          pr_url?: string | null;
          product_id?: string | null;
          release_notes?: string | null;
          release_notes_at?: string | null;
          repo: string;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          base_sha?: string | null;
          branch?: string | null;
          created_at?: string;
          id?: string;
          mission_id?: string | null;
          pr_number?: number | null;
          pr_url?: string | null;
          product_id?: string | null;
          release_notes?: string | null;
          release_notes_at?: string | null;
          repo?: string;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_changesets_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          account_id: string | null;
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          environment: string;
          id: string;
          plan_override_expires_at: string | null;
          plan_override_reason: string | null;
          plan_override_tier: string | null;
          price_id: string;
          product_id: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          plan_override_expires_at?: string | null;
          plan_override_reason?: string | null;
          plan_override_tier?: string | null;
          price_id: string;
          product_id: string;
          status?: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          plan_override_expires_at?: string | null;
          plan_override_reason?: string | null;
          plan_override_tier?: string | null;
          price_id?: string;
          product_id?: string;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_override_tier_fkey";
            columns: ["plan_override_tier"];
            isOneToOne: false;
            referencedRelation: "pricing_plans";
            referencedColumns: ["tier"];
          },
        ];
      };
      support_tickets: {
        Row: {
          body: string;
          cluster_key: string | null;
          created_at: string;
          external_id: string | null;
          id: string;
          product_id: string | null;
          requester: string | null;
          signal_id: string | null;
          source: string;
          status: string;
          subject: string | null;
          triaged_at: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body: string;
          cluster_key?: string | null;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          product_id?: string | null;
          requester?: string | null;
          signal_id?: string | null;
          source?: string;
          status?: string;
          subject?: string | null;
          triaged_at?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Update: {
          body?: string;
          cluster_key?: string | null;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          product_id?: string | null;
          requester?: string | null;
          signal_id?: string | null;
          source?: string;
          status?: string;
          subject?: string | null;
          triaged_at?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_signal_id_fkey";
            columns: ["signal_id"];
            isOneToOne: false;
            referencedRelation: "signals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_mappings: {
        Row: {
          conflict: boolean;
          created_at: string;
          external_id: string;
          external_url: string | null;
          id: string;
          last_pulled_at: string | null;
          last_pushed_at: string | null;
          local_id: string;
          local_kind: string;
          provider: string;
          updated_at: string;
          user_id: string;
          version_local: number;
          version_remote: number;
        };
        Insert: {
          conflict?: boolean;
          created_at?: string;
          external_id: string;
          external_url?: string | null;
          id?: string;
          last_pulled_at?: string | null;
          last_pushed_at?: string | null;
          local_id: string;
          local_kind: string;
          provider: string;
          updated_at?: string;
          user_id: string;
          version_local?: number;
          version_remote?: number;
        };
        Update: {
          conflict?: boolean;
          created_at?: string;
          external_id?: string;
          external_url?: string | null;
          id?: string;
          last_pulled_at?: string | null;
          last_pushed_at?: string | null;
          local_id?: string;
          local_kind?: string;
          provider?: string;
          updated_at?: string;
          user_id?: string;
          version_local?: number;
          version_remote?: number;
        };
        Relationships: [];
      };
      system_banner: {
        Row: {
          active: boolean;
          expires_at: string | null;
          id: string;
          level: string;
          message: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          expires_at?: string | null;
          id?: string;
          level?: string;
          message: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          expires_at?: string | null;
          id?: string;
          level?: string;
          message?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          agent_id: string | null;
          assignee_kind: string;
          completed_at: string | null;
          created_at: string;
          depends_on: Json;
          detail: string | null;
          due_date: string | null;
          estimate_hours: number | null;
          id: string;
          is_deep_work: boolean;
          prd_id: string | null;
          priority: string;
          product_id: string | null;
          project_id: string | null;
          risk: string | null;
          seq: number | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          agent_id?: string | null;
          assignee_kind?: string;
          completed_at?: string | null;
          created_at?: string;
          depends_on?: Json;
          detail?: string | null;
          due_date?: string | null;
          estimate_hours?: number | null;
          id?: string;
          is_deep_work?: boolean;
          prd_id?: string | null;
          priority?: string;
          product_id?: string | null;
          project_id?: string | null;
          risk?: string | null;
          seq?: number | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          agent_id?: string | null;
          assignee_kind?: string;
          completed_at?: string | null;
          created_at?: string;
          depends_on?: Json;
          detail?: string | null;
          due_date?: string | null;
          estimate_hours?: number | null;
          id?: string;
          is_deep_work?: boolean;
          prd_id?: string | null;
          priority?: string;
          product_id?: string | null;
          project_id?: string | null;
          risk?: string | null;
          seq?: number | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      themes: {
        Row: {
          confidence: number;
          created_at: string;
          frequency: number;
          id: string;
          product_id: string | null;
          project_id: string | null;
          severity: number;
          status: string;
          summary: string;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          frequency?: number;
          id?: string;
          product_id?: string | null;
          project_id?: string | null;
          severity?: number;
          status?: string;
          summary?: string;
          title: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          frequency?: number;
          id?: string;
          product_id?: string | null;
          project_id?: string | null;
          severity?: number;
          status?: string;
          summary?: string;
          title?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "themes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "themes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      tool_calls: {
        Row: {
          agent_id: string | null;
          args: Json;
          created_at: string;
          error: string | null;
          event_id: string | null;
          id: string;
          latency_ms: number;
          ok: boolean;
          result: Json | null;
          tool_name: string;
          trace_id: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          agent_id?: string | null;
          args?: Json;
          created_at?: string;
          error?: string | null;
          event_id?: string | null;
          id?: string;
          latency_ms?: number;
          ok?: boolean;
          result?: Json | null;
          tool_name: string;
          trace_id?: string | null;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          agent_id?: string | null;
          args?: Json;
          created_at?: string;
          error?: string | null;
          event_id?: string | null;
          id?: string;
          latency_ms?: number;
          ok?: boolean;
          result?: Json | null;
          tool_name?: string;
          trace_id?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tool_calls_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_api_keys: {
        Row: {
          api_key_cipher: string | null;
          api_key_iv: string | null;
          api_key_prefix: string | null;
          base_url: string | null;
          created_at: string;
          id: string;
          key_version: number | null;
          label: string | null;
          provider: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          api_key_cipher?: string | null;
          api_key_iv?: string | null;
          api_key_prefix?: string | null;
          base_url?: string | null;
          created_at?: string;
          id?: string;
          key_version?: number | null;
          label?: string | null;
          provider: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          api_key_cipher?: string | null;
          api_key_iv?: string | null;
          api_key_prefix?: string | null;
          base_url?: string | null;
          created_at?: string;
          id?: string;
          key_version?: number | null;
          label?: string | null;
          provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_calendar_connections: {
        Row: {
          account_email: string | null;
          connection_id: string;
          created_at: string;
          display_name: string | null;
          id: string;
          last_sync_at: string | null;
          provider: Database["public"]["Enums"]["calendar_provider"];
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          account_email?: string | null;
          connection_id: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_sync_at?: string | null;
          provider: Database["public"]["Enums"]["calendar_provider"];
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          account_email?: string | null;
          connection_id?: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_sync_at?: string | null;
          provider?: Database["public"]["Enums"]["calendar_provider"];
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      user_integrations: {
        Row: {
          account_label: string | null;
          created_at: string;
          id: string;
          last_synced_at: string | null;
          metadata: Json;
          provider: string;
          scopes: string[];
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_label?: string | null;
          created_at?: string;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          provider: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_label?: string | null;
          created_at?: string;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          provider?: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_notification_preferences: {
        Row: {
          digest_approvals: boolean;
          digest_budget: boolean;
          digest_drift: boolean;
          digest_frequency: string;
          digest_health: boolean;
          email_approvals: boolean;
          email_budget: boolean;
          email_drift: boolean;
          email_health: boolean;
          in_app_approvals: boolean;
          in_app_budget: boolean;
          in_app_drift: boolean;
          in_app_health: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          digest_approvals?: boolean;
          digest_budget?: boolean;
          digest_drift?: boolean;
          digest_frequency?: string;
          digest_health?: boolean;
          email_approvals?: boolean;
          email_budget?: boolean;
          email_drift?: boolean;
          email_health?: boolean;
          in_app_approvals?: boolean;
          in_app_budget?: boolean;
          in_app_drift?: boolean;
          in_app_health?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          digest_approvals?: boolean;
          digest_budget?: boolean;
          digest_drift?: boolean;
          digest_frequency?: string;
          digest_health?: boolean;
          email_approvals?: boolean;
          email_budget?: boolean;
          email_drift?: boolean;
          email_health?: boolean;
          in_app_approvals?: boolean;
          in_app_budget?: boolean;
          in_app_drift?: boolean;
          in_app_health?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      voucher_redemptions: {
        Row: {
          id: string;
          meta: Json;
          redeemed_at: string;
          user_id: string;
          voucher_id: string;
          workspace_id: string | null;
        };
        Insert: {
          id?: string;
          meta?: Json;
          redeemed_at?: string;
          user_id: string;
          voucher_id: string;
          workspace_id?: string | null;
        };
        Update: {
          id?: string;
          meta?: Json;
          redeemed_at?: string;
          user_id?: string;
          voucher_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          },
        ];
      };
      vouchers: {
        Row: {
          active: boolean;
          auto_login: boolean;
          campaign_tag: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          credits: number | null;
          expires_at: string | null;
          id: string;
          kind: string;
          max_redemptions: number | null;
          plan_tier: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          auto_login?: boolean;
          campaign_tag?: string | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          credits?: number | null;
          expires_at?: string | null;
          id?: string;
          kind: string;
          max_redemptions?: number | null;
          plan_tier?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          auto_login?: boolean;
          campaign_tag?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          credits?: number | null;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          max_redemptions?: number | null;
          plan_tier?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vouchers_plan_tier_fkey";
            columns: ["plan_tier"];
            isOneToOne: false;
            referencedRelation: "pricing_plans";
            referencedColumns: ["tier"];
          },
        ];
      };
      workspace_audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          detail: Json;
          id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          id?: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_audit_log_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_billing_secrets: {
        Row: {
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_billing_secrets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_briefs: {
        Row: {
          anti_goals: string;
          created_at: string;
          current_focus: string;
          id: string;
          last_researcher_tick_at: string | null;
          mission: string;
          notes: string;
          target_user: string;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          anti_goals?: string;
          created_at?: string;
          current_focus?: string;
          id?: string;
          last_researcher_tick_at?: string | null;
          mission?: string;
          notes?: string;
          target_user?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id: string;
        };
        Update: {
          anti_goals?: string;
          created_at?: string;
          current_focus?: string;
          id?: string;
          last_researcher_tick_at?: string | null;
          mission?: string;
          notes?: string;
          target_user?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_briefs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          token: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          token?: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          token?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          account_id: string;
          auto_cluster_enabled: boolean;
          auto_sense_enabled: boolean;
          auto_trigger_enabled: boolean;
          created_at: string;
          deleted_at: string | null;
          id: string;
          last_auto_cluster_at: string | null;
          last_auto_sense_at: string | null;
          last_auto_trigger_at: string | null;
          name: string;
          owner_id: string;
          plan_tier: string;
          plan_updated_at: string | null;
          slug: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          auto_cluster_enabled?: boolean;
          auto_sense_enabled?: boolean;
          auto_trigger_enabled?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          last_auto_cluster_at?: string | null;
          last_auto_sense_at?: string | null;
          last_auto_trigger_at?: string | null;
          name: string;
          owner_id: string;
          plan_tier?: string;
          plan_updated_at?: string | null;
          slug?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          auto_cluster_enabled?: boolean;
          auto_sense_enabled?: boolean;
          auto_trigger_enabled?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          last_auto_cluster_at?: string | null;
          last_auto_sense_at?: string | null;
          last_auto_trigger_at?: string | null;
          name?: string;
          owner_id?: string;
          plan_tier?: string;
          plan_updated_at?: string | null;
          slug?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      mv_agent_cost_per_decision: {
        Row: {
          agent_slug: string | null;
          cost_per_decision_usd: number | null;
          cost_usd_30d: number | null;
          decisions_30d: number | null;
          tokens_30d: number | null;
          workspace_id: string | null;
        };
        Relationships: [];
      };
      mv_decision_velocity: {
        Row: {
          decisions_made: number | null;
          decisions_shipped: number | null;
          decisions_superseded: number | null;
          week: string | null;
          workspace_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "decisions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mv_supersession_rate: {
        Row: {
          agent_slug: string | null;
          decisions_superseded: number | null;
          decisions_total: number | null;
          supersession_rate_pct: number | null;
          workspace_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "decisions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _ensure_account_credits: {
        Args: { _account_id: string };
        Returns: undefined;
      };
      _erasure_delete_by_column: {
        Args: { _col: string; _id: string };
        Returns: Json;
      };
      accept_workspace_invitation: { Args: { _token: string }; Returns: string };
      admin_add_admin_by_email: { Args: { _email: string }; Returns: string };
      admin_add_workspace_member: {
        Args: { _role: string; _uid: string; _wid: string };
        Returns: undefined;
      };
      admin_audit: {
        Args: {
          _action: string;
          _payload?: Json;
          _target_id: string;
          _target_kind: string;
        };
        Returns: string;
      };
      admin_bootstrap_self_as_admin: { Args: never; Returns: boolean };
      admin_bulk_create_invitations: { Args: { _rows: Json }; Returns: number };
      admin_change_member_role: {
        Args: { _role: string; _uid: string; _wid: string };
        Returns: undefined;
      };
      admin_clear_banner: { Args: never; Returns: undefined };
      admin_clear_user_plan_override: {
        Args: { _uid: string };
        Returns: undefined;
      };
      admin_create_invitation: {
        Args: {
          _email: string;
          _expires_days?: number;
          _role: string;
          _workspace_id: string;
        };
        Returns: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          state: string;
          token: string;
          workspace_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_voucher: {
        Args: {
          _auto_login: boolean;
          _campaign_tag: string;
          _code: string;
          _credits: number;
          _expires_at: string;
          _kind: string;
          _max_redemptions: number;
          _plan_tier: string;
        };
        Returns: {
          active: boolean;
          auto_login: boolean;
          campaign_tag: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          credits: number | null;
          expires_at: string | null;
          id: string;
          kind: string;
          max_redemptions: number | null;
          plan_tier: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "vouchers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_deactivate_voucher: { Args: { _id: string }; Returns: undefined };
      admin_delete_auto_approve_domain: {
        Args: { _id: string };
        Returns: undefined;
      };
      admin_delete_bundle: { Args: { _id: string }; Returns: boolean };
      admin_delete_flag: { Args: { _id: string }; Returns: undefined };
      admin_delete_plan: { Args: { _tier: string }; Returns: undefined };
      admin_delete_topup_bundle: { Args: { _id: string }; Returns: boolean };
      admin_get_user_detail: { Args: { _uid: string }; Returns: Json };
      admin_get_workspace_detail: { Args: { _wid: string }; Returns: Json };
      admin_grant_credits: {
        Args: { _credits: number; _reason?: string; _user_id: string };
        Returns: Json;
      };
      admin_grant_user_credits: {
        Args: { _delta: number; _reason: string; _uid: string };
        Returns: number;
      };
      admin_list_admins: {
        Args: never;
        Returns: {
          created_at: string;
          email: string;
          user_id: string;
        }[];
      };
      admin_list_audit_log: {
        Args: {
          _lim?: number;
          _off?: number;
          _target_id: string;
          _target_kind: string;
        };
        Returns: {
          action: string;
          actor_email: string;
          actor_user_id: string;
          created_at: string;
          id: string;
          payload: Json;
          target_id: string;
          target_kind: string;
        }[];
      };
      admin_list_auto_approve_domains: {
        Args: never;
        Returns: {
          created_at: string;
          created_by: string | null;
          default_role: string;
          domain: string;
          id: string;
          workspace_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "auto_approve_domains";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_list_flags: {
        Args: never;
        Returns: {
          enabled: boolean;
          id: string;
          key: string;
          payload: Json;
          updated_at: string;
          updated_by: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "feature_flags";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_list_invitations: {
        Args: { _lim?: number; _off?: number; _state?: string };
        Returns: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          state: string;
          token: string;
          workspace_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "invitations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_list_signup_approvals: {
        Args: { _lim?: number; _off?: number; _state?: string };
        Returns: {
          created_at: string;
          email: string;
          id: string;
          note: string | null;
          requested_workspace_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          state: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "signup_approvals";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_list_users: {
        Args: { _limit?: number; _search?: string };
        Returns: {
          balance_credits: number;
          created_at: string;
          email: string;
          is_admin: boolean;
          plan_tier: string;
          primary_account_id: string;
          topup_credits: number;
          user_id: string;
        }[];
      };
      admin_list_voucher_redemptions: {
        Args: { _voucher_id: string };
        Returns: {
          id: string;
          meta: Json;
          redeemed_at: string;
          user_email: string;
          user_id: string;
          workspace_id: string;
        }[];
      };
      admin_list_vouchers: {
        Args: { _active?: boolean; _lim?: number; _off?: number };
        Returns: {
          active: boolean;
          auto_login: boolean;
          campaign_tag: string;
          code: string;
          created_at: string;
          credits: number;
          expires_at: string;
          id: string;
          kind: string;
          max_redemptions: number;
          plan_tier: string;
          redemptions_count: number;
        }[];
      };
      admin_override_user_plan: {
        Args: {
          _expires_at: string;
          _reason: string;
          _tier: string;
          _uid: string;
        };
        Returns: undefined;
      };
      admin_remove_admin: { Args: { _user_id: string }; Returns: boolean };
      admin_remove_workspace_member: {
        Args: { _uid: string; _wid: string };
        Returns: undefined;
      };
      admin_reset_user_credit_cycle: {
        Args: { _uid: string };
        Returns: undefined;
      };
      admin_restore_workspace: { Args: { _wid: string }; Returns: undefined };
      admin_review_signup_approval: {
        Args: { _approve: boolean; _id: string; _note: string };
        Returns: undefined;
      };
      admin_revoke_invitation: { Args: { _id: string }; Returns: undefined };
      admin_search_users: {
        Args: { _lim?: number; _off?: number; _q: string };
        Returns: {
          balance_credits: number;
          created_at: string;
          display_name: string;
          email: string;
          plan_tier: string;
          suspended: boolean;
          user_id: string;
        }[];
      };
      admin_search_workspaces: {
        Args: { _lim?: number; _off?: number; _q: string };
        Returns: {
          balance_credits: number;
          created_at: string;
          deleted_at: string;
          id: string;
          member_count: number;
          name: string;
          owner_email: string;
          owner_id: string;
          plan_tier: string;
          slug: string;
        }[];
      };
      admin_set_banner: {
        Args: {
          _active: boolean;
          _expires_at: string;
          _level: string;
          _message: string;
        };
        Returns: {
          active: boolean;
          expires_at: string | null;
          id: string;
          level: string;
          message: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "system_banner";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_set_bundle_active: {
        Args: { _active: boolean; _id: string };
        Returns: boolean;
      };
      admin_set_credits_enabled: {
        Args: { _enabled: boolean };
        Returns: boolean;
      };
      admin_set_interop_write_enabled: {
        Args: { _enabled: boolean };
        Returns: boolean;
      };
      admin_set_observability_enabled: {
        Args: { _enabled: boolean };
        Returns: boolean;
      };
      admin_set_user_suspended: {
        Args: { _reason: string; _suspend: boolean; _uid: string };
        Returns: undefined;
      };
      admin_soft_delete_workspace: {
        Args: { _wid: string };
        Returns: undefined;
      };
      admin_transfer_workspace_ownership: {
        Args: { _new_owner: string; _wid: string };
        Returns: undefined;
      };
      admin_update_voucher: {
        Args: {
          _active: boolean;
          _auto_login: boolean;
          _campaign_tag: string;
          _credits: number;
          _expires_at: string;
          _id: string;
          _max_redemptions: number;
          _plan_tier: string;
        };
        Returns: {
          active: boolean;
          auto_login: boolean;
          campaign_tag: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          credits: number | null;
          expires_at: string | null;
          id: string;
          kind: string;
          max_redemptions: number | null;
          plan_tier: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "vouchers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_upsert_auto_approve_domain: {
        Args: { _domain: string; _role: string; _workspace_id: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          default_role: string;
          domain: string;
          id: string;
          workspace_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "auto_approve_domains";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_upsert_bundle: {
        Args: {
          _active: boolean;
          _credits: number;
          _id: string;
          _monthly_cents: number;
          _recommended: boolean;
          _sort_order: number;
          _stripe_price_id_monthly: string;
          _stripe_price_id_yearly: string;
          _tier: string;
          _yearly_cents: number;
        };
        Returns: string;
      };
      admin_upsert_flag: {
        Args: { _enabled: boolean; _key: string; _payload: Json };
        Returns: {
          enabled: boolean;
          id: string;
          key: string;
          payload: Json;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "feature_flags";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_upsert_plan: {
        Args: {
          _active?: boolean;
          _audience?: string;
          _display_name: string;
          _recommended?: boolean;
          _sort_order?: number;
          _tagline?: string;
          _tier: string;
        };
        Returns: string;
      };
      admin_upsert_topup_bundle:
        | {
            Args: {
              _active: boolean;
              _credits: number;
              _id: string;
              _price_cents: number;
              _sort_order: number;
            };
            Returns: string;
          }
        | {
            Args: {
              _active: boolean;
              _credits: number;
              _id: string;
              _price_cents: number;
              _sort_order: number;
              _stripe_price_id: string;
            };
            Returns: string;
          };
      apply_topup_credits: {
        Args: {
          _account_id: string;
          _amount_cents: number;
          _credits: number;
          _currency: string;
          _env: string;
          _lookup_key: string;
          _payment_intent_id: string;
          _session_id: string;
          _user_id: string;
        };
        Returns: Json;
      };
      auto_advance_agent_arc: {
        Args: { p_agent_id: string; p_user_id: string };
        Returns: string;
      };
      backfill_account_credits: { Args: never; Returns: Json };
      can_manage_account: { Args: { account: string }; Returns: boolean };
      can_manage_workspace: { Args: { ws: string }; Returns: boolean };
      check_mission_caps: {
        Args: {
          _projected_cost_usd: number;
          _projected_tokens: number;
          _run_id: string;
        };
        Returns: string;
      };
      create_workspace_invitation: {
        Args: { _email: string; _role?: string; _workspace_id: string };
        Returns: {
          id: string;
          token: string;
        }[];
      };
      credits_enabled: { Args: never; Returns: boolean };
      cron_tick_admin_expiries: { Args: never; Returns: Json };
      current_kill_state: {
        Args: { ws: string };
        Returns: {
          reason: string;
          system_paused: boolean;
          workspace_paused: boolean;
        }[];
      };
      current_user_default_workspace: { Args: never; Returns: string };
      data_retention_enabled: { Args: never; Returns: boolean };
      debit_account_credits: {
        Args: {
          _account_id: string;
          _ai_event_id: string;
          _credits: number;
          _product_id: string;
          _surface: string;
          _user_id: string;
        };
        Returns: undefined;
      };
      ensure_user_default_account: {
        Args: { _user_id: string };
        Returns: string;
      };
      ensure_user_default_workspace: {
        Args: { _user_id: string };
        Returns: string;
      };
      erasure_residue: { Args: { _workspace_id: string }; Returns: Json };
      forget_account: { Args: { _account_id: string }; Returns: Json };
      forget_workspace: { Args: { _workspace_id: string }; Returns: Json };
      get_active_banner: {
        Args: never;
        Returns: {
          expires_at: string;
          id: string;
          level: string;
          message: string;
        }[];
      };
      get_cron_hook_secret: { Args: never; Returns: string };
      get_flag: {
        Args: { _key: string };
        Returns: {
          enabled: boolean;
          payload: Json;
        }[];
      };
      get_invitation_by_token: {
        Args: { _token: string };
        Returns: {
          email: string;
          expires_at: string;
          id: string;
          role: string;
          state: string;
          workspace_id: string;
        }[];
      };
      grant_subscription_credits: {
        Args: { _account_id: string; _credits: number };
        Returns: Json;
      };
      halt_agent_run: {
        Args: { _reason: string; _run_id: string };
        Returns: undefined;
      };
      has_account_role: {
        Args: { account: string; required_roles: string[] };
        Returns: boolean;
      };
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_workspace_role: {
        Args: { required_roles: string[]; ws: string };
        Returns: boolean;
      };
      interop_write_enabled: { Args: never; Returns: boolean };
      is_account_member: { Args: { account: string }; Returns: boolean };
      is_account_owner: { Args: { account: string }; Returns: boolean };
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      is_workspace_owner: { Args: { ws: string }; Returns: boolean };
      issue_mcp_token: {
        Args: {
          _rate_limit_per_min?: number;
          _scopes?: string[];
          _secret_hash: string;
          _slug: string;
          _user_id: string;
          _workspace_id: string;
        };
        Returns: {
          created_at: string | null;
          id: string;
          last_used_at: string | null;
          metadata: Json | null;
          rate_limit_per_min: number | null;
          revoked_at: string | null;
          scopes: string[];
          secret_hash: string;
          slug: string;
          user_id: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "mcp_tokens";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      limit_gates_enabled: { Args: never; Returns: boolean };
      log_api_call: {
        Args: {
          _cost_usd: number;
          _error_message?: string;
          _input_tokens: number;
          _metadata?: Json;
          _output_tokens: number;
          _result: string;
          _token_id: string;
          _tool_name: string;
          _workspace_id: string;
        };
        Returns: {
          cost_usd: number | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          input_tokens: number | null;
          metadata: Json | null;
          output_tokens: number | null;
          result: string;
          token_id: string;
          tool_name: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "api_calls";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      match_agent_memory: {
        Args: {
          for_account?: string;
          for_agent_slug?: string;
          for_user: string;
          for_workspace?: string;
          match_count?: number;
          query_embedding: string;
        };
        Returns: {
          agent_slug: string;
          content: string;
          id: string;
          importance: number;
          kind: string;
          similarity: number;
        }[];
      };
      match_rag_chunks: {
        Args: {
          for_product?: string;
          for_user: string;
          match_count?: number;
          query_embedding: string;
          source_kinds?: string[];
        };
        Returns: {
          chunk_index: number;
          content: string;
          id: string;
          metadata: Json;
          similarity: number;
          source_id: string;
          source_kind: string;
          title: string;
        }[];
      };
      match_signals: {
        Args: {
          for_product?: string;
          for_user?: string;
          match_count?: number;
          query_embedding: string;
        };
        Returns: {
          content: string;
          id: string;
          similarity: number;
          title: string;
        }[];
      };
      memory_expiry_enabled: { Args: never; Returns: boolean };
      move_product: {
        Args: { _dest_workspace_id: string; _product_id: string };
        Returns: undefined;
      };
      next_ready_mission_steps: {
        Args: { p_mission_id: string };
        Returns: {
          agent_slug: string;
          attempts: number;
          completed_at: string | null;
          created_at: string;
          depends_on: number[];
          dispatched_at: string | null;
          error: string | null;
          id: string;
          idx: number;
          max_attempts: number;
          message_id: string | null;
          mission_id: string;
          next_retry_at: string | null;
          rationale: string | null;
          result: Json | null;
          run_id: string | null;
          status: string;
          sub_goal: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "mission_steps";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      observability_enabled: { Args: never; Returns: boolean };
      publish_announcement: {
        Args: { _announcement_id: string; _workspace_id: string };
        Returns: undefined;
      };
      purge_old_telemetry: {
        Args: { _older_than_days?: number };
        Returns: Json;
      };
      recent_agent_reflections: {
        Args: {
          for_account?: string;
          for_agent_slug: string;
          for_user: string;
          for_workspace?: string;
          match_count?: number;
        };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          importance: number;
          metadata: Json;
        }[];
      };
      record_mission_usage: {
        Args: { _cost_usd: number; _run_id: string; _tokens: number };
        Returns: undefined;
      };
      redeem_voucher: { Args: { _code: string }; Returns: Json };
      refresh_observability_mvs: { Args: never; Returns: undefined };
      reset_subscription_cycle: { Args: { _account_id: string }; Returns: Json };
      revoke_mcp_token: { Args: { _token_id: string }; Returns: undefined };
      right_to_erasure_enabled: { Args: never; Returns: boolean };
      seed_default_agent_tools: {
        Args: { _user_id: string };
        Returns: undefined;
      };
      seed_default_agents: { Args: { _user_id: string }; Returns: undefined };
      seed_default_event_subscriptions: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      seed_default_guardrails: {
        Args: { _user_id: string };
        Returns: undefined;
      };
      seed_default_prompt_templates: {
        Args: { _user_id: string };
        Returns: undefined;
      };
      seed_demo_workspace: { Args: { _user_id: string }; Returns: string };
      seed_orchestrator_agent: { Args: { p_user_id: string }; Returns: string };
      seed_pm_lifecycle_tools: {
        Args: { _user_id: string };
        Returns: undefined;
      };
      seed_studio_tools: { Args: { _user_id: string }; Returns: undefined };
      tier_product_limit: { Args: { _tier: string }; Returns: number };
      tier_seat_limit: { Args: { _tier: string }; Returns: number };
      tier_workspace_limit: { Args: { _tier: string }; Returns: number };
      transfer_workspace_ownership: {
        Args: { _new_owner_id: string; _workspace_id: string };
        Returns: undefined;
      };
      workspace_members_with_identity: {
        Args: { _workspace_id: string };
        Returns: {
          created_at: string;
          display_name: string;
          email: string;
          role: string;
          user_id: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "member";
      calendar_provider: "google" | "microsoft";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
      calendar_provider: ["google", "microsoft"],
    },
  },
} as const;
