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
      addendums: {
        Row: {
          addendum_date: string | null
          cobuyer_name: string | null
          cobuyer_signature_data: string | null
          cobuyer_signature_type: string | null
          cobuyer_signed_at: string | null
          created_at: string
          created_by: string | null
          customer_ip: string | null
          customer_name: string | null
          customer_signature_data: string | null
          customer_signature_type: string | null
          customer_signed_at: string | null
          employee_name: string | null
          employee_signature_data: string | null
          employee_signature_type: string | null
          employee_signed_at: string | null
          id: string
          initials: Json | null
          optional_selections: Json | null
          products_snapshot: Json
          signing_token: string | null
          status: string
          total_installed: number | null
          total_with_optional: number | null
          updated_at: string
          vehicle_stock: string | null
          vehicle_vin: string | null
          vehicle_ymm: string | null
        }
        Insert: {
          addendum_date?: string | null
          cobuyer_name?: string | null
          cobuyer_signature_data?: string | null
          cobuyer_signature_type?: string | null
          cobuyer_signed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_ip?: string | null
          customer_name?: string | null
          customer_signature_data?: string | null
          customer_signature_type?: string | null
          customer_signed_at?: string | null
          employee_name?: string | null
          employee_signature_data?: string | null
          employee_signature_type?: string | null
          employee_signed_at?: string | null
          id?: string
          initials?: Json | null
          optional_selections?: Json | null
          products_snapshot?: Json
          signing_token?: string | null
          status?: string
          total_installed?: number | null
          total_with_optional?: number | null
          updated_at?: string
          vehicle_stock?: string | null
          vehicle_vin?: string | null
          vehicle_ymm?: string | null
        }
        Update: {
          addendum_date?: string | null
          cobuyer_name?: string | null
          cobuyer_signature_data?: string | null
          cobuyer_signature_type?: string | null
          cobuyer_signed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_ip?: string | null
          customer_name?: string | null
          customer_signature_data?: string | null
          customer_signature_type?: string | null
          customer_signed_at?: string | null
          employee_name?: string | null
          employee_signature_data?: string | null
          employee_signature_type?: string | null
          employee_signed_at?: string | null
          id?: string
          initials?: Json | null
          optional_selections?: Json | null
          products_snapshot?: Json
          signing_token?: string | null
          status?: string
          total_installed?: number | null
          total_with_optional?: number | null
          updated_at?: string
          vehicle_stock?: string | null
          vehicle_vin?: string | null
          vehicle_ymm?: string | null
        }
        Relationships: []
      }
      dealer_subscriptions: {
        Row: {
          active_product_slugs: string[]
          bundle_slug: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          dealer_id: string
          id: string
          plan_tier: string
          status: string
          updated_at: string
        }
        Insert: {
          active_product_slugs?: string[]
          bundle_slug?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          dealer_id: string
          id?: string
          plan_tier?: string
          status?: string
          updated_at?: string
        }
        Update: {
          active_product_slugs?: string[]
          bundle_slug?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          dealer_id?: string
          id?: string
          plan_tier?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          created_at: string
          dealership_name: string | null
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          dealership_name?: string | null
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          dealership_name?: string | null
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      platform_bundles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          included_product_slugs: string[]
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          included_product_slugs?: string[]
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          included_product_slugs?: string[]
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_products: {
        Row: {
          app_url: string | null
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          app_url?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          app_url?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          badge_type: string
          created_at: string
          disclosure: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          price_label: string | null
          sort_order: number
          subtitle: string | null
          updated_at: string
          warranty: string | null
        }
        Insert: {
          badge_type?: string
          created_at?: string
          disclosure?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          price_label?: string | null
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          badge_type?: string
          created_at?: string
          disclosure?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          price_label?: string | null
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
          warranty?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      get_addendum_by_token: {
        Args: { _token: string }
        Returns: {
          addendum_date: string | null
          cobuyer_name: string | null
          cobuyer_signature_data: string | null
          cobuyer_signature_type: string | null
          cobuyer_signed_at: string | null
          created_at: string
          created_by: string | null
          customer_ip: string | null
          customer_name: string | null
          customer_signature_data: string | null
          customer_signature_type: string | null
          customer_signed_at: string | null
          employee_name: string | null
          employee_signature_data: string | null
          employee_signature_type: string | null
          employee_signed_at: string | null
          id: string
          initials: Json | null
          optional_selections: Json | null
          products_snapshot: Json
          signing_token: string | null
          status: string
          total_installed: number | null
          total_with_optional: number | null
          updated_at: string
          vehicle_stock: string | null
          vehicle_vin: string | null
          vehicle_ymm: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "addendums"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      app_role: ["admin", "user"],
    },
  },
} as const
