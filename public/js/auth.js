// public/js/auth.js — Auth helpers shared across all pages

// ── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'default', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', default: '' };
  el.textContent = (icons[type] ? icons[type] + ' ' : '') + msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 500); }, duration);
}

// ── Require authenticated user ────────────────────────────────
async function requireAuth(allowedRoles = []) {
  try {
    const user = await API.auth.me();
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      window.location.replace('/login.html');
      return null;
    }
    return user;
  } catch {
    window.location.replace('/login.html');
    return null;
  }
}

// ── Redirect if already logged in ────────────────────────────
async function redirectIfLoggedIn() {
  try {
    const user = await API.auth.me();
    redirectByRole(user.role);
  } catch { /* not logged in, stay */ }
}

function redirectByRole(role) {
  const map = {
    customer:          '/customer/dashboard.html',
    restaurant_owner:  '/restaurant/dashboard.html',
    rider:             '/rider/dashboard.html',
  };
  window.location.replace(map[role] || '/login.html');
}

// ── Set up logout button ──────────────────────────────────────
function setupLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await API.auth.logout(); } catch {}
      window.location.replace('/login.html');
    });
  });
}

// ── Format helpers ────────────────────────────────────────────
function formatCurrency(n) { return '₹' + parseFloat(n).toFixed(0); }

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function statusBadgeHtml(status) {
  const labels = {
    placed: '🕐 Placed', accepted: '✅ Accepted',
    preparing: '👨‍🍳 Preparing', ready: '📦 Ready for Pickup',
    out_for_delivery: '🛵 Out for Delivery',
    delivered: '✅ Delivered', cancelled: '❌ Cancelled',
  };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function ratingStars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// ── Stars input component ─────────────────────────────────────
function initStarRating(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let selected = 0;
  container.innerHTML = [1,2,3,4,5].map(n =>
    `<span class="star" data-val="${n}" style="font-size:1.8rem;cursor:pointer;color:#d4d5d9;transition:color 0.15s">★</span>`
  ).join('');
  const stars = container.querySelectorAll('.star');
  const update = (v) => stars.forEach(s => { s.style.color = parseInt(s.dataset.val) <= v ? '#fc8019' : '#d4d5d9'; });
  stars.forEach(s => {
    s.addEventListener('mouseover', () => update(parseInt(s.dataset.val)));
    s.addEventListener('mouseout',  () => update(selected));
    s.addEventListener('click',     () => { selected = parseInt(s.dataset.val); update(selected); container.dataset.value = selected; });
  });
  return () => selected;
}

// ── Cart (localStorage) ───────────────────────────────────────
const Cart = {
  KEY: 'fd_cart',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch { return null; } },
  set(cart) { localStorage.setItem(this.KEY, JSON.stringify(cart)); },
  clear() { localStorage.removeItem(this.KEY); },
  add(restaurantId, restaurantName, item) {
    let cart = this.get();
    if (cart && cart.restaurantId !== restaurantId) {
      if (!confirm(`Your cart has items from "${cart.restaurantName}". Clear and add from ${restaurantName}?`)) return false;
      cart = null;
    }
    if (!cart) cart = { restaurantId, restaurantName, items: [] };
    const existing = cart.items.find(i => i.id === item.id);
    if (existing) existing.quantity++;
    else cart.items.push({ ...item, quantity: 1 });
    this.set(cart);
    return true;
  },
  remove(itemId) {
    const cart = this.get();
    if (!cart) return;
    const idx = cart.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    if (cart.items[idx].quantity > 1) cart.items[idx].quantity--;
    else cart.items.splice(idx, 1);
    if (cart.items.length === 0) this.clear();
    else this.set(cart);
  },
  total() {
    const cart = this.get();
    if (!cart) return 0;
    return cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  },
  count() {
    const cart = this.get();
    if (!cart) return 0;
    return cart.items.reduce((s, i) => s + i.quantity, 0);
  },
};

// Init logout on every page load
document.addEventListener('DOMContentLoaded', setupLogout);
