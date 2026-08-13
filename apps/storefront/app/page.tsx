import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/products";

export default async function HomePage() {
  const products = await listProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Today&rsquo;s bread</h1>
        <p className="mt-1 text-stone-600">Add what you&rsquo;d like, then check out.</p>
      </div>

      {products.length === 0 ? (
        <p className="text-stone-600">Nothing on the menu right now — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
