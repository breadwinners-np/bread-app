/**
 * Tests for the delivery service.
 *
 * These sit here rather than in `packages/shared` because the rule being tested
 * needs the store: how many were ordered is a fact about an order, and the
 * whole point is that the service looks it up instead of believing the caller.
 *
 * Server actions are reachable by direct POST, so every field in a submission
 * is attacker-controlled — including the ordered quantity the form helpfully
 * sends along. A schema cannot catch that. This is where it is caught.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { orderQuantity } from "@bread/shared";

import { recordDelivery } from "../services/deliveries";
import { getStore } from "../services/store";

/** The in-memory store lives on globalThis, so each test starts from seed. */
beforeEach(() => {
  globalThis.__breadStore = undefined;
});

function firstOrderWithDelivery() {
  const store = getStore();
  const order = store.orders.find((entry) =>
    store.deliveries.some((delivery) => delivery.orderId === entry.id),
  );
  if (!order) throw new Error("The seed has no order with a delivery");

  const delivery = store.deliveries.find((entry) => entry.orderId === order.id)!;
  return { order, delivery, ordered: orderQuantity(order) };
}

describe("recording a delivery", () => {
  it("RULE: a part delivery is stored as given, when it fits the order", async () => {
    const { order, ordered } = firstOrderWithDelivery();

    await recordDelivery({
      orderId: order.id,
      status: "partial",
      deliveredQuantity: ordered - 1,
    });

    const { delivery } = firstOrderWithDelivery();
    expect(delivery.status).toBe("partial");
    expect(delivery.deliveredQuantity).toBe(ordered - 1);
    expect(order.status).toBe("partially_delivered");
  });

  /**
   * REGRESSION: this was accepted and stored. It could not corrupt a balance,
   * because deliveredValuePesewas stops once the order's lines run out, but it
   * wrote a number into the record that nothing should have trusted.
   */
  it("RULE: a part delivery cannot exceed what was ordered", async () => {
    const { order, ordered } = firstOrderWithDelivery();

    await expect(
      recordDelivery({
        orderId: order.id,
        status: "partial",
        deliveredQuantity: ordered + 1,
      }),
    ).rejects.toThrow(/were ordered/);

    await expect(
      recordDelivery({ orderId: order.id, status: "partial", deliveredQuantity: 9999 }),
    ).rejects.toThrow();

    // Nothing was written.
    const { delivery } = firstOrderWithDelivery();
    expect(delivery.deliveredQuantity).toBeLessThanOrEqual(ordered);
  });

  it("RULE: a part delivery of nothing is refused, not silently recorded", async () => {
    const { order } = firstOrderWithDelivery();

    await expect(
      recordDelivery({ orderId: order.id, status: "partial", deliveredQuantity: 0 }),
    ).rejects.toThrow(/at least one/);
  });

  it("RULE: a full delivery takes its quantity from the order, not the caller", async () => {
    const { order, ordered } = firstOrderWithDelivery();

    // A direct POST claiming a wildly different number.
    await recordDelivery({
      orderId: order.id,
      status: "delivered",
      deliveredQuantity: 9999,
    });

    const { delivery } = firstOrderWithDelivery();
    expect(delivery.deliveredQuantity).toBe(ordered);
    expect(delivery.status).toBe("delivered");
    expect(order.status).toBe("delivered");
  });

  it("RULE: a failed delivery is always zero, whatever was submitted", async () => {
    const { order } = firstOrderWithDelivery();

    await recordDelivery({
      orderId: order.id,
      status: "not_delivered",
      deliveredQuantity: 500,
    });

    const { delivery } = firstOrderWithDelivery();
    expect(delivery.deliveredQuantity).toBe(0);
    expect(delivery.status).toBe("not_delivered");
    // Back to scheduled, so it can be given a new day.
    expect(order.status).toBe("scheduled");
  });

  it("RULE: an unknown order is refused", async () => {
    await expect(
      recordDelivery({ orderId: "does-not-exist", status: "delivered", deliveredQuantity: 1 }),
    ).rejects.toThrow(/does not exist/);
  });
});
