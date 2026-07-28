/**
 * Report service.
 *
 * Gathers what a report reads and hands it to the pure builder in
 * @bread/shared. No arithmetic happens here on purpose — a number the owner
 * shows her accountant should come from code both apps run.
 */

import { buildReport, type DateRange, type Report } from "@bread/shared";

import { getStore, simulateLatency } from "./store";

export async function getReport(range: DateRange): Promise<Report> {
  const store = getStore();

  return simulateLatency(
    buildReport({
      range,
      orders: store.orders,
      deliveries: store.deliveries,
      payments: store.payments,
      purchases: store.purchases,
      supplyItems: store.supplyItems,
      costs: store.costs,
      products: store.products,
      customers: store.customers,
    }),
  );
}
