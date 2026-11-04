/* orders.js - checkout page (orders.html) and customer dashboard (dashboard.html) */
(function () {
  const { api, esc, money, fmtDate, getCart, saveCart, toast, requireLogin, setFieldError, showFormMsg } = window.Shop;

  /* ---------- Checkout / place order ---------- */
  const form = document.getElementById('order-form');
  if (form) {
    const summaryBox = document.getElementById('order-summary');
    const msg = document.getElementById('form-msg');
    let items = [];

    (async () => {
      const user = await requireLogin();
      if (!user) return;
      form.customer_name.value = user.full_name;
      form.customer_email.value = user.email;
      form.contact_phone.value = user.phone;

      if (getCart().length === 0) {
        document.getElementById('checkout-wrap').innerHTML = '<div class="empty card"><span class="emoji">🛒</span><p>Your cart is empty.</p><p><a class="btn" href="cakes.html">Browse cakes</a></p></div>';
        return;
      }
      try {
        const { cakes } = await api('/cakes');
        const map = Object.fromEntries(cakes.map((c) => [c.id, c]));
        items = getCart().filter((i) => map[i.id]).map((i) => ({ ...i, cake: map[i.id] }));
        let total = 0;
        summaryBox.innerHTML = items.map((i) => {
          const line = i.cake.price * i.qty; total += line;
          return `<div class="summary-row"><span>${esc(i.cake.name)} × ${i.qty}</span><span>${money(line)}</span></div>`;
        }).join('') + `<div class="summary-row total"><span>Total</span><span>${money(total)}</span></div>`;
      } catch (err) {
        summaryBox.innerHTML = `<p class="muted">⚠️ ${esc(err.message)}</p>`;
      }
    })();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const addr = form.delivery_address.value.trim();
      const phone = form.contact_phone.value.trim();
      let ok = true;
      if (addr.length < 10) { setFieldError(form.delivery_address, 'Please enter your complete delivery address.'); ok = false; } else setFieldError(form.delivery_address, '');
      if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) { setFieldError(form.contact_phone, 'Enter a valid phone number.'); ok = false; } else setFieldError(form.contact_phone, '');
      if (!items.length) { showFormMsg(msg, 'Your cart is empty.', 'error'); ok = false; }
      if (!ok) return;

      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Placing order…';
      try {
        const res = await api('/orders', {
          method: 'POST',
          body: {
            items: items.map((i) => ({ cake_id: i.id, quantity: i.qty })),
            delivery_address: addr,
            contact_phone: phone,
            notes: form.notes.value.trim(),
          },
        });
        saveCart([]);
        showFormMsg(msg, `Order #${res.order_id} placed! Redirecting to your account…`, 'success');
        setTimeout(() => (location.href = 'dashboard.html'), 1500);
      } catch (err) {
        showFormMsg(msg, err.message, 'error');
        btn.disabled = false; btn.textContent = 'Place Order';
        if (err.status === 401) setTimeout(() => (location.href = 'login.html?next=orders.html'), 1200);
      }
    });
  }

  /* ---------- Customer dashboard ---------- */
  const ordersBox = document.getElementById('my-orders');
  if (ordersBox) {
    (async () => {
      const user = await requireLogin();
      if (!user) return;

      document.getElementById('profile').innerHTML = `
        <div class="avatar">${esc(user.full_name.charAt(0).toUpperCase())}</div>
        <h2>${esc(user.full_name)}</h2>
        <span class="badge">${user.role === 'admin' ? 'Administrator' : 'Customer'}</span>
        <dl>
          <dt>Email</dt><dd>${esc(user.email)}</dd>
          <dt>Phone</dt><dd>${esc(user.phone)}</dd>
          <dt>Member since</dt><dd>${esc(new Date(user.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }))}</dd>
        </dl>`;

      ordersBox.innerHTML = '<div class="spinner">Loading your orders…</div>';
      try {
        const { orders } = await api('/orders/my');
        if (!orders.length) {
          ordersBox.innerHTML = '<div class="empty"><span class="emoji">🧁</span><p>You have not placed any orders yet.</p><p><a class="btn" href="cakes.html">Order your first cake</a></p></div>';
          return;
        }
        ordersBox.innerHTML = orders.map((o) => `
          <div class="order-card">
            <div class="order-head">
              <strong>Order #${o.id}</strong>
              <span class="badge ${esc(o.status)}">${esc(o.status)}</span>
            </div>
            <div class="muted">${esc(fmtDate(o.created_at))}</div>
            <ul>${o.items.map((i) => `<li>${esc(i.name)} × ${i.quantity} — ${money(i.unit_price * i.quantity)}</li>`).join('')}</ul>
            <div class="muted">📍 ${esc(o.delivery_address)}</div>
            <div class="summary-row total"><span>Total</span><span>${money(o.total_amount)}</span></div>
          </div>`).join('');
      } catch (err) {
        ordersBox.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`;
        toast(err.message, 'error');
      }
    })();
  }
})();
