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

/**
 * `card` only ever arrives through the payment gateway. The owner has no card
 * terminal, so it is deliberately absent from PAYMENT_METHOD_OPTIONS — she
 * cannot record one by hand, only receive one.
 */
export type PaymentMethod = "cash" | "cheque" | "mobile_money" | "card";

/**
 * Where a payment record came from. `admin` is the owner recording money she
 * has in hand; `app` is a customer reporting from their phone that they have
 * paid, which is a claim until she confirms it (decision 0013).
 */
export type PaymentSource = "admin" | "app";

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
  /**
   * Where the customer lives, in their own words — house, street, landmark.
   * This is their address, NOT where an order goes: an order carries its own
   * delivery address, because bread is often sent somewhere else.
   */
  address?: string;
  email?: string;
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
  /**
   * The bread's name as it was when the order was placed, snapshotted for the
   * same reason the price is: renaming or retiring a product must not rewrite
   * what a past order said.
   */
  productName: string;
  quantity: number;
  /**
   * The price that applied when the order was placed. Snapshotted so that
   * changing a product's price never rewrites the value of a past order.
   */
  unitPricePesewas: number;
  /**
   * How many of THIS bread actually arrived. Zero until the delivery is
   * recorded. An order can carry several breads, so a short drop has to say
   * which bread was short — one total across the order could not.
   */
  deliveredQuantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  /** The day the bread is due, ISO `YYYY-MM-DD`. */
  deliveryDate: string;
  status: OrderStatus;
  source: OrderSource;
  /**
   * Every bread on this order. One basket is one order (decision 0026), so a
   * customer who wants butter and brown bread appears once, with two lines.
   */
  lines: OrderLine[];
  /**
   * Where this order goes. Empty means the customer's own address — bread is
   * often sent to an office or a relative, so this is never assumed.
   */
  deliveryAddress?: string | null;
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
  /**
   * The order this payment was put against, when the owner tied it to one.
   * Left unset for a lump sum on the account — a monthly cheque covering many
   * days of bread — which is spread across unpaid orders oldest first.
   */
  orderId?: string | null;
  amountPesewas: number;
  method: PaymentMethod;
  /** Cheque number, mobile money reference, or whatever identifies it. */
  reference?: string;
  note?: string;
  source: PaymentSource;
  recordedAt: string;
  /**
   * When the owner confirmed the money arrived. She confirms her own entries as
   * she saves them; a payment reported from a customer's phone arrives null and
   * counts for nothing until she agrees.
   */
  confirmedAt?: string | null;
  /** Set when the owner says a reported payment never arrived. */
  rejectedAt?: string | null;
}

export interface Cost {
  id: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  category: CostCategory;
  amountPesewas: number;
  note?: string;
}

/** How a supply is measured when it is bought. */
export type UnitOfMeasure =
  | "piece"
  | "kg"
  | "g"
  | "litre"
  | "sack"
  | "box"
  | "crate";

/** Something the bakery buys: flour, yeast, butter, sugar, salt, gas. */
export interface SupplyItem {
  id: string;
  name: string;
  /** The unit this is normally bought in, pre-selected on the form. */
  defaultUnit: UnitOfMeasure;
  /** Which cost category this rolls up into for reporting. */
  category: CostCategory;
  active: boolean;
}

/**
 * A record of buying a supply on a given day, at a given price.
 *
 * This is purchase history, not stock on hand. Knowing what is left would mean
 * tracking consumption — how much flour went into each bake — which nobody
 * records today. See the open questions in DECISIONS.md.
 */
export interface Purchase {
  id: string;
  itemId: string;
  /** ISO `YYYY-MM-DD` — the day it was bought. */
  date: string;
  /** May be fractional, e.g. 2.5 kg. */
  quantity: number;
  unit: UnitOfMeasure;
  /** Price for one unit, in pesewas. */
  unitPricePesewas: number;
  supplier?: string;
  note?: string;
  recordedAt: string;
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

/**
 * A delivery joined to everything the owner needs to see it in context.
 *
 * The breads are read from `order.lines`, which carry their own snapshotted
 * names — so nothing here has to go looking in the product list to render a
 * drop.
 */
export interface DeliveryListItem {
  order: Order;
  customer: Customer;
  delivery: Delivery;
  /** Total loaves across every bread on the order. */
  orderedQuantity: number;
}
