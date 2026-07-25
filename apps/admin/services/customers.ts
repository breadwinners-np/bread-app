/**
 * Customer service. Screens call these, never the store directly.
 * Swap the bodies for Supabase queries and the screens stay unchanged.
 */

import {
  customerBalancePesewas,
  type Customer,
  type CustomerInput,
} from "@bread/shared";

import { getStore, newId, simulateLatency } from "./store";

export interface CustomerSummary extends Customer {
  balancePesewas: number;
  orderCount: number;
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  const store = getStore();

  const summaries = store.customers
    .filter((customer) => !customer.archivedAt)
    .map((customer) => withSummary(customer))
    .sort((a, b) => a.name.localeCompare(b.name));

  return simulateLatency(summaries);
}

export async function getCustomer(id: string): Promise<CustomerSummary | null> {
  const store = getStore();
  const customer = store.customers.find((entry) => entry.id === id);
  return simulateLatency(customer ? withSummary(customer) : null);
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const store = getStore();

  const customer: Customer = {
    id: newId("cus"),
    name: input.name,
    phone: input.phone,
    type: input.type,
    area: input.area,
    notes: input.notes,
    archivedAt: null,
  };

  store.customers.push(customer);
  return simulateLatency(customer);
}

function withSummary(customer: Customer): CustomerSummary {
  const store = getStore();

  const orders = store.orders.filter((order) => order.customerId === customer.id);
  const payments = store.payments.filter(
    (payment) => payment.customerId === customer.id,
  );

  return {
    ...customer,
    balancePesewas: customerBalancePesewas(orders, payments),
    orderCount: orders.length,
  };
}
