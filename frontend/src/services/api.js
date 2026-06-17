import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// แนบ token อัตโนมัติทุก request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// จัดการ 401 — token หมดอายุ/ไม่ถูกต้อง
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
};

// ── Assets ───────────────────────────────────────────
export const assetAPI = {
  getAll: (params) => api.get('/assets', { params }),
  getStats: () => api.get('/assets/stats'),
  getById: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
};

// ── Users ─────────────────────────────────────────────
export const userAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// ── Locations ─────────────────────────────────────────
export const locationAPI = {
  getAll: () => api.get('/locations'),
  move: (data) => api.post('/locations/move', data),
};

// ── Inventory ─────────────────────────────────────────
export const inventoryAPI = {
  getSessions: () => api.get('/inventory/sessions'),
  createSession: (data) => api.post('/inventory/sessions', data),
  updateSession: (id, data) => api.put(`/inventory/sessions/${id}`, data),
  getItems: (sessionId) => api.get(`/inventory/sessions/${sessionId}/items`),
  getSummary: (sessionId) => api.get(`/inventory/sessions/${sessionId}/summary`),
  closeSession: (sessionId) => api.put(`/inventory/sessions/${sessionId}/close`, {}),
  cancelSession: (sessionId) => api.put(`/inventory/sessions/${sessionId}/cancel`, {}),
  count: (data) => api.post('/inventory/count', data),
  deleteItem: (id) => api.delete(`/inventory/count/${id}`),
};

// ── Superadmin ────────────────────────────────────────
export const superadminAPI = {
  getRoles: () => api.get('/superadmin/roles'),
  updatePermissions: (roleId, data) => api.put(`/superadmin/roles/${roleId}`, data),
  getLogs: (params) => api.get('/superadmin/logs', { params }),
};

// ── Repair Requests ───────────────────────────────────
// POST   /repair-requests          สร้างคำขอซ่อมใหม่ (multipart/form-data รองรับรูปภาพ)
// GET    /repair-requests          ดึงรายการทั้งหมด (admin/superadmin)
// GET    /repair-requests/my       ดึงเฉพาะของตัวเอง (ทุก role)
// GET    /repair-requests/counts   ดึงจำนวนแยกตามสถานะ (ใช้แสดง badge)
// GET    /repair-requests/:id      ดึงรายละเอียด
// PATCH  /repair-requests/:id/status  อัปเดตสถานะ (admin/superadmin)
//
// Status flow: pending → approved | rejected
//              approved → completed | rejected
//              completed → returned
export const repairAPI = {
  // ผู้ใช้สร้างคำขอซ่อม — ส่ง FormData เพื่อรองรับรูปภาพ
  create: (formData) =>
    api.post('/repair-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // admin/superadmin ดึงรายการทั้งหมด
  // params: { status, urgency, asset_id, page, per_page }
  getAll: (params = {}) =>
    api.get('/repair-requests', { params }),

  // ดึงเฉพาะคำขอของตัวเอง (ทุก role)
  getMine: (params = {}) =>
    api.get('/repair-requests/my', { params }),

  // ดึงจำนวนแยกตามสถานะ → { pending, approved, completed, returned, rejected }
  getCounts: () =>
    api.get('/repair-requests/counts'),

  // ดึงรายละเอียด
  getById: (id) =>
    api.get(`/repair-requests/${id}`),

  // admin/superadmin อัปเดตสถานะ
  // data: { status: string, admin_note?: string }
  updateStatus: (id, data) =>
    api.patch(`/repair-requests/${id}/status`, data),
};

// ── Borrow Requests ───────────────────────────────────────────────────────────
export const borrowAPI = {
  create:       (data)       => api.post('/borrow-requests', data),
  getAll:       (params={})  => api.get('/borrow-requests', { params }),
  getMine:      (params={})  => api.get('/borrow-requests/my', { params }),
  getCounts:    ()           => api.get('/borrow-requests/counts'),
  getById:      (id)         => api.get(`/borrow-requests/${id}`),
  updateStatus: (id, data)   => api.patch(`/borrow-requests/${id}/status`, data),
};

export default api;