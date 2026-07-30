/**
 * Tests for the pure business logic in @bread/shared.
 *
 * This is the money. Everything a customer owes, every figure in a report, and
 * every number the owner would read out to her accountant comes from these
 * functions, so they are tested directly rather than through a screen.
 *
 * Two kinds of test live here and they are labelled, because the difference
 * matters when a business rule finally gets answered:
 *
 * - **Rules.** Behaviour we believe is correct. If one of these fails, the code
 *   is broken.
 * - **Provisional.** Behaviour that encodes a guess at an open question in
 *   DECISIONS.md. These pass today and are *expected* to change when the owner
 *   answers. They exist so that a change is deliberate rather than accidental —
 *   a failing provisional test is a prompt to update the test, not a bug.
 */

import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  buildReport,
  calendarWeeks,
  cedisToPesewas,
  customerAccount,
  customerBalancePesewas,
  dayOfMonth,
  daysBetween,
  deliveredValuePesewas,
  deliveryProgress,
  eachDay,
  endOfMonth,
  formatAmount,
  formatDate,
  formatGhs,
  formatLongDate,
  formatMonth,
  formatQuantity,
  granularityFor,
  isAwaitingConfirmation,
  isPaymentCounted,
  isValidIsoDate,
  isValidIsoMonth,
  isWithin,
  lineTotalPesewas,
  matchRangePreset,
  monthOf,
  orderAmountDuePesewas,
  orderInputSchema,
  orderQuantity,
  orderStatusForDelivery,
  orderTotalPesewas,
  outstandingReason,
  paymentInputSchema,
  purchaseInputSchema,
  purchaseTotalPesewas,
  recordDeliverySchema,
  reportRangeSchema,
  resolveRangePreset,
  startOfMonth,
  startOfWeek,
  sumPesewas,
  summariseReport,
  type Delivery,
  type Order,
  type Payment,
} from "../src/index";

// ---------------------------------------------------------------------------
// Builders — keep each test to the one fact it is about.
// ---------------------------------------------------------------------------

function order(overrides: Partial<Order> & { id: string }): Order {
  return {
    customerId: "cus-1",
    deliveryDate: "2026-07-20",
    status: "scheduled",
    source: "admin",
    lines: [
      { id: `${overrides.id}-l1`, productId: "prd-1", quantity: 10, unitPricePesewas: 1200 },
    ],
    createdAt: "2026-07-19T08:00:00.000Z",
    ...overrides,
  };
}

function delivery(overrides: Partial<Delivery> & { orderId: string }): Delivery {
  return {
    id: `del-${overrides.orderId}`,
    status: "pending",
    deliveredQuantity: 0,
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> & { id: string }): Payment {
  return {
    customerId: "cus-1",
    amountPesewas: 1000,
    method: "cash",
    source: "admin",
    recordedAt: "2026-07-20T10:00:00.000Z",
    confirmedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

describe("money", () => {
  it("RULE: formats pesewas as cedis with two decimals and grouping", () => {
    expect(formatGhs(0)).toBe("GHS 0.00");
    expect(formatGhs(5)).toBe("GHS 0.05");
    expect(formatGhs(100)).toBe("GHS 1.00");
    expect(formatGhs(123456)).toBe("GHS 1,234.56");
    expect(formatGhs(100000000)).toBe("GHS 1,000,000.00");
  });

  it("RULE: keeps the minus sign outside the currency code", () => {
    expect(formatGhs(-123456)).toBe("-GHS 1,234.56");
    expect(formatAmount(-123456)).toBe("-1,234.56");
  });

  it("RULE: converts typed cedis to whole pesewas without float drift", () => {
    expect(cedisToPesewas(12.34)).toBe(1234);
    expect(cedisToPesewas(0.1)).toBe(10);
    expect(cedisToPesewas(19.99)).toBe(1999);
    // 1.005 * 100 is 100.49999999999999 in binary floating point. Rounding once
    // at the boundary is what keeps a month of daily deliveries from drifting.
    expect(Number.isInteger(cedisToPesewas(1.005))).toBe(true);
  });

  it("RULE: sums an empty list to zero rather than NaN", () => {
    expect(sumPesewas([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

describe("dates", () => {
  it("RULE: displays ISO dates as DD/MM/YYYY", () => {
    expect(formatDate("2026-07-28")).toBe("28/07/2026");
    expect(formatLongDate("2026-07-28")).toBe("Tuesday, 28 July 2026");
    expect(formatMonth("2026-07")).toBe("July 2026");
  });

  it("RULE: shifts days across month and year boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-07-28", 0)).toBe("2026-07-28");
  });

  it("RULE: handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("RULE: counts whole days between dates, signed", () => {
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
    expect(daysBetween("2026-07-08", "2026-07-01")).toBe(-7);
    expect(daysBetween("2026-07-01", "2026-07-01")).toBe(0);
  });

  it("RULE: weeks run Monday to Sunday", () => {
    // 2026-07-28 is a Tuesday; 2026-07-26 is a Sunday.
    expect(startOfWeek("2026-07-28")).toBe("2026-07-27");
    expect(startOfWeek("2026-07-27")).toBe("2026-07-27");
    expect(startOfWeek("2026-07-26")).toBe("2026-07-20");
  });

  it("RULE: lists days inclusively, and nothing for a backwards range", () => {
    expect(eachDay("2026-07-01", "2026-07-03")).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
    expect(eachDay("2026-07-03", "2026-07-01")).toEqual([]);
    expect(eachDay("2026-07-01", "2026-07-01")).toHaveLength(1);
  });

  it("RULE: reads a month off a date", () => {
    expect(monthOf("2026-07-28")).toBe("2026-07");
    expect(startOfMonth("2026-07-28")).toBe("2026-07-01");
  });

  /**
   * REGRESSION. addDays used to throw RangeError here: `new Date("nonsense")`
   * is an Invalid Date and `.toISOString()` on one throws rather than returning
   * a string. It was reachable from /distribution?date=nonsense, which put an
   * unvalidated query string straight into the previous/next day links and
   * returned a 500.
   */
  it("RULE: date helpers fall back instead of throwing on rubbish input", () => {
    expect(() => addDays("nonsense", 1)).not.toThrow();
    expect(addDays("nonsense", 1)).toBe("nonsense");
    expect(addDays("2026-13-45", 1)).toBe("2026-13-45");

    expect(() => endOfMonth("nonsense")).not.toThrow();
    expect(endOfMonth("nonsense")).toBe("nonsense");

    // The helpers that already guarded still do.
    expect(formatDate("nonsense")).toBe("nonsense");
    expect(daysBetween("nonsense", "2026-07-01")).toBe(0);
    expect(startOfWeek("nonsense")).toBe("nonsense");
  });

  it("RULE: a calendar month is always whole Monday-to-Sunday weeks", () => {
    // July 2026 starts on a Wednesday and ends on a Friday, so the grid reaches
    // back into June and forward into August.
    const weeks = calendarWeeks("2026-07");

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.[0]?.date).toBe("2026-06-29");
    expect(weeks[0]?.[0]?.inMonth).toBe(false);
    expect(weeks[0]?.[2]?.date).toBe("2026-07-01");
    expect(weeks[0]?.[2]?.inMonth).toBe(true);
    expect(weeks[4]?.[6]?.date).toBe("2026-08-02");
    expect(weeks[4]?.[6]?.inMonth).toBe(false);

    // Every day of the month appears exactly once.
    const inMonth = weeks.flat().filter((day) => day.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(new Set(inMonth.map((day) => day.date)).size).toBe(31);
  });

  it("RULE: a February grid handles a leap year", () => {
    expect(
      calendarWeeks("2028-02")
        .flat()
        .filter((day) => day.inMonth),
    ).toHaveLength(29);
    expect(
      calendarWeeks("2026-02")
        .flat()
        .filter((day) => day.inMonth),
    ).toHaveLength(28);
  });

  it("RULE: months shift without rolling over a short month", () => {
    expect(addMonths("2026-07", 1)).toBe("2026-08");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    // The 31st of January plus a month is the trap this avoids by anchoring
    // to the first: the answer is February, not March.
    expect(addMonths("2026-01", 1)).toBe("2026-02");
  });

  it("RULE: month helpers fall back instead of throwing on rubbish input", () => {
    expect(calendarWeeks("nonsense")).toEqual([]);
    expect(calendarWeeks("2026-13")).toEqual([]);
    expect(addMonths("nonsense", 1)).toBe("nonsense");

    expect(isValidIsoMonth("2026-07")).toBe(true);
    expect(isValidIsoMonth("2026-13")).toBe(false);
    expect(isValidIsoMonth("2026-07-28")).toBe(false);
    expect(isValidIsoMonth("")).toBe(false);
  });

  it("RULE: reads the day number for a calendar cell", () => {
    expect(dayOfMonth("2026-07-01")).toBe(1);
    expect(dayOfMonth("2026-07-28")).toBe(28);
  });

  it("RULE: only real calendar days are valid", () => {
    expect(isValidIsoDate("2026-07-28")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true); // leap year

    expect(isValidIsoDate("2026-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-13-45")).toBe(false);
    expect(isValidIsoDate("28/07/2026")).toBe(false);
    expect(isValidIsoDate("2026-7-8")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("nonsense")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Orders and deliveries
// ---------------------------------------------------------------------------

describe("orders", () => {
  it("RULE: values a line and an order at the snapshotted unit price", () => {
    expect(lineTotalPesewas({ quantity: 10, unitPricePesewas: 1200 })).toBe(12000);
    expect(orderTotalPesewas(order({ id: "ord-1" }))).toBe(12000);
    expect(orderQuantity(order({ id: "ord-1" }))).toBe(10);
  });

  it("RULE: sums several lines", () => {
    const multi = order({
      id: "ord-2",
      lines: [
        { id: "a", productId: "prd-1", quantity: 10, unitPricePesewas: 1200 },
        { id: "b", productId: "prd-2", quantity: 5, unitPricePesewas: 1000 },
      ],
    });
    expect(orderTotalPesewas(multi)).toBe(17000);
    expect(orderQuantity(multi)).toBe(15);
  });

  it("RULE: maps a delivery outcome to an order status", () => {
    expect(orderStatusForDelivery("delivered")).toBe("delivered");
    expect(orderStatusForDelivery("partial")).toBe("partially_delivered");
    // A failed drop goes back to scheduled so it can be given a new day.
    expect(orderStatusForDelivery("not_delivered")).toBe("scheduled");
    expect(orderStatusForDelivery("pending")).toBe("scheduled");
  });

  it("RULE: counts a part delivery as done for the day's progress", () => {
    expect(
      deliveryProgress([
        delivery({ orderId: "a", status: "delivered" }),
        delivery({ orderId: "b", status: "partial" }),
        delivery({ orderId: "c", status: "pending" }),
        delivery({ orderId: "d", status: "not_delivered" }),
      ]),
    ).toEqual({ done: 2, total: 4 });
  });

  it("RULE: flags failed and never-recorded deliveries, but not future ones", () => {
    const today = "2026-07-28";
    const past = order({ id: "o1", deliveryDate: "2026-07-25" });
    const future = order({ id: "o2", deliveryDate: "2026-07-30" });

    expect(outstandingReason(past, delivery({ orderId: "o1", status: "not_delivered" }), today)).toBe("failed");
    expect(outstandingReason(past, delivery({ orderId: "o1", status: "pending" }), today)).toBe("overdue");
    expect(outstandingReason(future, delivery({ orderId: "o2", status: "pending" }), today)).toBeNull();
    expect(outstandingReason(past, delivery({ orderId: "o1", status: "delivered" }), today)).toBeNull();
  });

  it("RULE: a cancelled order never needs attention", () => {
    const cancelled = order({ id: "o3", deliveryDate: "2026-07-01", status: "cancelled" });
    expect(
      outstandingReason(cancelled, delivery({ orderId: "o3", status: "not_delivered" }), "2026-07-28"),
    ).toBeNull();
  });

  /**
   * PROVISIONAL (DST-7). A part delivery is deliberately left off the
   * needs-attention list, because whether the shortfall gets redelivered or is
   * simply gone has not been answered.
   */
  it("PROVISIONAL: a part delivery is not listed as outstanding", () => {
    const past = order({ id: "o4", deliveryDate: "2026-07-25" });
    expect(
      outstandingReason(past, delivery({ orderId: "o4", status: "partial", deliveredQuantity: 5 }), "2026-07-28"),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// What is owed
// ---------------------------------------------------------------------------

describe("what an order is owed", () => {
  it("RULE: nothing is owed until the bread arrives", () => {
    const ord = order({ id: "o1" });
    expect(orderAmountDuePesewas(ord, delivery({ orderId: "o1", status: "pending" }))).toBe(0);
    expect(orderAmountDuePesewas(ord, delivery({ orderId: "o1", status: "not_delivered" }))).toBe(0);
    expect(orderAmountDuePesewas(ord, undefined)).toBe(0);
  });

  it("RULE: a full delivery owes the whole order", () => {
    const ord = order({ id: "o1" });
    expect(orderAmountDuePesewas(ord, delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 }))).toBe(12000);
  });

  it("RULE: a cancelled order owes nothing even if it was delivered", () => {
    const ord = order({ id: "o1", status: "cancelled" });
    expect(orderAmountDuePesewas(ord, delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 }))).toBe(0);
  });

  it("RULE: a part delivery fills the order's lines in order", () => {
    const multi = order({
      id: "o2",
      lines: [
        { id: "a", productId: "prd-1", quantity: 10, unitPricePesewas: 1200 },
        { id: "b", productId: "prd-2", quantity: 5, unitPricePesewas: 1000 },
      ],
    });
    // 12 taken: all 10 of the first line, then 2 of the second.
    expect(deliveredValuePesewas(multi, delivery({ orderId: "o2", status: "partial", deliveredQuantity: 12 }))).toBe(14000);
  });

  it("RULE: delivering more than was ordered never bills for the excess", () => {
    const ord = order({ id: "o3" });
    expect(deliveredValuePesewas(ord, delivery({ orderId: "o3", status: "partial", deliveredQuantity: 999 }))).toBe(12000);
  });

  /**
   * PROVISIONAL (DST-7). A short drop is billed for what arrived. If the owner
   * says a shortfall is still charged in full, this is the test that changes,
   * and orderAmountDuePesewas is the only function that has to move.
   */
  it("PROVISIONAL: a part delivery is owed only for what arrived", () => {
    const ord = order({ id: "o4" });
    expect(orderAmountDuePesewas(ord, delivery({ orderId: "o4", status: "partial", deliveredQuantity: 4 }))).toBe(4800);
  });
});

// ---------------------------------------------------------------------------
// A customer's account
// ---------------------------------------------------------------------------

describe("a customer's account", () => {
  const delivered = order({ id: "o1", deliveryDate: "2026-07-20" });
  const deliveredDrop = delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 });

  it("RULE: delivered bread with no payment is owed in full", () => {
    const account = customerAccount([delivered], [deliveredDrop], []);
    expect(account.duePesewas).toBe(12000);
    expect(account.paidPesewas).toBe(0);
    expect(account.balancePesewas).toBe(12000);
    expect(account.lines[0]?.state).toBe("unpaid");
  });

  it("RULE: a payment tied to an order settles that order", () => {
    const account = customerAccount(
      [delivered],
      [deliveredDrop],
      [payment({ id: "p1", orderId: "o1", amountPesewas: 12000 })],
    );
    expect(account.balancePesewas).toBe(0);
    expect(account.lines[0]?.state).toBe("paid");
  });

  it("RULE: a part payment leaves the rest outstanding", () => {
    const account = customerAccount(
      [delivered],
      [deliveredDrop],
      [payment({ id: "p1", orderId: "o1", amountPesewas: 5000 })],
    );
    expect(account.balancePesewas).toBe(7000);
    expect(account.lines[0]?.state).toBe("part_paid");
    expect(account.lines[0]?.outstandingPesewas).toBe(7000);
  });

  it("RULE: an unconfirmed payment counts for nothing but is reported separately", () => {
    const claim = payment({
      id: "p1",
      amountPesewas: 12000,
      source: "app",
      confirmedAt: null,
    });
    const account = customerAccount([delivered], [deliveredDrop], [claim]);

    expect(account.paidPesewas).toBe(0);
    expect(account.balancePesewas).toBe(12000);
    expect(account.awaitingConfirmationPesewas).toBe(12000);
    expect(isAwaitingConfirmation(claim)).toBe(true);
    expect(isPaymentCounted(claim)).toBe(false);
  });

  it("RULE: a rejected payment counts for nothing and is not awaiting anything", () => {
    const rejected = payment({
      id: "p1",
      amountPesewas: 12000,
      source: "app",
      confirmedAt: null,
      rejectedAt: "2026-07-21T09:00:00.000Z",
    });
    const account = customerAccount([delivered], [deliveredDrop], [rejected]);

    expect(account.balancePesewas).toBe(12000);
    expect(account.awaitingConfirmationPesewas).toBe(0);
    expect(isAwaitingConfirmation(rejected)).toBe(false);
    expect(isPaymentCounted(rejected)).toBe(false);
  });

  it("RULE: a confirmed payment that was later rejected stops counting", () => {
    const reversed = payment({
      id: "p1",
      amountPesewas: 12000,
      confirmedAt: "2026-07-20T10:00:00.000Z",
      rejectedAt: "2026-07-22T10:00:00.000Z",
    });
    expect(isPaymentCounted(reversed)).toBe(false);
  });

  it("RULE: a lump sum settles the oldest delivered bread first", () => {
    const older = order({ id: "o1", deliveryDate: "2026-07-10" });
    const newer = order({ id: "o2", deliveryDate: "2026-07-20" });
    const account = customerAccount(
      [newer, older], // deliberately out of order — the function sorts
      [
        delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 }),
        delivery({ orderId: "o2", status: "delivered", deliveredQuantity: 10 }),
      ],
      [payment({ id: "p1", amountPesewas: 12000 })],
    );

    const byId = new Map(account.lines.map((line) => [line.order.id, line]));
    expect(byId.get("o1")?.state).toBe("paid");
    expect(byId.get("o2")?.state).toBe("unpaid");
    expect(account.balancePesewas).toBe(12000);
  });

  it("RULE: money tied to one order is not stolen by an older unpaid one", () => {
    const older = order({ id: "o1", deliveryDate: "2026-07-10" });
    const newer = order({ id: "o2", deliveryDate: "2026-07-20" });
    const account = customerAccount(
      [older, newer],
      [
        delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 }),
        delivery({ orderId: "o2", status: "delivered", deliveredQuantity: 10 }),
      ],
      [payment({ id: "p1", orderId: "o2", amountPesewas: 12000 })],
    );

    const byId = new Map(account.lines.map((line) => [line.order.id, line]));
    expect(byId.get("o2")?.state).toBe("paid");
    expect(byId.get("o1")?.state).toBe("unpaid");
  });

  it("RULE: an overpayment spills onto the account as credit", () => {
    const account = customerAccount(
      [delivered],
      [deliveredDrop],
      [payment({ id: "p1", orderId: "o1", amountPesewas: 20000 })],
    );
    expect(account.creditPesewas).toBe(8000);
    expect(account.balancePesewas).toBe(-8000);
  });

  it("RULE: a payment against an order that is not theirs stays on the account", () => {
    const account = customerAccount(
      [delivered],
      [deliveredDrop],
      [payment({ id: "p1", orderId: "does-not-exist", amountPesewas: 12000 })],
    );
    expect(account.balancePesewas).toBe(0);
    expect(account.lines[0]?.state).toBe("paid");
  });

  it("RULE: bread not yet delivered is expected, not owed", () => {
    const scheduled = order({ id: "o9", deliveryDate: "2026-07-30" });
    const account = customerAccount([scheduled], [delivery({ orderId: "o9", status: "pending" })], []);

    expect(account.duePesewas).toBe(0);
    expect(account.balancePesewas).toBe(0);
    expect(account.notYetDuePesewas).toBe(12000);
    expect(account.lines[0]?.state).toBe("not_due");
  });

  it("RULE: a cancelled order is neither owed nor expected", () => {
    const cancelled = order({ id: "o8", status: "cancelled" });
    const account = customerAccount([cancelled], [delivery({ orderId: "o8", status: "pending" })], []);
    expect(account.duePesewas).toBe(0);
    expect(account.notYetDuePesewas).toBe(0);
  });

  it("RULE: the balance helper agrees with the full account", () => {
    expect(customerBalancePesewas([delivered], [deliveredDrop], [])).toBe(12000);
  });

  /**
   * PROVISIONAL (DST-7, RSC-4). After a short drop, the undelivered remainder
   * is reported as "coming up" — i.e. as bread still expected. That is only
   * right if she takes the rest out later. If a shortfall is simply gone, this
   * figure is overstating what is coming.
   */
  it("PROVISIONAL: the shortfall of a part delivery is shown as still to come", () => {
    const account = customerAccount(
      [order({ id: "o5" })],
      [delivery({ orderId: "o5", status: "partial", deliveredQuantity: 4 })],
      [],
    );
    expect(account.duePesewas).toBe(4800);
    expect(account.notYetDuePesewas).toBe(7200);
  });

  /**
   * PROVISIONAL (PAY-6). Nothing prevents a customer going into credit, and no
   * limit is applied, because whether that is allowed is unanswered.
   */
  it("PROVISIONAL: nothing caps how far into credit a customer may go", () => {
    const account = customerAccount([], [], [payment({ id: "p1", amountPesewas: 5_000_000 })]);
    expect(account.balancePesewas).toBe(-5_000_000);
    expect(account.creditPesewas).toBe(5_000_000);
  });
});

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

describe("purchases", () => {
  it("RULE: rounds a fractional quantity once, at the end", () => {
    expect(purchaseTotalPesewas({ quantity: 2.5, unitPricePesewas: 33 })).toBe(83);
    expect(purchaseTotalPesewas({ quantity: 4, unitPricePesewas: 30000 })).toBe(120000);
    expect(Number.isInteger(purchaseTotalPesewas({ quantity: 0.3, unitPricePesewas: 999 }))).toBe(true);
  });

  it("RULE: pluralises a unit only when there is more than one", () => {
    expect(formatQuantity(1, "sack")).toBe("1 sack");
    expect(formatQuantity(4, "sack")).toBe("4 sacks");
    expect(formatQuantity(2.5, "kg")).toBe("2.5 kg");
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

describe("reports", () => {
  const range = { from: "2026-07-01", to: "2026-07-31" };

  const emptyInput = {
    range,
    orders: [],
    deliveries: [],
    payments: [],
    purchases: [],
    supplyItems: [],
    costs: [],
    products: [],
    customers: [],
  };

  it("RULE: a range with nothing in it reports zeroes, not NaN", () => {
    const report = buildReport(emptyInput);
    expect(report.revenuePesewas).toBe(0);
    expect(report.costPesewas).toBe(0);
    expect(report.profitPesewas).toBe(0);
    expect(report.quantityDelivered).toBe(0);
    expect(report.buckets).toHaveLength(31);
  });

  it("RULE: revenue counts delivered bread only, on its delivery day", () => {
    const report = buildReport({
      ...emptyInput,
      orders: [
        order({ id: "o1", deliveryDate: "2026-07-10" }),
        order({ id: "o2", deliveryDate: "2026-07-11" }),
      ],
      deliveries: [
        delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 }),
        delivery({ orderId: "o2", status: "pending" }),
      ],
    });

    expect(report.revenuePesewas).toBe(12000);
    expect(report.ordersDelivered).toBe(1);
    expect(report.quantityDelivered).toBe(10);
    expect(report.buckets.find((b) => b.key === "2026-07-10")?.revenuePesewas).toBe(12000);
    expect(report.buckets.find((b) => b.key === "2026-07-11")?.revenuePesewas).toBe(0);
  });

  it("RULE: an order outside the range is ignored entirely", () => {
    const report = buildReport({
      ...emptyInput,
      orders: [order({ id: "o1", deliveryDate: "2026-06-30" })],
      deliveries: [delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 })],
    });
    expect(report.revenuePesewas).toBe(0);
  });

  it("RULE: money earned and money received are counted separately", () => {
    const report = buildReport({
      ...emptyInput,
      orders: [order({ id: "o1", deliveryDate: "2026-07-10" })],
      deliveries: [delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 })],
      // A cheque for June's bread that arrives in July.
      payments: [payment({ id: "p1", amountPesewas: 50000, recordedAt: "2026-07-15T09:00:00.000Z" })],
    });

    expect(report.revenuePesewas).toBe(12000);
    expect(report.paymentsReceivedPesewas).toBe(50000);
  });

  it("RULE: an unconfirmed payment is not money received", () => {
    const report = buildReport({
      ...emptyInput,
      payments: [
        payment({
          id: "p1",
          amountPesewas: 50000,
          recordedAt: "2026-07-15T09:00:00.000Z",
          source: "app",
          confirmedAt: null,
        }),
      ],
    });
    expect(report.paymentsReceivedPesewas).toBe(0);
  });

  it("RULE: outstanding is delivered bread in the range that is unpaid", () => {
    const report = buildReport({
      ...emptyInput,
      orders: [order({ id: "o1", deliveryDate: "2026-07-10" })],
      deliveries: [delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 })],
      payments: [payment({ id: "p1", orderId: "o1", amountPesewas: 5000 })],
    });
    expect(report.outstandingPesewas).toBe(7000);
  });

  it("RULE: costs count purchases and lump costs together", () => {
    const report = buildReport({
      ...emptyInput,
      purchases: [
        {
          id: "pur-1",
          itemId: "sup-1",
          date: "2026-07-05",
          quantity: 4,
          unit: "sack" as const,
          unitPricePesewas: 30000,
          recordedAt: "2026-07-05T07:00:00.000Z",
        },
      ],
      costs: [
        { id: "cost-1", date: "2026-07-05", category: "transport" as const, amountPesewas: 5000 },
      ],
    });

    expect(report.costPesewas).toBe(125000);
    expect(report.profitPesewas).toBe(-125000);
    expect(report.buckets.find((b) => b.key === "2026-07-05")?.costPesewas).toBe(125000);
  });

  it("RULE: buckets get coarser as the range gets longer", () => {
    expect(granularityFor({ from: "2026-07-01", to: "2026-07-31" })).toBe("day");
    expect(granularityFor({ from: "2026-01-01", to: "2026-03-31" })).toBe("week");
    expect(granularityFor({ from: "2025-01-01", to: "2026-12-31" })).toBe("month");
  });

  it("RULE: range presets resolve and round-trip", () => {
    const today = "2026-07-28";
    expect(resolveRangePreset("today", today)).toEqual({ from: today, to: today });
    expect(resolveRangePreset("yesterday", today)).toEqual({
      from: "2026-07-27",
      to: "2026-07-27",
    });
    expect(resolveRangePreset("last_7_days", today)).toEqual({ from: "2026-07-22", to: today });
    expect(resolveRangePreset("this_month", today)).toEqual({ from: "2026-07-01", to: today });
    expect(resolveRangePreset("last_month", today)).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(resolveRangePreset("custom", today)).toBeNull();

    expect(matchRangePreset({ from: "2026-07-01", to: today }, today)).toBe("this_month");
    expect(matchRangePreset({ from: "2026-02-03", to: "2026-02-09" }, today)).toBe("custom");
    // Yesterday is a single day like Today, so the two must not shadow each
    // other — matchRangePreset returns the first preset that fits.
    expect(matchRangePreset({ from: today, to: today }, today)).toBe("today");
    expect(
      matchRangePreset({ from: "2026-07-27", to: "2026-07-27" }, today),
    ).toBe("yesterday");
  });

  it("RULE: isWithin is inclusive at both ends", () => {
    expect(isWithin("2026-07-01", range)).toBe(true);
    expect(isWithin("2026-07-31", range)).toBe(true);
    expect(isWithin("2026-06-30", range)).toBe(false);
    expect(isWithin("2026-08-01", range)).toBe(false);
  });

  it("RULE: the summary says nothing was delivered rather than '0 loaves'", () => {
    const sentences = summariseReport(buildReport(emptyInput), formatGhs);
    expect(sentences[0]).toContain("No bread was delivered");
    expect(sentences.join(" ")).not.toContain("NaN");
  });

  it("RULE: the summary reads as sentences with real figures", () => {
    const report = buildReport({
      ...emptyInput,
      orders: [order({ id: "o1", deliveryDate: "2026-07-10" })],
      deliveries: [delivery({ orderId: "o1", status: "delivered", deliveredQuantity: 10 })],
    });
    const text = summariseReport(report, formatGhs).join(" ");

    expect(text).toContain("10 loaves");
    expect(text).toContain("GHS 120.00");
    expect(text).not.toContain("undefined");
  });
});

// ---------------------------------------------------------------------------
// Validation at the boundary
// ---------------------------------------------------------------------------

describe("schemas", () => {
  it("RULE: an order needs a customer, a real date, a product and a whole quantity", () => {
    expect(
      orderInputSchema.safeParse({
        customerId: "cus-1",
        deliveryDate: "2026-07-28",
        productId: "prd-1",
        quantity: "12", // arrives from a form as a string
      }).success,
    ).toBe(true);

    expect(orderInputSchema.safeParse({ customerId: "", deliveryDate: "2026-07-28", productId: "prd-1", quantity: 1 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ customerId: "c", deliveryDate: "28/07/2026", productId: "p", quantity: 1 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ customerId: "c", deliveryDate: "2026-07-28", productId: "p", quantity: 0 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ customerId: "c", deliveryDate: "2026-07-28", productId: "p", quantity: -5 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ customerId: "c", deliveryDate: "2026-07-28", productId: "p", quantity: 2.5 }).success).toBe(false);
  });

  it("RULE: a payment must be above zero", () => {
    const base = { customerId: "cus-1", method: "cash" as const };
    expect(paymentInputSchema.safeParse({ ...base, amountCedis: "50.00" }).success).toBe(true);
    expect(paymentInputSchema.safeParse({ ...base, amountCedis: 0 }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...base, amountCedis: -10 }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...base, amountCedis: "abc" }).success).toBe(false);
  });

  it("RULE: a purchase needs a positive quantity and unit price", () => {
    const base = { itemId: "sup-1", date: "2026-07-28", unit: "sack" as const };
    expect(purchaseInputSchema.safeParse({ ...base, quantity: "2.5", unitPriceCedis: "300" }).success).toBe(true);
    expect(purchaseInputSchema.safeParse({ ...base, quantity: 0, unitPriceCedis: 300 }).success).toBe(false);
    expect(purchaseInputSchema.safeParse({ ...base, quantity: 1, unitPriceCedis: 0 }).success).toBe(false);
  });

  it("RULE: a report range cannot run backwards", () => {
    expect(reportRangeSchema.safeParse({ from: "2026-07-01", to: "2026-07-31" }).success).toBe(true);
    expect(reportRangeSchema.safeParse({ from: "2026-07-31", to: "2026-07-01" }).success).toBe(false);
  });

  it("RULE: a delivery quantity cannot be negative or fractional", () => {
    const base = { orderId: "ord-1", status: "partial" as const };
    expect(recordDeliverySchema.safeParse({ ...base, deliveredQuantity: -1 }).success).toBe(false);
    expect(recordDeliverySchema.safeParse({ ...base, deliveredQuantity: 1.5 }).success).toBe(false);
  });

  /**
   * The schema cannot know how many were ordered, so a part delivery of 9,999
   * still parses. The ceiling is enforced where the ordered quantity is
   * actually known — `recordDelivery` in the admin delivery service, which
   * looks the order up rather than trusting the submission. See the service
   * tests for that half.
   */
  it("RULE: the schema shapes a delivery, it does not price it", () => {
    expect(
      recordDeliverySchema.safeParse({
        orderId: "ord-1",
        status: "partial",
        deliveredQuantity: 9999,
      }).success,
    ).toBe(true);
  });

  /** REGRESSION: these were accepted, then flowed into date arithmetic. */
  it("RULE: a date-shaped string that is not a real day is rejected", () => {
    const base = { customerId: "c", productId: "p", quantity: 1 };
    expect(orderInputSchema.safeParse({ ...base, deliveryDate: "2026-13-45" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, deliveryDate: "2026-02-31" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, deliveryDate: "2026-02-29" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, deliveryDate: "2028-02-29" }).success).toBe(true);

    expect(reportRangeSchema.safeParse({ from: "2026-13-01", to: "2026-07-31" }).success).toBe(false);
  });
});
