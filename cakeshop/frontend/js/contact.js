/* contact.js - validates the home page contact form and hands it to the visitor's email app.
   (There is no server-side contact endpoint, so nothing is stored.) */
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const { setFieldError, toast } = window.Shop;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    const check = (input, cond, text) => { if (!cond) { setFieldError(input, text); ok = false; } else setFieldError(input, ''); };
    check(form.name, form.name.value.trim().length >= 2, 'Please enter your name.');
    check(form.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim()), 'Enter a valid email.');
    check(form.message, form.message.value.trim().length >= 5, 'Please write a short message.');
    if (!ok) return;

    const subject = encodeURIComponent('Enquiry from ' + form.name.value.trim());
    const body = encodeURIComponent(form.message.value.trim() + '\n\nReply to: ' + form.email.value.trim());
    window.location.href = `mailto:hello@sweetcrumbs.example?subject=${subject}&body=${body}`;
    toast('Opening your email app…');
  });
})();
