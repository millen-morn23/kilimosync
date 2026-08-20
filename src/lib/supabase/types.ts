/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 *
 * Once a Supabase project is linked, regenerate this file from the live
 * schema instead of editing it by hand:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

export type UserRole = "buyer" | "farmer" | "admin";
export type VerificationStatus = "pending" | "verified" | "rejected" | "suspended";
export type ProductStatus = "active" | "paused" | "sold_out" | "deleted";
export type PaymentStatus =
  | "PENDING"
  | "STK_SENT"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "DISPUTED";
export type DeliveryStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED";
export type DisputeStatus = "open" | "investigating" | "resolved" | "rejected";
export type NotificationType =
  | "order_placed"
  | "payment_successful"
  | "payment_failed"
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "order_out_for_delivery"
  | "order_delivered"
  | "new_order"
  | "low_stock"
  | "order_update"
  | "farmer_verified"
  | "farmer_rejected"
  | "new_farmer_signup"
  | "dispute_opened"
  | "dispute_resolved"
  | "system_warning";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          county: string | null;
          location: string | null;
          profile_image: string | null;
          is_suspended: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
        Relationships: [];
      };
      farmer_profiles: {
        Row: {
          id: string;
          user_id: string;
          farm_name: string;
          county: string;
          subcounty: string | null;
          location: string | null;
          farm_description: string | null;
          main_crops: string[];
          farm_image: string | null;
          verification_status: VerificationStatus;
          verified_at: string | null;
          verified_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["farmer_profiles"]["Row"]> & {
          user_id: string;
          farm_name: string;
          county: string;
        };
        Update: Partial<Database["public"]["Tables"]["farmer_profiles"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          farmer_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          price_unit: string;
          quantity_available: number;
          quantity_unit: string;
          min_order_quantity: number;
          images: string[];
          harvest_date: string | null;
          status: ProductStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          farmer_id: string;
          name: string;
          slug: string;
          price: number;
          price_unit: string;
          quantity_unit: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      carts: {
        Row: { id: string; buyer_id: string; created_at: string; updated_at: string };
        Insert: { id?: string; buyer_id: string };
        Update: Partial<Database["public"]["Tables"]["carts"]["Row"]>;
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; cart_id: string; product_id: string; quantity: number };
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Row"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          buyer_id: string;
          subtotal: number;
          delivery_fee: number;
          platform_fee: number;
          total_amount: number;
          payment_status: PaymentStatus;
          order_status: OrderStatus;
          delivery_county: string;
          delivery_address: string;
          delivery_notes: string | null;
          buyer_name: string;
          buyer_phone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          buyer_id: string;
          subtotal: number;
          total_amount: number;
          delivery_county: string;
          delivery_address: string;
          buyer_name: string;
          buyer_phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          farmer_id: string;
          product_name_snapshot: string;
          price_at_purchase: number;
          quantity: number;
          subtotal: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          farmer_id: string;
          product_name_snapshot: string;
          price_at_purchase: number;
          quantity: number;
          subtotal: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          buyer_id: string;
          amount: number;
          phone_number: string;
          status: PaymentStatus;
          merchant_request_id: string | null;
          checkout_request_id: string | null;
          mpesa_receipt_number: string | null;
          result_code: number | null;
          result_description: string | null;
          raw_callback: Record<string, unknown> | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          order_id: string;
          buyer_id: string;
          amount: number;
          phone_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      deliveries: {
        Row: {
          id: string;
          order_id: string;
          transporter_id: string | null;
          pickup_location: string;
          delivery_location: string;
          delivery_fee: number;
          status: DeliveryStatus;
          assigned_at: string | null;
          picked_up_at: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["deliveries"]["Row"]> & {
          order_id: string;
          pickup_location: string;
          delivery_location: string;
        };
        Update: Partial<Database["public"]["Tables"]["deliveries"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data: Record<string, unknown>;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          order_item_id: string;
          buyer_id: string;
          farmer_id: string;
          product_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reviews"]["Row"]> & {
          order_item_id: string;
          buyer_id: string;
          farmer_id: string;
          rating: number;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          reason: string;
          description: string;
          evidence: string[];
          status: DisputeStatus;
          admin_response: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["disputes"]["Row"]> & {
          order_id: string;
          user_id: string;
          reason: string;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["disputes"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: number;
          platform_fee_percent: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["platform_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      deduct_product_inventory: {
        Args: { p_product_id: string; p_quantity: number };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      verification_status: VerificationStatus;
      product_status: ProductStatus;
      payment_status: PaymentStatus;
      order_status: OrderStatus;
      delivery_status: DeliveryStatus;
      dispute_status: DisputeStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}
