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

// ===== Community carousel =====
// Slides live in the markup. If none are present the whole section stays hidden,
// so the page never shows an empty frame while photos are still being added.
(function () {
  const gallery = document.querySelector('.gallery');
  if (!gallery) return;

  const section = gallery.closest('section');
  const track = gallery.querySelector('.gallery-track');
  const slides = Array.from(gallery.querySelectorAll('.gallery-slide'));

  if (!slides.length) {
    if (section) section.hidden = true;
    return;
  }

  const dotsWrap = gallery.querySelector('.gallery-dots');
  const counter = gallery.querySelector('.gallery-count');
  const prev = gallery.querySelector('.gallery-prev');
  const next = gallery.querySelector('.gallery-next');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let timer = null;

  // A single slide needs no controls.
  if (slides.length < 2) {
    [prev, next, dotsWrap, counter].forEach((el) => el && el.remove());
    return;
  }

  slides.forEach((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to photo ${i + 1} of ${slides.length}`);
    dot.addEventListener('click', () => { go(i); restart(); });
    dotsWrap.appendChild(dot);
  });

  const dots = Array.from(dotsWrap.children);

  // A slide shifted out of frame by translateX never intersects the viewport, so
  // native lazy-loading would leave it blank forever. Promote the current slide
  // and its neighbours to eager as soon as they're needed.
  function preload(i) {
    [i - 1, i, i + 1].forEach((n) => {
      const slide = slides[(n + slides.length) % slides.length];
      slide.querySelectorAll('img[loading="lazy"]').forEach((img) => {
        img.loading = 'eager';
      });
    });
  }

  function go(next_i) {
    index = (next_i + slides.length) % slides.length;
    preload(index);
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, i) => {
      s.setAttribute('aria-hidden', String(i !== index));
      // Keep off-screen slides out of the tab order.
      s.querySelectorAll('a, button').forEach((el) => {
        el.tabIndex = i === index ? 0 : -1;
      });
    });
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
  }

  function restart() {
    if (reduced) return;
    clearInterval(timer);
    timer = setInterval(() => go(index + 1), 6000);
  }

  prev.addEventListener('click', () => { go(index - 1); restart(); });
  next.addEventListener('click', () => { go(index + 1); restart(); });

  // Keyboard, only when the carousel has focus within it.
  gallery.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(index - 1); restart(); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); go(index + 1); restart(); }
  });

  // Pause while the visitor is looking at or interacting with it.
  ['mouseenter', 'focusin'].forEach((e) => gallery.addEventListener(e, () => clearInterval(timer)));
  ['mouseleave', 'focusout'].forEach((e) => gallery.addEventListener(e, restart));

  // Don't animate in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(timer); else restart();
  });

  // Touch swipe.
  let startX = 0, startY = 0, tracking = false;
  const viewport = gallery.querySelector('.gallery-viewport');
  viewport.addEventListener('touchstart', (ev) => {
    startX = ev.touches[0].clientX;
    startY = ev.touches[0].clientY;
    tracking = true;
    clearInterval(timer);
  }, { passive: true });
  viewport.addEventListener('touchend', (ev) => {
    if (!tracking) return;
    tracking = false;
    const dx = ev.changedTouches[0].clientX - startX;
    const dy = ev.changedTouches[0].clientY - startY;
    // Ignore mostly-vertical drags so page scrolling still works.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
    restart();
  }, { passive: true });

  go(0);
  restart();
})();

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

// Certification logos degrade to a mono badge if the image file is missing.
document.querySelectorAll('.cert-logo[data-fallback]').forEach((img) => {
  img.addEventListener('error', () => {
    const badge = document.createElement('span');
    badge.className = 'cert-mono';
    badge.textContent = img.dataset.fallback;
    img.replaceWith(badge);
  }, { once: true });
});

// Cinematic hero backdrop.
// The clip is short and does not loop seamlessly on its own, so we drive the
// loop by hand: fade in over the first 0.5s, fade out over the last 0.5s, then
// hold at zero for a beat before rewinding. The seam lands while it is invisible.
(function () {
  const video = document.querySelector('[data-cinema]');
  if (!video) return;

  const FADE = 0.5;          // seconds of fade at each end
  const RESET_HOLD = 100;    // ms held at zero before rewinding

  // Skip the clip entirely where it would cost more than it gives. Reduced
  // motion and metered connections are settled once; width is not, because a
  // window can be resized or a tablet rotated mid-visit.
  const conn = navigator.connection;
  const thrifty = conn && (conn.saveData === true || /2g/.test(conn.effectiveType || ''));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || thrifty) return;

  const wide = window.matchMedia('(min-width: 901px)');
  const toggle = document.querySelector('[data-cinema-toggle]');

  let raf = 0;
  let visible = true;    // is the hero on screen
  let wanted = true;     // whether we *intend* it to be running right now
  let userPaused = false; // an explicit choice, which outranks everything below
  let loaded = false;

  const tick = () => {
    const t = video.currentTime;
    const d = video.duration;
    if (d && Number.isFinite(d)) {
      const rising = Math.min(t / FADE, 1);
      const falling = Math.min((d - t) / FADE, 1);
      video.style.opacity = String(Math.max(0, Math.min(rising, falling)));
    }
    raf = requestAnimationFrame(tick);
  };

  const startLoop = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
  const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
  const play = () => video.play().catch(() => {});
  const playable = () => loaded && !userPaused && visible && !document.hidden && wide.matches;

  const pause = () => { wanted = false; video.pause(); stopLoop(); };
  const resume = () => {
    if (!playable()) return;
    wanted = true;
    play();
    startLoop();
  };

  video.addEventListener('playing', startLoop);

  video.addEventListener('ended', () => {
    video.style.opacity = '0';
    setTimeout(() => {
      video.currentTime = 0;
      if (playable()) play();
    }, RESET_HOLD);
  });

  // Chrome suspends muted, video-only media when the window drops out of focus
  // and does not restart it on its own. An immediate play() gets rejected too,
  // so give it a beat before asking again.
  video.addEventListener('pause', () => {
    if (!wanted || video.ended || !playable()) return;
    setTimeout(() => { if (wanted && video.paused && !video.ended && playable()) play(); }, 200);
  });

  // Don't burn frames on a hero nobody is looking at.
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; visible ? resume() : pause(); },
    { threshold: 0.01 }
  ).observe(video);

  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
  // Refocusing a window fires no visibilitychange, so recover here too.
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);

  // Fetch only once everything above the fold has settled. The markup ships
  // preload="none" so the clip never competes with LCP; it is promoted to
  // "auto" here, at the point we actually want the bytes.
  const load = () => {
    if (loaded || !wide.matches) return;
    loaded = true;
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
    if (toggle) toggle.hidden = false;   // only offer the control once there is something to control
    resume();                            // respects scroll position and tab state
  };

  // Crossing the width threshold either way is handled live, so a resized
  // window neither keeps decoding a clip it should have dropped nor stays
  // stuck without one it now qualifies for.
  wide.addEventListener('change', () => {
    if (wide.matches) { loaded ? resume() : load(); }
    else { pause(); if (toggle) toggle.hidden = true; }
  });

  // WCAG 2.2.2 — motion that starts on its own and loops needs a way to stop it.
  if (toggle) {
    const sync = () => {
      toggle.setAttribute('aria-pressed', String(userPaused));
      toggle.setAttribute('aria-label', userPaused ? 'Play background video' : 'Pause background video');
    };
    toggle.addEventListener('click', () => {
      userPaused = !userPaused;
      if (userPaused) pause(); else resume();
      sync();
    });
    sync();
  }

  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load, { once: true });
})();
