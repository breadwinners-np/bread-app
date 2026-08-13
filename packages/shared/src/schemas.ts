/**
 * Zod schemas for everything that crosses a boundary.
 *
 * Both apps validate with these same schemas, so the mobile app and the admin
 * app can never disagree about what a valid order looks like.
 */

import { z } from "zod";

import { isValidIsoDate } from "./dates";

/**
 * A real calendar day, not merely something shaped like one. The pattern alone
 * accepts `2026-13-45` and `2026-02-31`, which then flow into date arithmetic
 * as Invalid Dates.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD")
  .refine(isValidIsoDate, "That day does not exist");

/** Reused everywhere a person types a Ghanaian number, in either form. */
export const phoneNumber = z
  .string()
  .trim()
  .min(9, "Enter a phone number")
  .regex(/^[0-9+\s-]+$/, "Phone number can only contain digits, +, spaces, or -");

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name"),
  phone: phoneNumber,
  type: z.enum(["business", "individual"]),
  area: z.string().trim().min(1, "Enter the delivery area"),
  address: z.string().trim().max(280, "Keep the address shorter").optional(),
  email: z.email("Enter a working email address").optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

/**
 * A customer opening an account on the storefront.
 *
 * They give the same details the owner would write in her book, plus a PIN.
 * `type` is asked outright rather than assumed: a business buying for a shop
 * and a person buying for a household are treated differently by the rest of
 * the system, and guessing "individual" for everyone was wrong for exactly the
 * customers who matter most.
 *
 * The PIN is four digits, kept as a string so a leading zero survives.
 */
export const customerSignUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  phone: phoneNumber,
  type: z.enum(["business", "individual"]),
  area: z.string().trim().min(1, "Which area are you in?"),
  address: z
    .string()
    .trim()
    .min(1, "Where do you live? House, street or a landmark is fine")
    .max(280, "Keep the address shorter"),
  email: z.email("Enter a working email address").optional().or(z.literal("")),
  pin: z.string().regex(/^\d{4}$/, "Choose a 4-digit PIN"),
});

export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>;

export const customerSignInSchema = z.object({
  phone: phoneNumber,
  pin: z.string().regex(/^\d{4}$/, "Your PIN is 4 digits"),
});

export type CustomerSignInInput = z.infer<typeof customerSignInSchema>;

export const orderLineInputSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be more than zero"),
});

/**
 * An order the owner writes down from a phone call.
 *
 * `lines` rather than one product, because a customer who rings up asking for
 * butter bread and brown bread is one order (decision 0026) — the same as a
 * basket placed online. The same bread twice is refused rather than silently
 * added up, since it is nearly always a mis-click.
 */
export const orderInputSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  deliveryDate: isoDate,
  lines: z
    .array(orderLineInputSchema)
    .min(1, "Add at least one bread")
    .refine(
      (lines) => new Set(lines.map((line) => line.productId)).size === lines.length,
      "That bread is on this order twice — change the number instead",
    ),
  deliveryAddress: z.string().trim().max(280).optional(),
});

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

export type OrderInput = z.infer<typeof orderInputSchema>;

/**
 * One line of a customer's basket.
 *
 * Only the product and the quantity travel from the device. The price and the
 * bread's name are never taken from the client — the server looks them up
 * fresh and snapshots them onto the order, so a tampered cart cannot buy bread
 * below its real price.
 */
export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

/**
 * A customer checking out. Who they are comes from their signed-in session,
 * never from the form — so nobody can place an order in somebody else's name.
 */
export const checkoutInputSchema = z.object({
  deliveryDate: isoDate,
  /**
   * Where this basket goes. Defaulted to the customer's own address in the UI
   * but always sent explicitly, because bread is often taken somewhere else.
   */
  deliveryAddress: z
    .string()
    .trim()
    .min(1, "Tell us where to bring it")
    .max(280, "Keep the address shorter"),
  deliveryNote: z
    .string()
    .trim()
    .max(280, "Keep the note under 280 characters")
    .optional(),
  paymentMethod: z.enum(["card", "mobile_money"]),
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const recordDeliverySchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["delivered", "partial", "not_delivered"]),
  /**
   * How many of each bread arrived, keyed by order line id. Only read for a
   * part delivery — a full delivery is the whole order and a failed one is
   * nothing, so neither takes a number from the form (see
   * `resolveDeliveredLines`).
   */
  deliveredByLine: z
    .record(
      z.string(),
      z.coerce
        .number()
        .int("How many arrived must be a whole number")
        .min(0, "That cannot be less than none"),
    )
    .default({}),
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

/**
 * Chosen instead of a supply id when the owner types in something the list
 * does not have. The list was fixed — flour, yeast, butter, sugar, gas — and a
 * bakery buys things nobody thought of, so a purchase she cannot record is a
 * cost missing from her reports. Answers INV-2; see decision 0028.
 */
export const NEW_SUPPLY_ITEM = "new";

export const purchaseInputSchema = z
  .object({
    /** An existing supply's id, or NEW_SUPPLY_ITEM when she typed one in. */
    itemId: z.string().min(1, "Choose what you bought"),
    newItemName: z
      .string()
      .trim()
      .max(60, "Keep the name short")
      .optional(),
    newItemCategory: z.enum(["gas", "ingredients", "transport"]).optional(),
    date: isoDate,
    quantity: z.coerce.number().positive("Enter how much you bought"),
    unit: z.enum(["piece", "kg", "g", "litre", "sack", "box", "crate"]),
    /** Entered in cedis per unit, converted to pesewas before storage. */
    unitPriceCedis: z.coerce.number().positive("Enter the price for one unit"),
    supplier: z.string().trim().optional(),
    note: z.string().trim().optional(),
  })
  .refine(
    (input) => input.itemId !== NEW_SUPPLY_ITEM || Boolean(input.newItemName),
    { message: "Type what you bought", path: ["newItemName"] },
  )
  .refine(
    (input) => input.itemId !== NEW_SUPPLY_ITEM || Boolean(input.newItemCategory),
    { message: "Say which kind of cost this is", path: ["newItemCategory"] },
  );

export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const costInputSchema = z.object({
  date: isoDate,
  category: z.enum(["gas", "ingredients", "transport"]),
  amountCedis: z.coerce.number().positive("Enter an amount above zero"),
  note: z.string().trim().optional(),
});

export type CostInput = z.infer<typeof costInputSchema>;
