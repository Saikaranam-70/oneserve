import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import ProductsPage from './pages/ProductsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import WhatsAppPage from './pages/WhatsAppPage';
import SettingsPage from './pages/SettingsPage';
import CustomersPage from './pages/CustomersPage';
import CampaignsPage from './pages/CampaignsPage';
import CouponsPage from './pages/CouponsPage';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin w-9 h-9 border-4 border-brand-500 border-t-transparent rounded-full" />
      <p className="text-sm text-gray-400">Loading OneServe...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const business = useAuthStore(s => s.business);
  const loading = useAuthStore(s => s.loading);

  if (loading) return <Spinner />;

  // Check token directly as fallback — if token exists but business not loaded
  // yet (e.g. network was slow), don't boot them to login
  const hasToken = !!localStorage.getItem('accessToken');
  if (!business && !hasToken) return <Navigate to="/login" replace />;

  return children;
};

export default function App() {
  const init = useAuthStore(s => s.init);
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px' },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
