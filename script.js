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

// Contact form: Netlify Forms when deployed, mailto fallback for local file://
const form = document.querySelector('.contact-form');
const isLocalFile = window.location.protocol === 'file:';
form?.addEventListener('submit', (ev) => {
  const status = form.querySelector('.form-status');
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.name || !data.email || !data.message) {
    ev.preventDefault();
    status.textContent = 'Please fill name, email, and message.';
    status.style.color = '#f472b6';
    return;
  }
  if (isLocalFile) {
    // No backend available locally — open user's mail client
    ev.preventDefault();
    const subject = encodeURIComponent(`New project inquiry — ${data.name}`);
    const body = encodeURIComponent(
      `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || '—'}\n\n${data.message}`
    );
    window.location.href = `mailto:lemuelduyag@gmail.com?subject=${subject}&body=${body}`;
    status.textContent = 'Opening your email client…';
    status.style.color = '';
    form.reset();
    return;
  }
  // Otherwise let Netlify Forms handle the POST natively
  status.textContent = 'Sending…';
});

// Show thank-you note when Netlify redirects back with ?submitted=true
if (new URLSearchParams(location.search).get('submitted') === 'true') {
  const status = document.querySelector('.form-status');
  if (status) {
    status.textContent = '✓ Message sent — I’ll reply within one business day.';
    status.style.color = '#22d3ee';
  }
}

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
