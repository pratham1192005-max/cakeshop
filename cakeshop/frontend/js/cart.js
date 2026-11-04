/* cart.js - shopping cart page. The browser stores only {id, qty}; names and prices are fetched
   from the API so a user cannot tamper with prices. */
(function () {
  const list = document.getElementById('cart-items');
  if (!list) return;
  const { api, esc, money, getCart, saveCart, toast } = window.Shop;
  const summary = document.getElementById('cart-summary');
  let cakes = {};

  function render() {
    const cart = getCart().filter((i) => cakes[i.id]); // drop cakes that no longer exist
    if (cart.length !== getCart().length) saveCart(cart);

    if (cart.length === 0) {
      list.innerHTML = '<div class="empty"><span class="emoji">🛒</span><p>Your cart is empty.</p><p><a class="btn" href="cakes.html">Browse cakes</a></p></div>';
      summary.classList.add('hidden');
      return;
    }
    summary.classList.remove('hidden');

    let subtotal = 0, count = 0;
    list.innerHTML = cart.map((i) => {
      const c = cakes[i.id];
      const line = c.price * i.qty;
      subtotal += line; count += i.qty;
      const thumb = c.image_url ? `<img src="${esc(c.image_url)}" alt="${esc(c.name)}" data-fallback="1">` : '🎂';
      return `
        <div class="cart-item" data-id="${c.id}">
          <div class="thumb">${thumb}</div>
          <div>
            <strong>${esc(c.name)}</strong>
            <div class="muted">${money(c.price)} each</div>
            <div class="qty">
              <button data-act="dec" aria-label="Decrease">−</button><span>${i.qty}</span><button data-act="inc" aria-label="Increase">+</button>
            </div><br>
            <button class="link-btn" data-act="remove">Remove</button>
          </div>
          <div class="line-total price">${money(line)}</div>
        </div>`;
    }).join('');

    document.getElementById('sum-count').textContent = count;
    document.getElementById('sum-subtotal').textContent = money(subtotal);
    document.getElementById('sum-total').textContent = money(subtotal);
    window.Shop.updateCartBadge();
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.cart-item').dataset.id);
    let cart = getCart();
    const line = cart.find((i) => i.id === id);
    if (!line) return;
    if (btn.dataset.act === 'inc') line.qty = Math.min(20, line.qty + 1);
    if (btn.dataset.act === 'dec') line.qty = Math.max(1, line.qty - 1);
    if (btn.dataset.act === 'remove') cart = cart.filter((i) => i.id !== id);
    saveCart(cart);
    render();
  });

  document.getElementById('clear-cart').addEventListener('click', () => { saveCart([]); render(); toast('Cart cleared'); });

  list.innerHTML = '<div class="spinner">Loading your cart…</div>';
  api('/cakes')
    .then(({ cakes: all }) => { cakes = Object.fromEntries(all.map((c) => [c.id, c])); render(); })
    .catch((err) => { list.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; });
})();
