import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "../components/icon";
import { useCart } from "../../features/cart/cart-context";

export function StoreLayout() {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const cart = useCart();
  const submit = (event: FormEvent) => { event.preventDefault(); navigate(`/products${query ? `?search=${encodeURIComponent(query)}` : ""}`); };
  return <div className="site-shell">
    <div className="announcement"><span>Free delivery on orders over $75</span><span>Secure checkout · Easy returns</span></div>
    <header className="header">
      <Link className="brand" to="/"><span className="brand-mark">EA</span><span>Easy<span>Cart</span></span></Link>
      <form className="header-search" onSubmit={submit}><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, brands and categories" /><button>Search</button></form>
      <nav className={`nav ${menu ? "open" : ""}`}>
        <NavLink to="/">Home</NavLink><NavLink to="/products">Shop</NavLink><a href="#categories">Categories</a><a href="#footer">Support</a>
      </nav>
      <div className="header-actions"><button className="icon-button" aria-label="Saved items"><Icon name="heart" /><span>{cart.wishlist.length}</span></button><Link className="icon-button" to="/cart" aria-label="Shopping cart"><Icon name="cart" /><span>{cart.count}</span></Link><button className="menu-button" onClick={() => setMenu(!menu)}><Icon name="menu" /></button></div>
    </header>
    <main><Outlet /></main>
    <footer id="footer" className="footer"><div><Link className="brand footer-brand" to="/"><span className="brand-mark">EA</span><span>Easy<span>Cart</span></span></Link><p>A modern marketplace built around quality products, transparent stock, and a checkout you can trust.</p></div><div><h4>Shop</h4><Link to="/products">All products</Link><Link to="/products?sort=featured">Featured</Link><Link to="/products?sort=newest">New arrivals</Link></div><div><h4>Help</h4><a href="mailto:support@easycart.com">Contact us</a><a href="#shipping">Shipping & returns</a><a href="#privacy">Privacy</a></div><div><h4>Stay connected</h4><p>Get useful offers, not inbox clutter.</p><form className="footer-form"><input type="email" placeholder="Email address" /><button>Join</button></form></div></footer>
  </div>;
}
