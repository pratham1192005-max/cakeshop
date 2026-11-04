/* admin.js - admin dashboard: cakes CRUD, users list, orders list + status updates */
(function () {
  if (!document.getElementById('admin-root')) return;
  const { api, esc, money, fmtDate, toast, requireLogin, setFieldError } = window.Shop;
  const STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  /* ---------- Tabs ---------- */
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('btn-outline', x !== b));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
  }));

  /* ---------- Stats ---------- */
  async function loadStats() {
    const s = await api('/admin/stats');
    document.getElementById('stats').innerHTML = `
      <div class="stat"><strong>${s.orders}</strong>Orders</div>
      <div class="stat"><strong>${money(s.revenue)}</strong>Revenue (excl. cancelled)</div>
      <div class="stat"><strong>${s.customers}</strong>Customers</div>
      <div class="stat"><strong>${s.cakes}</strong>Cakes</div>`;
  }

  /* ---------- Cakes ---------- */
  const cakeForm = document.getElementById('cake-form');
  const cakeBody = document.getElementById('cakes-body');
  let cakes = [];

  async function loadCakes() {
    cakes = (await api('/admin/cakes')).cakes;
    cakeBody.innerHTML = cakes.map((c) => `
      <tr>
        <td>${c.id}</td>
        <td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.category)}</span></td>
        <td>${money(c.price)}</td>
        <td>${c.is_featured ? '⭐' : ''}</td>
        <td>${c.is_available ? '<span class="badge Delivered">Visible</span>' : '<span class="badge Cancelled">Hidden</span>'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" data-edit="${c.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${c.id}">Delete</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">No cakes yet.</td></tr>';
  }

  function resetCakeForm() {
    cakeForm.reset();
    cakeForm.cake_id.value = '';
    document.getElementById('cake-form-title').textContent = 'Add a new cake';
    document.getElementById('cake-submit').textContent = 'Add Cake';
    document.getElementById('cake-cancel').classList.add('hidden');
    cakeForm.is_available.checked = true;
  }

  cakeBody.addEventListener('click', async (e) => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (edit) {
      const c = cakes.find((x) => x.id === Number(edit.dataset.edit));
      cakeForm.cake_id.value = c.id;
      cakeForm.name.value = c.name;
      cakeForm.category.value = c.category;
      cakeForm.price.value = c.price;
      cakeForm.image_url.value = c.image_url || '';
      cakeForm.description.value = c.description;
      cakeForm.is_featured.checked = !!c.is_featured;
      cakeForm.is_available.checked = !!c.is_available;
      document.getElementById('cake-form-title').textContent = `Edit cake #${c.id}`;
      document.getElementById('cake-submit').textContent = 'Save Changes';
      document.getElementById('cake-cancel').classList.remove('hidden');
      cakeForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (del) {
      const c = cakes.find((x) => x.id === Number(del.dataset.del));
      if (!confirm(`Delete "${c.name}"?`)) return;
      try {
        const r = await api('/cakes/' + c.id, { method: 'DELETE' });
        toast(r.message, 'success');
        await Promise.all([loadCakes(), loadStats()]);
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  document.getElementById('cake-cancel').addEventListener('click', resetCakeForm);

  cakeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = cakeForm;
    let ok = true;
    const check = (input, cond, text) => { if (!cond) { setFieldError(input, text); ok = false; } else setFieldError(input, ''); };
    check(f.name, f.name.value.trim().length >= 2, 'Name is required.');
    check(f.price, f.price.value !== '' && Number(f.price.value) >= 0, 'Enter a valid price.');
    check(f.description, f.description.value.trim().length >= 5, 'Description is required (min 5 characters).');
    if (!ok) return;

    const id = f.cake_id.value;
    const body = {
      name: f.name.value.trim(), category: f.category.value.trim() || 'Classic', price: Number(f.price.value),
      image_url: f.image_url.value.trim(), description: f.description.value.trim(),
      is_featured: f.is_featured.checked, is_available: f.is_available.checked,
    };
    try {
      const r = await api(id ? '/cakes/' + id : '/cakes', { method: id ? 'PUT' : 'POST', body });
      toast(r.message, 'success');
      resetCakeForm();
      await Promise.all([loadCakes(), loadStats()]);
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---------- Users ---------- */
  async function loadUsers() {
    const { users } = await api('/admin/users');
    document.getElementById('users-body').innerHTML = users.map((u) => `
      <tr><td>${u.id}</td><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td>
      <td><span class="badge">${esc(u.role)}</span></td><td>${esc(fmtDate(u.created_at))}</td></tr>`).join('');
  }

  /* ---------- Orders ---------- */
  async function loadOrders() {
    const { orders } = await api('/admin/orders');
    document.getElementById('orders-body').innerHTML = orders.map((o) => `
      <tr>
        <td>#${o.id}<br><span class="muted">${esc(fmtDate(o.created_at))}</span></td>
        <td>${esc(o.customer_name)}<br><span class="muted">${esc(o.customer_email)}<br>${esc(o.contact_phone)}</span></td>
        <td>${o.items.map((i) => `${esc(i.name)} × ${i.quantity}`).join('<br>')}<br><span class="muted">📍 ${esc(o.delivery_address)}</span></td>
        <td>${money(o.total_amount)}</td>
        <td>
          <select data-order="${o.id}" aria-label="Order status">
            ${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">No orders yet.</td></tr>';
  }

  document.getElementById('orders-body').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-order]');
    if (!sel) return;
    try {
      await api(`/admin/orders/${sel.dataset.order}/status`, { method: 'PUT', body: { status: sel.value } });
      toast(`Order #${sel.dataset.order} → ${sel.value}`, 'success');
    } catch (err) { toast(err.message, 'error'); loadOrders(); }
  });

  /* ---------- Boot ---------- */
  (async () => {
    const user = await requireLogin(true);
    if (!user) return;
    document.getElementById('admin-root').classList.remove('hidden');
    try {
      await Promise.all([loadStats(), loadCakes(), loadUsers(), loadOrders()]);
    } catch (err) { toast(err.message, 'error'); }
  })();
})();
