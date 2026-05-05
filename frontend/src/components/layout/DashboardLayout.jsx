import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, BarChart2, MessageCircle, Settings, LogOut, Zap, Megaphone, Ticket } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders',     icon: ShoppingBag,      label: 'Orders' },
  { to: '/products',   icon: Package,          label: 'Products' },
  { to: '/coupons',    icon: Ticket,           label: 'Coupons' },
  { to: '/customers',  icon: Users,            label: 'Customers' },
  { to: '/analytics',  icon: BarChart2,        label: 'Analytics' },
  { to: '/campaigns',  icon: Megaphone,        label: 'Campaigns' },
  { to: '/whatsapp',   icon: MessageCircle,    label: 'WhatsApp' },
  { to: '/settings',   icon: Settings,         label: 'Settings' },
];

export default function DashboardLayout() {
  const { business, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">OneServe</span>
          </div>
          {/* Business name */}
          <p className="text-xs text-gray-400 mt-1 truncate">{business?.name}</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Plan badge + logout */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`badge ${business?.plan === 'pro' ? 'bg-purple-100 text-purple-700' : business?.plan === 'basic' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
              {(business?.plan || 'free').toUpperCase()}
            </span>
            {business?.plan === 'free' && (
              <NavLink to="/settings" className="text-xs text-brand-600 hover:underline">Upgrade</NavLink>
            )}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
