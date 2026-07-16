import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, imageUrl } from "../../shared/api/api-client";
import { Icon } from "../../shared/components/icon";
import type { ProductDetails } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";

export function ProductPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ["product", id], queryFn: () => apiGet<ProductDetails>(`/products/${id}`), enabled: Boolean(id) });
  const [selected, setSelected] = useState<number | null>(null);
  const cart = useCart();
  if (query.isLoading) return <section className="page-section"><div className="detail-skeleton" /></section>;
  if (query.isError || !query.data) return <section className="page-section"><div className="state-card"><h1>Product not found</h1><p>This item may have been removed or is temporarily unavailable.</p><Link className="primary-button" to="/products">Back to products</Link></div></section>;
  const product = query.data;
  const price = product.prices.find((x) => x.salePrice)?.salePrice ?? product.prices[0]?.regularPrice ?? 0;
  const stock = product.inventory?.availableQuantity ?? 0;
  const activeImage = product.images.find((x) => x.id === selected) ?? product.images.find((x) => x.isPrimary) ?? product.images[0];
  return <section className="page-section product-detail"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/products">Products</Link><span>/</span><span>{product.name}</span></div><div className="detail-grid"><div className="gallery"><div className="gallery-main"><img src={imageUrl(activeImage?.url) || "/placeholder-product.svg"} alt={product.name} /></div>{product.images.length > 1 && <div className="gallery-thumbs">{product.images.map((image) => <button className={activeImage?.id === image.id ? "active" : ""} key={image.id} onClick={() => setSelected(image.id)}><img src={imageUrl(image.url) ?? ""} alt="" /></button>)}</div>}</div><div className="detail-copy"><p className="eyebrow">{product.brandName || product.categoryName}</p><h1>{product.name}</h1><p className="detail-summary">{product.shortDescription || "A quality product selected for the EasyCart marketplace."}</p><div className="detail-price">${price.toFixed(2)}</div><div className={`stock-callout ${stock > 0 ? "available" : "unavailable"}`}><span />{stock > 0 ? `${stock} available — ready to order` : "Currently out of stock"}</div>{product.description && <div className="description"><h3>Product details</h3><p>{product.description}</p></div>}<dl className="spec-list"><div><dt>Category</dt><dd>{product.categoryName}</dd></div>{product.brandName && <div><dt>Brand</dt><dd>{product.brandName}</dd></div>}{product.unitName && <div><dt>Unit</dt><dd>{product.unitName}</dd></div>}{product.barcode && <div><dt>Barcode</dt><dd>{product.barcode}</dd></div>}</dl><div className="detail-actions"><button className="primary-button" disabled={stock < 1} onClick={() => cart.addItem({ id: product.id, name: product.name, image: activeImage?.url, price, stock })}><Icon name="cart" /> Add to cart</button><button className={`secondary-button ${cart.wishlist.includes(product.id) ? "active" : ""}`} onClick={() => cart.toggleWishlist(product.id)}><Icon name="heart" /> {cart.wishlist.includes(product.id) ? "Saved" : "Save"}</button></div></div></div></section>;
}
