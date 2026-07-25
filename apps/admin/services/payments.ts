import type { Payment } from "@bread/shared";

import { getStore, simulateLatency } from "./store";

export async function listPaymentsForCustomer(
  customerId: string,
): Promise<Payment[]> {
  const store = getStore();

  const payments = store.payments
    .filter((payment) => payment.customerId === customerId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return simulateLatency(payments);
}

export async function listPayments(): Promise<Payment[]> {
  const store = getStore();
  return simulateLatency(
    [...store.payments].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
  );
}
