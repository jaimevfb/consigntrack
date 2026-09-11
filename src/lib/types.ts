// Domain types for ConsignTrack. Hand-authored (rather than generated) so the
// project type-checks without a live database; shapes match the SQL in
// supabase/migrations. Run `supabase gen types typescript` for a full schema.

export type AppRole = "consignor" | "store_manager" | "store_staff" | "admin";
export type ConsignorType = "artisan" | "producer" | "manufacturer";
export type DeliveryStatus = "draft" | "sent" | "confirmed";
export type SettlementCadence = "weekly" | "monthly" | "quarterly";
export type SettlementStatus = "pending" | "paid" | "confirmed";
export type MovementType = "delivery" | "sale" | "return" | "adjustment";

export interface Consignor {
  id: string;
  name: string;
  contact: string | null;
  type: ConsignorType;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  location: string | null;
  manager: string | null;
  contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  auth_user_id: string;
  role: AppRole;
  consignor_id: string | null;
  store_id: string | null;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Agreement {
  id: string;
  consignor_id: string;
  store_id: string;
  commission_pct: number;
  settlement_cadence: SettlementCadence;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  consignor_id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  consignor_id: string;
  store_id: string;
  agreement_id: string | null;
  delivery_date: string;
  status: DeliveryStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
}

export interface StockLevel {
  id: string;
  store_id: string;
  product_id: string;
  consignor_id: string;
  qty_on_hand: number;
}

export interface Settlement {
  id: string;
  agreement_id: string;
  period_start: string;
  period_end: string;
  gross_sales: number;
  commission: number;
  returns_total: number;
  net_payable: number;
  status: SettlementStatus;
  created_at: string;
  updated_at: string;
}

export interface SettlementLine {
  id: string;
  settlement_id: string;
  product_id: string;
  qty_sold: number;
  gross: number;
}

export interface Payment {
  id: string;
  settlement_id: string;
  amount: number;
  paid_at: string | null;
  confirmed_at: string | null;
}

export interface Discrepancy {
  kind: "unexplained_shrinkage" | "level_mismatch";
  store_id: string;
  product_id: string;
  consignor_id: string;
  qty: number;
  detail: string;
  occurred_at: string;
}
