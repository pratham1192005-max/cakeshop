/* main.js - shared helpers, navbar/footer, cart storage, API wrapper.
   Loaded first on every page. Everything is exposed on window.Shop. */
(function () {
  const API = '/api';
  const CART_KEY = 'cakeshop_cart';
  let currentUser; // undefined = not fetched yet, null = logged out

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  /* ---------- API wrapper (same-origin, cookie auth) ---------- */
  async function api(path, options = {}) {
    const opts = { credentials: 'same-origin', headers: {}, ...options };
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    let res;
    try {
      res = await fetch(API + path, opts);
    } catch (e) {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- Toast ---------- */
  function toast(message, type = '') {
    let host = document.getElementById('toast-host');
    if (!host) { host = document.createElement('div'); host.id = 'toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = message;
    host.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* ---------- Cart (localStorage: only ids + quantities, prices come from the server) ---------- */
  function getCart() {
    try {
      const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(c) ? c.filter((i) => Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty > 0) : [];
    } catch (_) { return []; }
  }
  function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartBadge(); }
  function addToCart(id, qty = 1) {
    const cart = getCart();
    const line = cart.find((i) => i.id === id);
    if (line) line.qty = Math.min(20, line.qty + qty); else cart.push({ id, qty });
    saveCart(cart);
  }
  function cartCount() { return getCart().reduce((n, i) => n + i.qty, 0); }
  function updateCartBadge() {
    const b = document.getElementById('cart-badge');
    if (b) { const n = cartCount(); b.textContent = n; b.classList.toggle('hidden', n === 0); }
  }

  /* ---------- Current user ---------- */
  async function getUser(force = false) {
    if (currentUser !== undefined && !force) return currentUser;
    try { currentUser = (await api('/auth/me')).user; } catch (_) { currentUser = null; }
    return currentUser;
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
    currentUser = null;
    location.href = 'index.html';
  }

  /* Redirect helpers for protected pages */
  async function requireLogin(adminOnly = false) {
    const u = await getUser();
    if (!u) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html'); return null; }
    if (adminOnly && u.role !== 'admin') { toast('Admin access required.', 'error'); setTimeout(() => (location.href = 'index.html'), 800); return null; }
    return u;
  }

  /* ---------- Navbar + footer ---------- */
  async function renderChrome() {
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    const active = (header && header.dataset.active) || '';
    const user = await getUser();
    const link = (href, label, key, extra = '') => `<li><a href="${href}" class="${active === key ? 'active' : ''}">${label}${extra}</a></li>`;

    if (header) {
      header.className = 'navbar';
      header.innerHTML = `
        <div class="container nav-inner">
          <a href="index.html" class="brand">🎂 Sweet Crumbs</a>
          <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">☰</button>
          <ul class="nav-links" id="nav-links">
            ${link('index.html', 'Home', 'home')}
            ${link('cakes.html', 'Cakes', 'cakes')}
            ${link('cart.html', 'Cart', 'cart', '<span class="cart-badge hidden" id="cart-badge">0</span>')}
            ${user ? link('dashboard.html', 'My Account', 'dashboard') : ''}
            ${user && user.role === 'admin' ? link('admin.html', 'Admin', 'admin') : ''}
            ${user
              ? '<li><a href="#" id="logout-link">Logout</a></li>'
              : link('login.html', 'Login', 'login') + '<li><a href="register.html" class="btn btn-sm">Sign up</a></li>'}
          </ul>
        </div>`;
      document.getElementById('nav-toggle').addEventListener('click', () => document.getElementById('nav-links').classList.toggle('open'));
      const lo = document.getElementById('logout-link');
      if (lo) lo.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    }

    if (footer) {
      footer.className = 'footer';
      footer.innerHTML = `
        <div class="container footer-grid">
          <div><h4>🎂 Sweet Crumbs</h4><p>Freshly baked cakes for every celebration, delivered to your door.</p></div>
          <div><h4>Shop</h4><a href="cakes.html">All cakes</a><a href="cakes.html?category=Chocolate">Chocolate</a><a href="cakes.html?category=Fruit">Fruit</a></div>
          <div><h4>Account</h4><a href="login.html">Login</a><a href="register.html">Register</a><a href="dashboard.html">My orders</a></div>
        </div>
        <div class="footer-bottom">© ${new Date().getFullYear()} Sweet Crumbs Bakery. All rights reserved.</div>`;
    }
    updateCartBadge();
  }

  /* ---------- Cake card HTML (used on home + cakes page) ---------- */
  function cakeCard(c) {
    const img = c.image_url
      ? `<img src="${esc(c.image_url)}" alt="${esc(c.name)}" loading="lazy" data-fallback="1">`
      : '🎂';
    return `
      <article class="cake-card">
        <div class="cake-img">${img}</div>
        <div class="cake-body">
          <span class="cake-tag">${esc(c.category)}</span>
          <h3>${esc(c.name)}</h3>
          <p class="cake-desc">${esc(c.description)}</p>
          <div class="cake-foot">
            <span class="price">${money(c.price)}</span>
            <button class="btn btn-sm add-to-cart" data-id="${c.id}" data-name="${esc(c.name)}">Add to Cart</button>
          </div>
        </div>
      </article>`;
  }

  /* One delegated listener handles every "Add to Cart" button on the page */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn) return;
    addToCart(Number(btn.dataset.id), 1);
    toast(`${btn.dataset.name} added to cart 🛒`, 'success');
  });

  /* Broken image -> show a cake emoji (inline onerror is blocked by our CSP, so we listen in capture phase) */
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.dataset.fallback) {
      el.parentElement.textContent = '🎂';
    }
  }, true);

  /* ---------- Form helpers ---------- */
  function setFieldError(input, message) {
    const group = input.closest('.form-group');
    if (!group) return;
    let err = group.querySelector('.field-error');
    if (!err) { err = document.createElement('div'); err.className = 'field-error'; group.appendChild(err); }
    group.classList.toggle('invalid', !!message);
    err.textContent = message || '';
  }
  function showFormMsg(el, message, type) { el.className = 'form-msg ' + type; el.textContent = message; }

  window.Shop = {
    api, esc, money, fmtDate, toast,
    getCart, saveCart, addToCart, cartCount, updateCartBadge,
    getUser, logout, requireLogin, renderChrome, cakeCard,
    setFieldError, showFormMsg,
  };

  document.addEventListener('DOMContentLoaded', renderChrome);
})();
