import { useState } from 'react'
import heroImage from './assets/marketplace-hero.png'
import './App.css'

const categories = [
  { icon: '⌁', name: 'Electronics', note: 'Smart essentials' },
  { icon: '◇', name: 'Fashion', note: 'New season' },
  { icon: '⌂', name: 'Home & living', note: 'Everyday comfort' },
  { icon: '✦', name: 'Beauty', note: 'Care for you' },
]

const benefits = [
  ['01', 'Curated quality', 'Products selected for quality, value, and everyday usefulness.'],
  ['02', 'Fast delivery', 'Reliable order handling with clear delivery updates.'],
  ['03', 'Secure shopping', 'Protected checkout and straightforward customer support.'],
]

function Icon({ name }: { name: 'search' | 'user' | 'heart' | 'cart' | 'arrow' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.2 3.3-6 8-6s7.3 1.8 8 6"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    cart: <><path d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return <div className="site-shell">
    <div className="announcement">Free delivery on eligible orders <span>Shop confidently. Delivered reliably.</span></div>
    <header className="header">
      <a className="brand" href="#" aria-label="E-Market home"><span className="brand-mark"><Icon name="cart" /></span><span>E<span>-Market</span></span></a>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle menu"><span/><span/></button>
      <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation">
        <a className="active" href="#new">New arrivals</a><a href="#categories">Categories</a><a href="#benefits">Why us</a><a href="#offers">Offers</a>
      </nav>
      <div className="header-actions">
        <button aria-label="Search"><Icon name="search" /></button><button aria-label="Account"><Icon name="user" /></button><button aria-label="Wishlist"><Icon name="heart" /></button><button className="cart-button" aria-label="Shopping cart"><Icon name="cart" /><b>0</b></button>
      </div>
    </header>

    <main>
      <section className="hero" id="new">
        <img src={heroImage} alt="A curated collection of electronics, fashion, home products and shopping essentials" />
        <div className="hero-content">
          <span className="eyebrow">A better way to shop</span>
          <h1>Everything you need,<br/><em>all in one place.</em></h1>
          <p>Discover thoughtfully selected products, honest value, and a shopping experience designed around you.</p>
          <div className="hero-actions"><a className="button primary" href="#categories">Explore products <Icon name="arrow" /></a><a className="text-link" href="#offers">View today’s offers</a></div>
          <div className="trust-row"><span><b>4.9</b> customer rating</span><span><b>100%</b> secure checkout</span></div>
        </div>
      </section>

      <section className="section categories" id="categories">
        <div className="section-heading"><div><span className="eyebrow">Browse the collection</span><h2>Shop by category</h2></div><a className="text-link" href="#all">View all categories <Icon name="arrow" /></a></div>
        <div className="category-grid">{categories.map((category, index) => <a className="category-card" href={`#category-${index}`} key={category.name}><span className="category-index">0{index + 1}</span><div className="category-icon">{category.icon}</div><div><h3>{category.name}</h3><p>{category.note}</p></div><Icon name="arrow" /></a>)}</div>
      </section>

      <section className="feature-band" id="offers">
        <div><span className="eyebrow light">Limited selection</span><h2>Smart finds.<br/>Better prices.</h2><p>Seasonal offers across customer favorites, while stock lasts.</p><a className="button white" href="#deals">Shop current offers <Icon name="arrow" /></a></div>
        <div className="offer-stat"><strong>Up to<br/><span>30%</span></strong><small>off selected products</small></div>
      </section>

      <section className="section benefits" id="benefits">
        <div className="section-heading"><div><span className="eyebrow">Made for modern shopping</span><h2>More confidence in every order</h2></div><p>From discovery to delivery, every detail is designed to keep shopping simple.</p></div>
        <div className="benefit-grid">{benefits.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="newsletter"><div><span className="eyebrow">Stay in the know</span><h2>Good things, delivered.</h2><p>New products, useful inspiration, and members-only offers.</p></div><form onSubmit={(event) => event.preventDefault()}><label className="sr-only" htmlFor="email">Email address</label><input id="email" type="email" placeholder="Your email address"/><button type="submit">Join us <Icon name="arrow" /></button></form></section>
    </main>

    <footer><a className="brand inverse" href="#"><span className="brand-mark"><Icon name="cart" /></span><span>E<span>-Market</span></span></a><p>Quality products. Clear choices. Reliable delivery.</p><div><a href="#help">Help center</a><a href="#delivery">Delivery</a><a href="#returns">Returns</a><a href="#privacy">Privacy</a></div><small>© 2026 E-Market. All rights reserved.</small></footer>
  </div>
}

export default App
