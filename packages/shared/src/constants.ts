/**
 * Display labels and option lists.
 *
 * Wording matters here: the primary admin user is not technical, so these are
 * the words she would use, not accounting or database terminology.
 */

import type { OutstandingReason } from "./orders";
import type {
  CostCategory,
  CustomerType,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
} from "./types";

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  business: "Business",
  individual: "Individual",
};

export const CUSTOMER_TYPE_OPTIONS: readonly CustomerType[] = [
  "business",
  "individual",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  scheduled: "Scheduled",
  delivered: "Delivered",
  partially_delivered: "Part delivered",
  cancelled: "Cancelled",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Not yet delivered",
  delivered: "Delivered",
  partial: "Part delivered",
  not_delivered: "Could not deliver",
};

export const OUTSTANDING_REASON_LABELS: Record<OutstandingReason, string> = {
  failed: "Could not deliver",
  overdue: "Never recorded",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  mobile_money: "Mobile money",
};

export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethod[] = [
  "cash",
  "cheque",
  "mobile_money",
];

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  gas: "Gas and fuel",
  ingredients: "Ingredients",
  transport: "Transport",
};

export const COST_CATEGORY_OPTIONS: readonly CostCategory[] = [
  "gas",
  "ingredients",
  "transport",
];
