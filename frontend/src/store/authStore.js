import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  business: null,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // No token at all — not logged in
      return set({ loading: false, business: null });
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ business: data.business, loading: false });
    } catch (err) {
      const status = err.response?.status;
      // Only clear token on explicit auth failures, not network errors
      if (status === 401 || status === 403) {
        localStorage.clear();
        set({ business: null, loading: false });
      } else {
        // Network error / server down — keep token, don't log out
        // Still allow through but mark not loading
        set({ loading: false });
      }
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ business: data.business });
    return data;
  },

  register: async (form) => {
    const { data } = await api.post('/auth/register', form);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ business: data.business });
    return data;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.clear();
    set({ business: null });
  },

  setBusiness: (business) => set({ business }),
}));

export default useAuthStore;
