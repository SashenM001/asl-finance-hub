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
      audit_scores: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          max_score: number | null
          period_month: string
          quarter: string | null
          remarks: string | null
          score: number | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          max_score?: number | null
          period_month: string
          quarter?: string | null
          remarks?: string | null
          score?: number | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          max_score?: number | null
          period_month?: string
          quarter?: string | null
          remarks?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_scores_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_actual: {
        Row: {
          actual: number
          budget: number
          category: string
          created_at: string
          entity_id: string
          function_code: Database["public"]["Enums"]["function_code"] | null
          id: string
          period_month: string
        }
        Insert: {
          actual?: number
          budget?: number
          category: string
          created_at?: string
          entity_id: string
          function_code?: Database["public"]["Enums"]["function_code"] | null
          id?: string
          period_month: string
        }
        Update: {
          actual?: number
          budget?: number
          category?: string
          created_at?: string
          entity_id?: string
          function_code?: Database["public"]["Enums"]["function_code"] | null
          id?: string
          period_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_actual_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_breakdown: {
        Row: {
          amount: number
          created_at: string
          entity_id: string
          function_code: Database["public"]["Enums"]["function_code"]
          id: string
          period_month: string
        }
        Insert: {
          amount?: number
          created_at?: string
          entity_id: string
          function_code: Database["public"]["Enums"]["function_code"]
          id?: string
          period_month: string
        }
        Update: {
          amount?: number
          created_at?: string
          entity_id?: string
          function_code?: Database["public"]["Enums"]["function_code"]
          id?: string
          period_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_breakdown_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      monthly_metrics: {
        Row: {
          ap_ranking: number | null
          assets: number | null
          bank_balance: number | null
          created_at: string
          entity_id: string
          equity: number | null
          finance_health_index: number | null
          finance_od_score: number | null
          global_ranking: number | null
          gpm: number | null
          id: string
          inflow: number | null
          liabilities: number | null
          liquidity: number | null
          npm: number | null
          outflow: number | null
          period_month: string
          petty_cash: number | null
          receivables: number | null
          reserves: number | null
          term: string | null
          total_cost: number | null
          total_revenue: number | null
        }
        Insert: {
          ap_ranking?: number | null
          assets?: number | null
          bank_balance?: number | null
          created_at?: string
          entity_id: string
          equity?: number | null
          finance_health_index?: number | null
          finance_od_score?: number | null
          global_ranking?: number | null
          gpm?: number | null
          id?: string
          inflow?: number | null
          liabilities?: number | null
          liquidity?: number | null
          npm?: number | null
          outflow?: number | null
          period_month: string
          petty_cash?: number | null
          receivables?: number | null
          reserves?: number | null
          term?: string | null
          total_cost?: number | null
          total_revenue?: number | null
        }
        Update: {
          ap_ranking?: number | null
          assets?: number | null
          bank_balance?: number | null
          created_at?: string
          entity_id?: string
          equity?: number | null
          finance_health_index?: number | null
          finance_od_score?: number | null
          global_ranking?: number | null
          gpm?: number | null
          id?: string
          inflow?: number | null
          liabilities?: number | null
          liquidity?: number | null
          npm?: number | null
          outflow?: number | null
          period_month?: string
          petty_cash?: number | null
          receivables?: number | null
          reserves?: number | null
          term?: string | null
          total_cost?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_metrics_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_review: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          period_month: string
          remarks: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          period_month: string
          remarks?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          period_month?: string
          remarks?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_review_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          entity_id: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          entity_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          entity_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_streams: {
        Row: {
          amount: number
          created_at: string
          entity_id: string
          function_code: Database["public"]["Enums"]["function_code"]
          id: string
          period_month: string
        }
        Insert: {
          amount?: number
          created_at?: string
          entity_id: string
          function_code: Database["public"]["Enums"]["function_code"]
          id?: string
          period_month: string
        }
        Update: {
          amount?: number
          created_at?: string
          entity_id?: string
          function_code?: Database["public"]["Enums"]["function_code"]
          id?: string
          period_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_streams_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
      can_read_entity: {
        Args: { _entity_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_entity: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "lc_user" | "mc_user" | "efb_user"
      function_code:
        | "iGV"
        | "iGT"
        | "oGV"
        | "oGT"
        | "ELD"
        | "EwA"
        | "BD"
        | "iGTa"
        | "iGTe"
        | "oGTa"
        | "oGTe"
        | "Conference"
        | "NMF"
        | "Miscellaneous"
        | "National Conference Delegation"
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
    Enums: {
      app_role: ["lc_user", "mc_user", "efb_user"],
      function_code: [
        "iGV",
        "iGT",
        "oGV",
        "oGT",
        "ELD",
        "EwA",
        "BD",
        "iGTa",
        "iGTe",
        "oGTa",
        "oGTe",
        "Conference",
        "NMF",
        "Miscellaneous",
        "National Conference Delegation",
      ],
    },
  },
} as const
