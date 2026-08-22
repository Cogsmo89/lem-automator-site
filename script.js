// Year
document.getElementById('year').textContent = new Date().getFullYear();

// Reveal on scroll — with a gentle stagger for items sharing a parent
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      const delay = Number(e.target.dataset.delay || 0);
      e.target.style.transitionDelay = `${delay}ms`;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

// Assign stagger delays to siblings within each grid/group, then observe.
const STAGGER = 70; // ms between siblings
const MAX_STAGGER = 6; // cap so long lists don't lag
document.querySelectorAll('[data-reveal]').forEach((el) => {
  const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
  if (siblings.length > 1) {
    const idx = Math.min(siblings.indexOf(el), MAX_STAGGER);
    el.dataset.delay = String(idx * STAGGER);
  }
  io.observe(el);
});

// Mobile menu
const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');
menuBtn?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
navLinks?.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  })
);

// Card spotlight (cursor-aware glow)
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('mousemove', (ev) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    card.style.setProperty('--my', `${ev.clientY - r.top}px`);
  });
});

// Tilt for cards (subtle 3D)
const tiltEls = document.querySelectorAll('.tilt');
tiltEls.forEach((el) => {
  el.addEventListener('mousemove', (ev) => {
    const r = el.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width - 0.5;
    const y = (ev.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-4px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
});

// Magnetic primary CTAs — subtle pull toward the cursor (pointer devices only)
const fine = window.matchMedia('(pointer: fine)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (fine && !reduceMotion) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = 0.28;
    el.addEventListener('mousemove', (ev) => {
      const r = el.getBoundingClientRect();
      const mx = ev.clientX - (r.left + r.width / 2);
      const my = ev.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${(mx * strength).toFixed(1)}px, ${(my * strength).toFixed(1)}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

// Back to top
const toTop = document.querySelector('.to-top');
window.addEventListener('scroll', () => {
  toTop?.classList.toggle('show', window.scrollY > 600);
}, { passive: true });

// Floating-label trick: ensure inputs have a placeholder so :not(:placeholder-shown) works
document.querySelectorAll('.field input, .field textarea').forEach((el) => {
  if (!el.hasAttribute('placeholder')) el.setAttribute('placeholder', ' ');
});

// Contact form: posts to the /api/contact serverless function.
// Falls back to the user's mail client when opened straight off disk (file://).
const form = document.querySelector('.contact-form');
const isLocalFile = window.location.protocol === 'file:';

form?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());

  const fail = (msg) => {
    status.textContent = msg;
    status.style.color = '#f472b6';
  };

  if (!data.name || !data.email || !data.message) {
    return fail('Please fill name, email, and message.');
  }

  if (isLocalFile) {
    // No backend available locally — open the user's mail client
    const subject = encodeURIComponent(`New project inquiry — ${data.name}`);
    const body = encodeURIComponent(
      `Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || '—'}

${data.message}`
    );
    window.location.href = `mailto:lemuelduyag@gmail.com?subject=${subject}&body=${body}`;
    status.textContent = 'Opening your email client…';
    status.style.color = '';
    form.reset();
    return;
  }

  status.textContent = 'Sending…';
  status.style.color = '';
  if (button) button.disabled = true;

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      fail(payload.error || 'Something went wrong. Please try again.');
      return;
    }

    status.textContent = '✓ Message sent — I’ll reply within one business day.';
    status.style.color = '#22d3ee';
    form.reset();
  } catch (err) {
    fail('Network error. Please try again, or email me directly.');
  } finally {
    if (button) button.disabled = false;
  }
});

// Smooth-scroll polish for anchor clicks (respects reduced motion)
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (ev) => {
    const id = a.getAttribute('href');
    if (id && id.length > 1) {
      const target = document.querySelector(id);
      if (target) {
        ev.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

// ===== Cookie consent banner =====
(function () {
  const KEY = 'lem-cookies-consent-v1';
  try {
    if (localStorage.getItem(KEY)) return;
  } catch (e) { /* localStorage may be blocked — show banner anyway */ }

  const banner = document.createElement('div');
  banner.className = 'cookie-banner glass';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie notice');
  banner.innerHTML = `
    <div class="cookie-icon" aria-hidden="true">🍪</div>
    <div class="cookie-text">
      <strong>We don't track you.</strong>
      Only essential cookies (security &amp; hosting) are used.
      <a href="cookies.html">Cookie details</a>
    </div>
    <div class="cookie-actions">
      <button type="button" class="btn btn-ghost cookie-dismiss" aria-label="Dismiss">No thanks</button>
      <button type="button" class="btn btn-primary cookie-accept" aria-label="Accept">Got it</button>
    </div>
    <button type="button" class="cookie-close" aria-label="Close">×</button>
  `;
  document.body.appendChild(banner);
  // Trigger entrance animation
  requestAnimationFrame(() => banner.classList.add('show'));

  function dismiss(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 400);
  }
  banner.querySelector('.cookie-accept').addEventListener('click', () => dismiss('accepted'));
  banner.querySelector('.cookie-dismiss').addEventListener('click', () => dismiss('dismissed'));
  banner.querySelector('.cookie-close').addEventListener('click', () => dismiss('dismissed'));
})();
