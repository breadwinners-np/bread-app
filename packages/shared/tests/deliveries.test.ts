/**
 * Tests for the rule that decides how much of an order actually arrived.
 *
 * These used to live in the admin app and drive the delivery service against
 * its in-memory store. The rule itself never needed a database — it needs the
 * order, which the caller looks up — so it now lives in this package and is
 * tested without one. The mobile app will record deliveries too, and it has to
 * reach the same answer.
 *
 * Server actions are reachable by direct POST, so every field in a submission
 * is attacker-controlled — including the quantities the form helpfully sends
 * along. A schema cannot catch that. This is where it is caught.
 *
 * Since decision 0026 an order can carry several breads, so the answer is a
 * number per bread rather than one for the order.
 */

import { describe, expect, it } from "vitest";

import { resolveDeliveredLines } from "../src/orders";
import type { Order } from "../src/types";

const ORDER: Order = {
  id: "ord-1",
  customerId: "cus-1",
  deliveryDate: "2026-07-20",
  status: "scheduled",
  source: "admin",
  createdAt: "2026-07-19T08:00:00.000Z",
  lines: [
    {
      id: "line-butter",
      productId: "prd-1",
      productName: "Butter bread",
      quantity: 10,
      unitPricePesewas: 1800,
      deliveredQuantity: 0,
    },
    {
      id: "line-brown",
      productId: "prd-2",
      productName: "Brown bread",
      quantity: 5,
      unitPricePesewas: 1400,
      deliveredQuantity: 0,
    },
  ],
};

/** The quantities alone, for readability in the expectations below. */
function quantities(order: Order, status: "delivered" | "partial" | "not_delivered", requested: Record<string, number> = {}) {
  return resolveDeliveredLines(status, requested, order).map((line) => line.quantity);
}

describe("how much of an order arrived", () => {
  it("RULE: a part delivery is taken bread by bread, as given", () => {
    expect(quantities(ORDER, "partial", { "line-butter": 8, "line-brown": 5 })).toEqual([8, 5]);
  });

  it("RULE: a bread nobody mentions is a bread that did not arrive", () => {
    expect(quantities(ORDER, "partial", { "line-butter": 8 })).toEqual([8, 0]);
  });

  /**
   * REGRESSION: the old single-total version accepted this and stored it. It
   * could not corrupt a balance, because the value stopped once the order's
   * lines ran out, but it wrote a number into the record that nothing should
   * have trusted.
   */
  it("RULE: no bread can arrive in greater number than was ordered", () => {
    expect(() => resolveDeliveredLines("partial", { "line-butter": 11 }, ORDER)).toThrow(
      /Only 10 Butter bread were ordered/,
    );
    expect(() => resolveDeliveredLines("partial", { "line-brown": 9999 }, ORDER)).toThrow();
  });

  it("RULE: a part delivery of nothing is refused, not silently recorded", () => {
    expect(() => resolveDeliveredLines("partial", {}, ORDER)).toThrow(/at least one/);
    expect(() =>
      resolveDeliveredLines("partial", { "line-butter": 0, "line-brown": 0 }, ORDER),
    ).toThrow(/at least one/);
  });

  it("RULE: a fractional or negative amount is refused", () => {
    expect(() => resolveDeliveredLines("partial", { "line-butter": 2.5 }, ORDER)).toThrow(
      /whole number/,
    );
    expect(() => resolveDeliveredLines("partial", { "line-butter": -5 }, ORDER)).toThrow(
      /whole number/,
    );
  });

  it("RULE: a full delivery takes its quantities from the order, not the caller", () => {
    // A direct POST claiming wildly different numbers.
    expect(quantities(ORDER, "delivered", { "line-butter": 9999, "line-brown": 0 })).toEqual([
      10, 5,
    ]);
    expect(quantities(ORDER, "delivered")).toEqual([10, 5]);
  });

  it("RULE: a failed delivery is always nothing, whatever was submitted", () => {
    expect(quantities(ORDER, "not_delivered", { "line-butter": 500 })).toEqual([0, 0]);
  });

  it("RULE: quantities come back tied to the bread they belong to", () => {
    expect(resolveDeliveredLines("partial", { "line-brown": 3 }, ORDER)).toEqual([
      { orderLineId: "line-butter", quantity: 0 },
      { orderLineId: "line-brown", quantity: 3 },
    ]);
  });

  /**
   * A line id the order does not have is ignored rather than trusted. Reading
   * the submission for line ids instead of the order would let a direct POST
   * record bread against somebody else's order.
   */
  it("RULE: a line id the order does not have is ignored", () => {
    expect(
      resolveDeliveredLines("partial", { "line-butter": 4, "someone-elses-line": 99 }, ORDER),
    ).toEqual([
      { orderLineId: "line-butter", quantity: 4 },
      { orderLineId: "line-brown", quantity: 0 },
    ]);
  });
});
