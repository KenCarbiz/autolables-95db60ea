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
          content_hash: string | null
          created_at: string
          created_by: string | null
          customer_ip: string | null
          customer_name: string | null
          customer_signature_data: string | null
          customer_signature_type: string | null
          customer_signed_at: string | null
          delivery_mileage: number | null
          employee_name: string | null
          employee_signature_data: string | null
          employee_signature_type: string | null
          employee_signed_at: string | null
          esign_consent: Json | null
          id: string
          initials: Json | null
          listing_slug: string | null
          optional_selections: Json | null
          products_snapshot: Json
          signing_location: Json | null
          signing_token: string | null
          status: string
          sticker_match_ack: boolean | null
          total_installed: number | null
          total_with_optional: number | null
          updated_at: string
          user_agent: string | null
          vehicle_stock: string | null
          vehicle_vin: string | null
          vehicle_ymm: string | null
          warranty_ack: boolean | null
        }
        Insert: {
          addendum_date?: string | null
          cobuyer_name?: string | null
          cobuyer_signature_data?: string | null
          cobuyer_signature_type?: string | null
          cobuyer_signed_at?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          customer_ip?: string | null
          customer_name?: string | null
          customer_signature_data?: string | null
          customer_signature_type?: string | null
          customer_signed_at?: string | null
          delivery_mileage?: number | null
          employee_name?: string | null
          employee_signature_data?: string | null
          employee_signature_type?: string | null
          employee_signed_at?: string | null
          esign_consent?: Json | null
          id?: string
          initials?: Json | null
          listing_slug?: string | null
          optional_selections?: Json | null
          products_snapshot?: Json
          signing_location?: Json | null
          signing_token?: string | null
          status?: string
          sticker_match_ack?: boolean | null
          total_installed?: number | null
          total_with_optional?: number | null
          updated_at?: string
          user_agent?: string | null
          vehicle_stock?: string | null
          vehicle_vin?: string | null
          vehicle_ymm?: string | null
          warranty_ack?: boolean | null
        }
        Update: {
          addendum_date?: string | null
          cobuyer_name?: string | null
          cobuyer_signature_data?: string | null
          cobuyer_signature_type?: string | null
          cobuyer_signed_at?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          customer_ip?: string | null
          customer_name?: string | null
          customer_signature_data?: string | null
          customer_signature_type?: string | null
          customer_signed_at?: string | null
          delivery_mileage?: number | null
          employee_name?: string | null
          employee_signature_data?: string | null
          employee_signature_type?: string | null
          employee_signed_at?: string | null
          esign_consent?: Json | null
          id?: string
          initials?: Json | null
          listing_slug?: string | null
          optional_selections?: Json | null
          products_snapshot?: Json
          signing_location?: Json | null
          signing_token?: string | null
          status?: string
          sticker_match_ack?: boolean | null
          total_installed?: number | null
          total_with_optional?: number | null
          updated_at?: string
          user_agent?: string | null
          vehicle_stock?: string | null
          vehicle_vin?: string | null
          vehicle_ymm?: string | null
          warranty_ack?: boolean | null
        }
        Relationships: []
      }
      app_entitlements: {
        Row: {
          activated_at: string
          app_slug: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          plan_tier: string
          renewed_at: string | null
          seat_limit: number | null
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          app_slug: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan_tier?: string
          renewed_at?: string | null
          seat_limit?: number | null
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          app_slug?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan_tier?: string
          renewed_at?: string | null
          seat_limit?: number | null
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          content_hash: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          store_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          content_hash?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          store_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          content_hash?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          store_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
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
      handoff_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          intent: string
          payload: Json
          source_app: string
          target_app: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          intent?: string
          payload?: Json
          source_app: string
          target_app: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intent?: string
          payload?: Json
          source_app?: string
          target_app?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoff_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_profiles: {
        Row: {
          billing: Json
          completed_at: string | null
          created_at: string
          display_name: string | null
          last_synced_at: string | null
          lead_preferences: Json
          logo_url: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          source: string
          stores: Json
          tagline: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          billing?: Json
          completed_at?: string | null
          created_at?: string
          display_name?: string | null
          last_synced_at?: string | null
          lead_preferences?: Json
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          source?: string
          stores?: Json
          tagline?: string | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing?: Json
          completed_at?: string | null
          created_at?: string
          display_name?: string | null
          last_synced_at?: string | null
          lead_preferences?: Json
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          source?: string
          stores?: Json
          tagline?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      prep_sign_offs: {
        Row: {
          accessories_installed: Json
          created_at: string
          created_by: string | null
          foreman_ip: string | null
          foreman_name: string
          foreman_signature_data: string | null
          get_ready_record_id: string | null
          id: string
          inspection_form_type: string | null
          inspection_passed: boolean
          install_photos: Json
          listing_unlocked: boolean
          notes: string | null
          rejection_reason: string | null
          signed_at: string | null
          status: string
          stock_number: string | null
          store_id: string
          updated_at: string
          vin: string
          ymm: string | null
        }
        Insert: {
          accessories_installed?: Json
          created_at?: string
          created_by?: string | null
          foreman_ip?: string | null
          foreman_name: string
          foreman_signature_data?: string | null
          get_ready_record_id?: string | null
          id?: string
          inspection_form_type?: string | null
          inspection_passed?: boolean
          install_photos?: Json
          listing_unlocked?: boolean
          notes?: string | null
          rejection_reason?: string | null
          signed_at?: string | null
          status?: string
          stock_number?: string | null
          store_id: string
          updated_at?: string
          vin: string
          ymm?: string | null
        }
        Update: {
          accessories_installed?: Json
          created_at?: string
          created_by?: string | null
          foreman_ip?: string | null
          foreman_name?: string
          foreman_signature_data?: string | null
          get_ready_record_id?: string | null
          id?: string
          inspection_form_type?: string | null
          inspection_passed?: boolean
          install_photos?: Json
          listing_unlocked?: boolean
          notes?: string | null
          rejection_reason?: string | null
          signed_at?: string | null
          status?: string
          stock_number?: string | null
          store_id?: string
          updated_at?: string
          vin?: string
          ymm?: string | null
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
      tenant_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          role: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          autocurb_tenant_id: string | null
          billing_email: string | null
          created_at: string
          domain: string | null
          id: string
          is_active: boolean
          name: string
          primary_email: string | null
          slug: string
          source: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          autocurb_tenant_id?: string | null
          billing_email?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          name: string
          primary_email?: string | null
          slug: string
          source?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          autocurb_tenant_id?: string | null
          billing_email?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          primary_email?: string | null
          slug?: string
          source?: string
          stripe_customer_id?: string | null
          updated_at?: string
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
      vehicle_listings: {
        Row: {
          condition: string | null
          created_at: string
          created_by: string | null
          dealer_snapshot: Json
          documents: Json
          id: string
          mileage: number | null
          prep_status: Json | null
          price: number | null
          published_at: string | null
          slug: string
          status: string
          sticker_snapshot: Json
          store_id: string
          trim: string | null
          updated_at: string
          value_props: Json
          videos: Json
          view_count: number
          vin: string
          ymm: string | null
        }
        Insert: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          dealer_snapshot?: Json
          documents?: Json
          id?: string
          mileage?: number | null
          prep_status?: Json | null
          price?: number | null
          published_at?: string | null
          slug: string
          status?: string
          sticker_snapshot?: Json
          store_id: string
          trim?: string | null
          updated_at?: string
          value_props?: Json
          videos?: Json
          view_count?: number
          vin: string
          ymm?: string | null
        }
        Update: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          dealer_snapshot?: Json
          documents?: Json
          id?: string
          mileage?: number | null
          prep_status?: Json | null
          price?: number | null
          published_at?: string | null
          slug?: string
          status?: string
          sticker_snapshot?: Json
          store_id?: string
          trim?: string | null
          updated_at?: string
          value_props?: Json
          videos?: Json
          view_count?: number
          vin?: string
          ymm?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_tenant: {
        Args: {
          _app_slug?: string
          _name: string
          _plan_tier?: string
          _slug: string
          _source?: string
        }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      get_addendum_by_token: {
        Args: { _token: string }
        Returns: {
          addendum_date: string | null
          cobuyer_name: string | null
          cobuyer_signature_data: string | null
          cobuyer_signature_type: string | null
          cobuyer_signed_at: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          customer_ip: string | null
          customer_name: string | null
          customer_signature_data: string | null
          customer_signature_type: string | null
          customer_signed_at: string | null
          delivery_mileage: number | null
          employee_name: string | null
          employee_signature_data: string | null
          employee_signature_type: string | null
          employee_signed_at: string | null
          esign_consent: Json | null
          id: string
          initials: Json | null
          listing_slug: string | null
          optional_selections: Json | null
          products_snapshot: Json
          signing_location: Json | null
          signing_token: string | null
          status: string
          sticker_match_ack: boolean | null
          total_installed: number | null
          total_with_optional: number | null
          updated_at: string
          user_agent: string | null
          vehicle_stock: string | null
          vehicle_vin: string | null
          vehicle_ymm: string | null
          warranty_ack: boolean | null
        }[]
        SetofOptions: {
          from: "*"
          to: "addendums"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_vehicle_listing_by_slug: {
        Args: { _slug: string }
        Returns: {
          condition: string | null
          created_at: string
          created_by: string | null
          dealer_snapshot: Json
          documents: Json
          id: string
          mileage: number | null
          prep_status: Json | null
          price: number | null
          published_at: string | null
          slug: string
          status: string
          sticker_snapshot: Json
          store_id: string
          trim: string | null
          updated_at: string
          value_props: Json
          videos: Json
          view_count: number
          vin: string
          ymm: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vehicle_listings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_app_access: { Args: { _app_slug: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_listing_view: { Args: { _slug: string }; Returns: undefined }
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
