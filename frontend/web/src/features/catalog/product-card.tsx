import { Link } from "react-router-dom";
import { imageUrl } from "../../shared/api/api-client";
import { Icon } from "../../shared/components/icon";
import type { Product } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";

export function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const liked = cart.wishlist.includes(product.id);
  return <article className="product-card">
    <div className="product-media">
      <Link to={`/products/${product.id}`}><img src={imageUrl(product.primaryImageUrl) || "/placeholder-product.svg"} alt={product.name} /></Link>
      {product.isFeatured && <span className="product-badge">Featured</span>}
      <button className={`heart-button ${liked ? "active" : ""}`} onClick={() => cart.toggleWishlist(product.id)} aria-label="Save product"><Icon name="heart" /></button>
    </div>
    <div className="product-info">
      <p className="eyebrow">{product.categoryName || "Marketplace"}</p>
      <Link className="product-title" to={`/products/${product.id}`}>{product.name}</Link>
      <div className="product-meta"><strong>${(product.price ?? 0).toFixed(2)}</strong><span className={product.stock > 0 ? "in-stock" : "out-stock"}>{product.stock > 0 ? `${product.stock} in stock` : "Sold out"}</span></div>
      <button className="primary-button full" disabled={product.stock < 1} onClick={() => cart.addItem({ id: product.id, name: product.name, image: product.primaryImageUrl, price: product.price ?? 0, stock: product.stock })}><Icon name="cart" /> Add to cart</button>
    </div>
  </article>;
}
