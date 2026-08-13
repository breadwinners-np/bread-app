/**
 * Tests for the layer that turns database rows into domain objects.
 *
 * This module had no coverage until a verification pass went looking for it.
 * Two things in here are load-bearing and fail silently when wrong:
 *
 *   - `normalisePhone` decides whether two orders belong to the same customer.
 *     It has a twin in SQL (the generated `phone_normalised` column in
 *     migration 0002), and the two must agree exactly, or a checkout will
 *     create a second customer the owner already has.
 *   - Timestamps are normalised to UTC because two callers derive a business
 *     day by slicing the first ten characters off one. A non-UTC offset files
 *     a payment under the wrong day, and therefore the wrong month on the
 *     reports screen, with no error anywhere.
 */

import { describe, expect, it } from "vitest";

import { normalisePhone, toCustomer, toOrder, toPayment } from "../src/db-mapping";

describe("matching a customer by phone number", () => {
  /**
   * The four spellings the same Ghanaian number is written in. If these ever
   * stop agreeing, a returning customer silently becomes a second record.
   */
  it("RULE: every spelling of one number normalises to the same thing", () => {
    const spellings = [
      "+233 24 111 2233",
      "0241112233",
      "233241112233",
      "024-111-2233",
      " (024) 111 2233 ",
      "+233-24-111-2233",
    ];

    const normalised = new Set(spellings.map(normalisePhone));

    expect(normalised.size).toBe(1);
    expect([...normalised][0]).toBe("0241112233");
  });

  it("RULE: the country code becomes a leading zero", () => {
    expect(normalisePhone("+233241112233")).toBe("0241112233");
    expect(normalisePhone("233241112233")).toBe("0241112233");
  });

  it("RULE: a local number is left as it is", () => {
    expect(normalisePhone("0241112233")).toBe("0241112233");
  });

  it("RULE: punctuation and spacing are ignored", () => {
    expect(normalisePhone("024 111 2233")).toBe("0241112233");
    expect(normalisePhone("024.111.2233")).toBe("0241112233");
  });

  /**
   * Two different people must not collide. This is the failure that would hand
   * one customer another's order history.
   */
  it("RULE: two different numbers stay different", () => {
    expect(normalisePhone("+233 24 111 2233")).not.toBe(normalisePhone("+233 24 111 2234"));
  });

  it("RULE: mirrors the SQL column, which strips non-digits then swaps 233 for 0", () => {
    // Same algorithm as the generated column in migration 0002. Kept as an
    // explicit case so a change to one is visibly a change to both.
    const sql = (phone: string) => {
      const digits = phone.replace(/[^0-9]/g, "");
      return digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
    };

    for (const phone of ["+233 20 444 5566", "0554443322", "233 27 888 1122", "026-222-3344"]) {
      expect(normalisePhone(phone)).toBe(sql(phone));
    }
  });
});

describe("rows become domain objects", () => {
  const customerRow = {
    id: "c1",
    name: "Grace Mensah",
    phone: "+233 55 777 8899",
    phone_normalised: "0557778899",
    type: "individual" as const,
    area: "Labone",
    notes: null,
    archived_at: null,
    created_at: "2026-08-01T00:00:00+00:00",
    updated_at: "2026-08-01T00:00:00+00:00",
  };

  it("RULE: an absent note is undefined, not null", () => {
    expect(toCustomer(customerRow).notes).toBeUndefined();
  });

  it("RULE: an order with no delivery yet reads as scheduled", () => {
    const order = toOrder(
      {
        id: "o1",
        customer_id: "c1",
        delivery_date: "2026-08-14",
        source: "app",
        cancelled_at: null,
        rescheduled_from: null,
        created_at: "2026-08-13T10:00:00+00:00",
        customer_name: null,
        customer_phone: null,
        delivery_note: null,
        payment_method: "card",
        payment_status: "paid",
        payment_reference: "REF",
        total_pesewas: 3600,
      },
      [
        {
          id: "i1",
          order_id: "o1",
          product_id: "p1",
          product_name: "Butter bread",
          unit_price_pesewas: 1800,
          quantity: 2,
          created_at: "2026-08-13T10:00:00+00:00",
        },
      ],
      "pending",
    );

    expect(order.status).toBe("scheduled");
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0].unitPricePesewas).toBe(1800);
  });

  /**
   * Cancellation is the one status that is stored rather than derived, so it
   * has to win over whatever the delivery says.
   */
  it("RULE: a cancelled order stays cancelled whatever its delivery says", () => {
    const cancelled = toOrder(
      {
        id: "o1",
        customer_id: "c1",
        delivery_date: "2026-08-14",
        source: "admin",
        cancelled_at: "2026-08-13T12:00:00+00:00",
        rescheduled_from: null,
        created_at: "2026-08-13T10:00:00+00:00",
        customer_name: null,
        customer_phone: null,
        delivery_note: null,
        payment_method: null,
        payment_status: null,
        payment_reference: null,
        total_pesewas: 3600,
      },
      [],
      "delivered",
    );

    expect(cancelled.status).toBe("cancelled");
  });

  /**
   * REGRESSION GUARD: a payment recorded at 23:30 in a +01:00 offset belongs to
   * the next day in UTC. Two callers slice a business day off this string, so a
   * missed conversion moves money between days — and between months on the
   * reports screen — without any error.
   */
  it("RULE: timestamps are converted to UTC, not passed through", () => {
    const payment = toPayment({
      id: "pay1",
      customer_id: "c1",
      order_id: null,
      amount_pesewas: 5000,
      method: "cash",
      reference: null,
      note: null,
      source: "admin",
      recorded_at: "2026-08-13T23:30:00+01:00",
      confirmed_at: "2026-08-13T23:30:00+01:00",
      rejected_at: null,
    });

    expect(payment.recordedAt).toBe("2026-08-13T22:30:00.000Z");
    expect(payment.recordedAt.slice(0, 10)).toBe("2026-08-13");
    expect(payment.confirmedAt).toBe("2026-08-13T22:30:00.000Z");
  });

  it("RULE: a payment nobody has ruled on carries null, not a date", () => {
    const payment = toPayment({
      id: "pay1",
      customer_id: "c1",
      order_id: "o1",
      amount_pesewas: 5000,
      method: "mobile_money",
      reference: "MoMo 1234",
      note: null,
      source: "app",
      recorded_at: "2026-08-13T10:00:00+00:00",
      confirmed_at: null,
      rejected_at: null,
    });

    expect(payment.confirmedAt).toBeNull();
    expect(payment.rejectedAt).toBeNull();
  });
});
