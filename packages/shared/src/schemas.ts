/**
 * Zod schemas for everything that crosses a boundary.
 *
 * Both apps validate with these same schemas, so the mobile app and the admin
 * app can never disagree about what a valid order looks like.
 */

import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD");

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name"),
  phone: z
    .string()
    .trim()
    .min(9, "Enter a phone number")
    .regex(/^[0-9+\s-]+$/, "Phone number can only contain digits, +, spaces, or -"),
  type: z.enum(["business", "individual"]),
  area: z.string().trim().min(1, "Enter the delivery area"),
  notes: z.string().trim().optional(),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const orderInputSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  deliveryDate: isoDate,
  productId: z.string().min(1, "Choose a product"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be more than zero"),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const recordDeliverySchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["delivered", "partial", "not_delivered"]),
  deliveredQuantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative"),
  note: z.string().trim().optional(),
});

export type RecordDeliveryInput = z.infer<typeof recordDeliverySchema>;

export const rescheduleDeliverySchema = z.object({
  orderId: z.string().min(1),
  newDate: isoDate,
});

export type RescheduleDeliveryInput = z.infer<typeof rescheduleDeliverySchema>;

export const paymentInputSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  /**
   * The order this payment settles. Left empty for a lump sum on the account,
   * such as a monthly cheque covering many days of bread.
   */
  orderId: z.string().trim().optional(),
  /** Entered by the user in cedis, converted to pesewas before storage. */
  amountCedis: z.coerce.number().positive("Enter an amount above zero"),
  method: z.enum(["cash", "cheque", "mobile_money"]),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/**
 * A customer reporting from their phone that they have paid.
 *
 * NOT BUILT YET — the buyer app does not exist. This schema is here so that
 * when it does, the phone and the laptop validate the same shape with the same
 * code. It deliberately has no `confirmedAt`: a customer cannot confirm their
 * own payment, only report it (decision 0013).
 */
export const paymentClaimSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().trim().optional(),
  amountCedis: z.coerce.number().positive("Enter an amount above zero"),
  method: z.enum(["cash", "cheque", "mobile_money"]),
  reference: z.string().trim().optional(),
});

export type PaymentClaimInput = z.infer<typeof paymentClaimSchema>;

/** The owner ruling on a payment a customer reported. */
export const paymentDecisionSchema = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(["confirm", "reject"]),
});

export type PaymentDecisionInput = z.infer<typeof paymentDecisionSchema>;

export const reportRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((range) => range.from <= range.to, {
    message: "The first day must come before the last day",
    path: ["to"],
  });

export type ReportRangeInput = z.infer<typeof reportRangeSchema>;

export const purchaseInputSchema = z.object({
  itemId: z.string().min(1, "Choose what you bought"),
  date: isoDate,
  quantity: z.coerce.number().positive("Enter how much you bought"),
  unit: z.enum(["piece", "kg", "g", "litre", "sack", "box", "crate"]),
  /** Entered in cedis per unit, converted to pesewas before storage. */
  unitPriceCedis: z.coerce.number().positive("Enter the price for one unit"),
  supplier: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const costInputSchema = z.object({
  date: isoDate,
  category: z.enum(["gas", "ingredients", "transport"]),
  amountCedis: z.coerce.number().positive("Enter an amount above zero"),
  note: z.string().trim().optional(),
});

export type CostInput = z.infer<typeof costInputSchema>;
