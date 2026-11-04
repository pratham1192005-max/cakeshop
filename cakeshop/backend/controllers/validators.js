// Small input-validation helpers shared by the routes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validateRegistration(body) {
  const errors = [];
  const full_name = str(body.full_name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';

  if (full_name.length < 2 || full_name.length > 100) errors.push('Full name must be 2-100 characters.');
  if (!EMAIL_RE.test(email) || email.length > 150) errors.push('Enter a valid email address.');
  if (!PHONE_RE.test(phone)) errors.push('Enter a valid phone number.');
  if (password.length < 8 || password.length > 72) errors.push('Password must be 8-72 characters.');
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.push('Password must contain letters and numbers.');

  return { errors, values: { full_name, email, phone, password } };
}

function validateCake(body) {
  const errors = [];
  const name = str(body.name);
  const description = str(body.description);
  const category = str(body.category) || 'Classic';
  const price = Number(body.price);
  const image_url = str(body.image_url);
  const is_featured = body.is_featured ? 1 : 0;
  const is_available = body.is_available === undefined ? 1 : (body.is_available ? 1 : 0);

  if (name.length < 2 || name.length > 120) errors.push('Cake name must be 2-120 characters.');
  if (description.length < 5 || description.length > 2000) errors.push('Description must be 5-2000 characters.');
  if (category.length > 50) errors.push('Category is too long.');
  if (!Number.isFinite(price) || price < 0 || price > 1000000) errors.push('Enter a valid price.');
  if (image_url && !/^https?:\/\/.{3,}/i.test(image_url) && !/^\/[\w\-./]+$/.test(image_url)) {
    errors.push('Image URL must start with http(s):// or /.');
  }
  if (image_url.length > 500) errors.push('Image URL is too long.');

  return {
    errors,
    values: { name, description, category, price: Math.round(price * 100) / 100, image_url: image_url || null, is_featured, is_available },
  };
}

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

module.exports = { validateRegistration, validateCake, ORDER_STATUSES, EMAIL_RE, PHONE_RE, str };
