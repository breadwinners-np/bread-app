import type { Product } from "@bread/shared";

/**
 * A tiny external store instead of Context + useEffect. localStorage-backed
 * state causes a hydration mismatch if it's read via setState-in-an-effect
 * (server renders an empty cart, client immediately overwrites it).
 * useSyncExternalStore sidesteps that: React uses getServerSnapshot to match
 * the server-rendered HTML during hydration, then switches to getSnapshot
 * right after — see useCart in cart-context.tsx.
 */
export interface CartLine {
  productId: string;
  name: string;
  unitPricePesewas: number;
  quantity: number;
}

const STORAGE_KEY = "storefront-cart";
const EMPTY_LINES: CartLine[] = [];

function readFromStorage(): CartLine[] {
  if (typeof window === "undefined") return EMPTY_LINES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : EMPTY_LINES;
  } catch {
    return EMPTY_LINES;
  }
}

function persist(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage full or unavailable — the cart still works for this tab.
  }
}

let lines: CartLine[] = readFromStorage();
const listeners = new Set<() => void>();

function setLines(next: CartLine[]) {
  lines = next;
  persist(next);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CartLine[] {
  return lines;
}

export function getServerSnapshot(): CartLine[] {
  return EMPTY_LINES;
}

export function addToCart(product: Product) {
  const existing = lines.find((line) => line.productId === product.id);
  if (existing) {
    setLines(
      lines.map((line) =>
        line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
      ),
    );
    return;
  }
  setLines([
    ...lines,
    { productId: product.id, name: product.name, unitPricePesewas: product.pricePesewas, quantity: 1 },
  ]);
}

export function setQuantity(productId: string, quantity: number) {
  setLines(
    quantity <= 0
      ? lines.filter((line) => line.productId !== productId)
      : lines.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
  );
}

export function removeFromCart(productId: string) {
  setLines(lines.filter((line) => line.productId !== productId));
}

export function clearCart() {
  setLines(EMPTY_LINES);
}
