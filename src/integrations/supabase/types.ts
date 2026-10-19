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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_audit_logs: {
        Row: {
          action: string
          client_id: string | null
          created_at: string
          id: string
          message: string | null
          status: string | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          status?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          status?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blast_analyses: {
        Row: {
          client_id: string
          created_at: string
          created_by_user_id: string | null
          date_end: string
          date_start: string
          id: string
          message_phrase: string
          needs_review_count: number
          negative_count: number
          neutral_count: number
          opt_out_count: number
          positive_count: number
          reply_tag: string
          summary: string | null
          total_replied_contacts: number
          updated_at: string
          workflow_name_or_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by_user_id?: string | null
          date_end: string
          date_start: string
          id?: string
          message_phrase: string
          needs_review_count?: number
          negative_count?: number
          neutral_count?: number
          opt_out_count?: number
          positive_count?: number
          reply_tag: string
          summary?: string | null
          total_replied_contacts?: number
          updated_at?: string
          workflow_name_or_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by_user_id?: string | null
          date_end?: string
          date_start?: string
          id?: string
          message_phrase?: string
          needs_review_count?: number
          negative_count?: number
          neutral_count?: number
          opt_out_count?: number
          positive_count?: number
          reply_tag?: string
          summary?: string | null
          total_replied_contacts?: number
          updated_at?: string
          workflow_name_or_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blast_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      blast_reply_classifications: {
        Row: {
          analysis_method: string | null
          blast_analysis_id: string
          classification: string
          confidence: number | null
          contact_id: string | null
          contact_name: string | null
          conversation_id: string | null
          created_at: string
          evidence_message_ids: string | null
          id: string
          review_status: string
          summary: string | null
        }
        Insert: {
          analysis_method?: string | null
          blast_analysis_id: string
          classification: string
          confidence?: number | null
          contact_id?: string | null
          contact_name?: string | null
          conversation_id?: string | null
          created_at?: string
          evidence_message_ids?: string | null
          id?: string
          review_status?: string
          summary?: string | null
        }
        Update: {
          analysis_method?: string | null
          blast_analysis_id?: string
          classification?: string
          confidence?: number | null
          contact_id?: string | null
          contact_name?: string | null
          conversation_id?: string | null
          created_at?: string
          evidence_message_ids?: string | null
          id?: string
          review_status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blast_reply_classifications_blast_analysis_id_fkey"
            columns: ["blast_analysis_id"]
            isOneToOne: false
            referencedRelation: "blast_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active_pipeline_id: string | null
          active_pipeline_name: string | null
          clickup_task_id: string | null
          created_at: string
          created_by_user_id: string | null
          form_lead_tag: string
          ghl_location_id: string
          ghl_private_integration_token_encrypted: string | null
          ghl_private_integration_token_preview: string | null
          id: string
          name: string
          reply_stage_id: string | null
          reply_stage_name: string | null
          reply_stage_window_hours: number
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active_pipeline_id?: string | null
          active_pipeline_name?: string | null
          clickup_task_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          form_lead_tag?: string
          ghl_location_id: string
          ghl_private_integration_token_encrypted?: string | null
          ghl_private_integration_token_preview?: string | null
          id?: string
          name: string
          reply_stage_id?: string | null
          reply_stage_name?: string | null
          reply_stage_window_hours?: number
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_pipeline_id?: string | null
          active_pipeline_name?: string | null
          clickup_task_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          form_lead_tag?: string
          ghl_location_id?: string
          ghl_private_integration_token_encrypted?: string | null
          ghl_private_integration_token_preview?: string | null
          id?: string
          name?: string
          reply_stage_id?: string | null
          reply_stage_name?: string | null
          reply_stage_window_hours?: number
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_check_evidence: {
        Row: {
          created_at: string
          evidence_type: string
          id: string
          monthly_check_id: string
          raw_reference: string | null
          source: string | null
          summary: string | null
        }
        Insert: {
          created_at?: string
          evidence_type: string
          id?: string
          monthly_check_id: string
          raw_reference?: string | null
          source?: string | null
          summary?: string | null
        }
        Update: {
          created_at?: string
          evidence_type?: string
          id?: string
          monthly_check_id?: string
          raw_reference?: string | null
          source?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_check_evidence_monthly_check_id_fkey"
            columns: ["monthly_check_id"]
            isOneToOne: false
            referencedRelation: "monthly_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_checks: {
        Row: {
          attribution_intact: string | null
          automations_firing: string | null
          blast_summary_id: string | null
          calls_answered: number
          calls_missed: number
          clickup_comment_id: string | null
          client_id: string
          created_at: string
          created_by_user_id: string | null
          date_end: string
          date_start: string
          generated_comment: string | null
          id: string
          issues: string | null
          leads_received: number
          next_month_focus: string | null
          posted_to_clickup: boolean
          routing_working: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attribution_intact?: string | null
          automations_firing?: string | null
          blast_summary_id?: string | null
          calls_answered?: number
          calls_missed?: number
          clickup_comment_id?: string | null
          client_id: string
          created_at?: string
          created_by_user_id?: string | null
          date_end: string
          date_start: string
          generated_comment?: string | null
          id?: string
          issues?: string | null
          leads_received?: number
          next_month_focus?: string | null
          posted_to_clickup?: boolean
          routing_working?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attribution_intact?: string | null
          automations_firing?: string | null
          blast_summary_id?: string | null
          calls_answered?: number
          calls_missed?: number
          clickup_comment_id?: string | null
          client_id?: string
          created_at?: string
          created_by_user_id?: string | null
          date_end?: string
          date_start?: string
          generated_comment?: string | null
          id?: string
          issues?: string | null
          leads_received?: number
          next_month_focus?: string | null
          posted_to_clickup?: boolean
          routing_working?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_checks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_setups: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          expected_delay_minutes: number
          expected_phrase: string
          id: string
          staff_contact_id: string | null
          staff_phone_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          expected_delay_minutes?: number
          expected_phrase?: string
          id?: string
          staff_contact_id?: string | null
          staff_phone_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          expected_delay_minutes?: number
          expected_phrase?: string
          id?: string
          staff_contact_id?: string | null
          staff_phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_setups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
