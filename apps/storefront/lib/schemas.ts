import { z } from "zod";

/**
 * Only productId and quantity travel from the client. Price and product name
 * are never taken from the browser — placeOrder in app/actions.ts looks them
 * up fresh from the database, so a tampered cart cannot buy bread below its
 * real price.
 */
export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const checkoutInputSchema = z.object({
  customerName: z.string().trim().min(1, "Enter your name"),
  customerPhone: z
    .string()
    .trim()
    .min(9, "Enter a phone number")
    .regex(/^[0-9+\s-]+$/, "Phone number can only contain digits, +, spaces, or -"),
  /** Where to bring it. Becomes the customer's delivery area on their record. */
  deliveryArea: z.string().trim().min(1, "Tell us where to deliver"),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a delivery day"),
  deliveryNote: z.string().trim().max(280, "Keep the note under 280 characters").optional(),
  paymentMethod: z.enum(["card", "mobile_money"]),
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
