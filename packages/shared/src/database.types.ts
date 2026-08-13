/**
 * Database row types.
 *
 * HAND-WRITTEN FOR NOW, which is not how this file is meant to exist. CLAUDE.md
 * says never hand-edit it and regenerate after every schema change:
 *
 *   supabase gen types typescript --local > packages/shared/src/database.types.ts
 *
 * That needs either a local Supabase in Docker or a linked project and an access
 * token, neither of which is set up yet. Until it is, this file mirrors
 * supabase/migrations by hand and must be regenerated — not patched — the moment
 * the CLI is wired up.
 *
 * Everything that reads the database derives its row types from here, so a
 * renamed column is one compile error rather than a scattering of runtime
 * `undefined`s that render as "Unknown customer" or NaN.
 */

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          phone_normalised: string;
          type: "business" | "individual";
          area: string;
          notes: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          unit: string;
          price_pesewas: number;
          active: boolean;
          created_at: string;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string | null;
          delivery_date: string;
          source: "admin" | "app";
          cancelled_at: string | null;
          rescheduled_from: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          delivery_note: string | null;
          payment_method: "card" | "mobile_money" | "cash" | "cheque" | null;
          payment_status: "pending" | "paid" | "failed" | null;
          payment_reference: string | null;
          total_pesewas: number | null;
          created_at: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          unit_price_pesewas: number;
          quantity: number;
          created_at: string;
        };
      };
      deliveries: {
        Row: {
          id: string;
          order_id: string;
          status: "pending" | "delivered" | "partial" | "not_delivered";
          delivered_quantity: number;
          delivered_at: string | null;
          note: string | null;
        };
      };
      payments: {
        Row: {
          id: string;
          customer_id: string;
          order_id: string | null;
          amount_pesewas: number;
          method: "cash" | "cheque" | "mobile_money" | "card";
          reference: string | null;
          note: string | null;
          source: "admin" | "app";
          recorded_at: string;
          confirmed_at: string | null;
          rejected_at: string | null;
        };
      };
      supply_items: {
        Row: {
          id: string;
          name: string;
          default_unit: "piece" | "kg" | "g" | "litre" | "sack" | "box" | "crate";
          category: "gas" | "ingredients" | "transport";
          active: boolean;
        };
      };
      purchases: {
        Row: {
          id: string;
          item_id: string;
          date: string;
          quantity: number;
          unit: "piece" | "kg" | "g" | "litre" | "sack" | "box" | "crate";
          unit_price_pesewas: number;
          supplier: string | null;
          note: string | null;
          recorded_at: string;
        };
      };
      costs: {
        Row: {
          id: string;
          date: string;
          category: "gas" | "ingredients" | "transport";
          amount_pesewas: number;
          note: string | null;
        };
      };
    };
  };
}

type Tables = Database["public"]["Tables"];

export type CustomerRow = Tables["customers"]["Row"];
export type ProductRow = Tables["products"]["Row"];
export type OrderRow = Tables["orders"]["Row"];
export type OrderItemRow = Tables["order_items"]["Row"];
export type DeliveryRow = Tables["deliveries"]["Row"];
export type PaymentRow = Tables["payments"]["Row"];
export type SupplyItemRow = Tables["supply_items"]["Row"];
export type PurchaseRow = Tables["purchases"]["Row"];
export type CostRow = Tables["costs"]["Row"];
