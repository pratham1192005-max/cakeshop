/* auth.js - login and registration forms with client-side validation */
(function () {
  const { api, setFieldError, showFormMsg, getUser } = window.Shop;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

  function safeNext() {
    const n = new URLSearchParams(location.search).get('next');
    return n && /^[\w\-]+\.html$/.test(n) ? n : null; // only allow our own pages (no open redirect)
  }

  /* ---------- Login ---------- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    getUser().then((u) => { if (u) location.href = 'dashboard.html'; });
    const msg = document.getElementById('form-msg');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email, password = loginForm.password;
      let ok = true;
      if (!EMAIL_RE.test(email.value.trim())) { setFieldError(email, 'Enter a valid email address.'); ok = false; } else setFieldError(email, '');
      if (!password.value) { setFieldError(password, 'Password is required.'); ok = false; } else setFieldError(password, '');
      if (!ok) return;

      const btn = loginForm.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Logging in…';
      try {
        const data = await api('/auth/login', { method: 'POST', body: { email: email.value.trim(), password: password.value } });
        showFormMsg(msg, 'Login successful! Redirecting…', 'success');
        const dest = safeNext() || (data.user.role === 'admin' ? 'admin.html' : 'dashboard.html');
        setTimeout(() => (location.href = dest), 500);
      } catch (err) {
        showFormMsg(msg, err.message, 'error');
        btn.disabled = false; btn.textContent = 'Login';
      }
    });
  }

  /* ---------- Registration ---------- */
  const regForm = document.getElementById('register-form');
  if (regForm) {
    const msg = document.getElementById('form-msg');

    function validate() {
      const f = regForm;
      let ok = true;
      const check = (input, cond, text) => { if (!cond) { setFieldError(input, text); ok = false; } else setFieldError(input, ''); };
      check(f.full_name, f.full_name.value.trim().length >= 2, 'Please enter your full name.');
      check(f.email, EMAIL_RE.test(f.email.value.trim()), 'Enter a valid email address.');
      check(f.phone, PHONE_RE.test(f.phone.value.trim()), 'Enter a valid phone number (7-20 digits).');
      const pw = f.password.value;
      check(f.password, pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw), 'At least 8 characters with letters and numbers.');
      check(f.confirm_password, f.confirm_password.value === pw && pw.length > 0, 'Passwords do not match.');
      return ok;
    }

    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) return;
      const btn = regForm.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        await api('/auth/register', {
          method: 'POST',
          body: {
            full_name: regForm.full_name.value.trim(),
            email: regForm.email.value.trim(),
            phone: regForm.phone.value.trim(),
            password: regForm.password.value,
          },
        });
        showFormMsg(msg, 'Account created! Redirecting to login…', 'success');
        setTimeout(() => (location.href = 'login.html'), 1200);
      } catch (err) {
        showFormMsg(msg, err.message, 'error');
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    });
  }
})();
