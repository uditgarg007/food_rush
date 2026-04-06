// public/js/api.js — Centralised API client

const API = (() => {
  const BASE = '/api';

  async function request(endpoint, options = {}) {
    const res = await fetch(BASE + endpoint, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    auth: {
      register: (d) => request('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
      login:    (d) => request('/auth/login',    { method: 'POST', body: JSON.stringify(d) }),
      logout:   ()  => request('/auth/logout',   { method: 'POST' }),
      me:       ()  => request('/auth/me'),
    },
    restaurants: {
      list:           (p = {}) => request('/restaurants?' + new URLSearchParams(p)),
      get:            (id)     => request(`/restaurants/${id}`),
      my:             ()       => request('/restaurants/my'),
      update:         (id, d)  => request(`/restaurants/${id}`,        { method: 'PUT',   body: JSON.stringify(d) }),
      toggle:         (id)     => request(`/restaurants/${id}/toggle`, { method: 'PATCH' }),
      addItem:        (id, d)  => request(`/restaurants/${id}/menu`,   { method: 'POST',  body: JSON.stringify(d) }),
      updateItem:     (rid, iid, d) => request(`/restaurants/${rid}/menu/${iid}`, { method: 'PUT', body: JSON.stringify(d) }),
      deleteItem:     (rid, iid)    => request(`/restaurants/${rid}/menu/${iid}`, { method: 'DELETE' }),
      toggleItem:     (rid, iid)    => request(`/restaurants/${rid}/menu/${iid}/toggle`, { method: 'PATCH' }),
    },
    orders: {
      place:        (d)  => request('/orders',      { method: 'POST',  body: JSON.stringify(d) }),
      list:         (p)  => request('/orders?' + new URLSearchParams(p || {})),
      get:          (id) => request(`/orders/${id}`),
      updateStatus: (id, status) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    },
    rider: {
      profile:         ()    => request('/rider/profile'),
      updateProfile:   (d)   => request('/rider/profile',               { method: 'PUT',   body: JSON.stringify(d) }),
      availableOrders: ()    => request('/rider/available-orders'),
      acceptOrder:     (id)  => request(`/rider/orders/${id}/accept`,   { method: 'POST' }),
      deliverOrder:    (id)  => request(`/rider/orders/${id}/deliver`,  { method: 'PATCH' }),
      history:         ()    => request('/rider/history'),
      toggleAvailability: () => request('/rider/availability',          { method: 'PATCH' }),
    },
    reviews: {
      create: (d)   => request('/reviews',            { method: 'POST', body: JSON.stringify(d) }),
      list:   (rid) => request(`/reviews/${rid}`),
    },
    categories: {
      list: () => request('/categories'),
    },
    addresses: {
      list:   ()    => request('/addresses'),
      save:   (d)   => request('/addresses', { method: 'POST', body: JSON.stringify(d) }),
      delete: (id)  => request(`/addresses/${id}`, { method: 'DELETE' }),
    },
  };
})();
