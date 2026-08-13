/**
 * Tests for the rule that decides how much of an order actually arrived.
 *
 * These used to live in the admin app and drive the delivery service against
 * its in-memory store. The rule itself never needed a database — it needs the
 * ordered quantity, which the caller looks up — so it now lives in this package
 * and is tested without one. The mobile app will record deliveries too, and it
 * has to reach the same answer.
 *
 * Server actions are reachable by direct POST, so every field in a submission
 * is attacker-controlled — including the ordered quantity the form helpfully
 * sends along. A schema cannot catch that. This is where it is caught.
 */

import { describe, expect, it } from "vitest";

import { resolveDeliveredQuantity } from "../src/orders";

const ORDERED = 10;

describe("how much of an order arrived", () => {
  it("RULE: a part delivery is taken as given, when it fits the order", () => {
    expect(resolveDeliveredQuantity("partial", ORDERED - 1, ORDERED)).toBe(ORDERED - 1);
  });

  /**
   * REGRESSION: this was accepted and stored. It could not corrupt a balance,
   * because deliveredValuePesewas stops once the order's lines run out, but it
   * wrote a number into the record that nothing should have trusted.
   */
  it("RULE: a part delivery cannot exceed what was ordered", () => {
    expect(() => resolveDeliveredQuantity("partial", ORDERED + 1, ORDERED)).toThrow(
      /were ordered/,
    );
    expect(() => resolveDeliveredQuantity("partial", 9999, ORDERED)).toThrow();
  });

  it("RULE: a part delivery of nothing is refused, not silently recorded", () => {
    expect(() => resolveDeliveredQuantity("partial", 0, ORDERED)).toThrow(/at least one/);
    expect(() => resolveDeliveredQuantity("partial", -5, ORDERED)).toThrow(/at least one/);
  });

  it("RULE: a full delivery takes its quantity from the order, not the caller", () => {
    // A direct POST claiming a wildly different number.
    expect(resolveDeliveredQuantity("delivered", 9999, ORDERED)).toBe(ORDERED);
    expect(resolveDeliveredQuantity("delivered", 0, ORDERED)).toBe(ORDERED);
  });

  it("RULE: a failed delivery is always zero, whatever was submitted", () => {
    expect(resolveDeliveredQuantity("not_delivered", 500, ORDERED)).toBe(0);
  });
});
