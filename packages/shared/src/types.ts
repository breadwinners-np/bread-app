/**
 * Domain types shared by the admin and mobile apps.
 *
 * Money is always integer pesewas (decision 0004). Dates that represent a
 * calendar day are ISO `YYYY-MM-DD` strings; timestamps are ISO 8601 UTC.
 */

export type CustomerType = "business" | "individual";

export type OrderStatus =
  | "scheduled"
  | "delivered"
  | "partially_delivered"
  | "cancelled";

export type DeliveryStatus =
  | "pending"
  | "delivered"
  | "partial"
  | "not_delivered";

export type PaymentMethod = "cash" | "cheque" | "mobile_money";

export type CostCategory = "gas" | "ingredients" | "transport";

/** Where an order came from. Phone and text orders are entered by the owner. */
export type OrderSource = "admin" | "app";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  /** Delivery area or address, as the owner would describe it. */
  area: string;
  notes?: string;
  /** Customers are archived, never deleted, so history survives. */
  archivedAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  /** e.g. "loaf" — what one unit of quantity means. */
  unit: string;
  pricePesewas: number;
  active: boolean;
}

export interface OrderLine {
  id: string;
  productId: string;
  quantity: number;
  /**
   * The price that applied when the order was placed. Snapshotted so that
   * changing a product's price never rewrites the value of a past order.
   */
  unitPricePesewas: number;
}

export interface Order {
  id: string;
  customerId: string;
  /** The day the bread is due, ISO `YYYY-MM-DD`. */
  deliveryDate: string;
  status: OrderStatus;
  source: OrderSource;
  lines: OrderLine[];
  createdAt: string;
  /**
   * Set when a delivery was moved to a later day, holding the date it was
   * originally due. Moving the order keeps one order equal to one obligation,
   * so a rescheduled drop is never billed twice.
   *
   * OPEN: whether rescheduling should instead preserve each attempt as its own
   * record is undecided — see the open questions in DECISIONS.md.
   */
  rescheduledFrom?: string | null;
}

export interface Delivery {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  /** What actually arrived, which may differ from what was ordered. */
  deliveredQuantity: number;
  deliveredAt?: string | null;
  note?: string;
}

export interface Payment {
  id: string;
  customerId: string;
  amountPesewas: number;
  method: PaymentMethod;
  reference?: string;
  recordedAt: string;
}

export interface Cost {
  id: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  category: CostCategory;
  amountPesewas: number;
  note?: string;
}

/**
 * A wholesale customer's agreed quantity for a month.
 *
 * OPEN QUESTION (ORD-3): how a monthly total becomes daily deliveries is not
 * decided — an even split across the month, or a per-day quantity the customer
 * states. This type deliberately records only the commitment itself, not the
 * schedule, until that rule is answered. See the open questions in DECISIONS.md.
 */
export interface MonthlyCommitment {
  id: string;
  customerId: string;
  /** ISO `YYYY-MM`. */
  month: string;
  productId: string;
  totalQuantity: number;
  unitPricePesewas: number;
  confirmedByCustomer: boolean;
}

/** A delivery joined to everything the owner needs to see it in context. */
export interface DeliveryListItem {
  order: Order;
  customer: Customer;
  delivery: Delivery;
  productName: string;
  orderedQuantity: number;
}
