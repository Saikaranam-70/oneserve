import { useEffect, useState } from 'react';
import api from '../services/api';
import { ShoppingBag, TrendingUp, Users, Clock, ArrowUp, ArrowDown, Activity, Gift } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const StatCard = ({ icon: Icon, label, value, sub, growth, color = 'brand' }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center`}>
        <Icon size={20} className={`text-${color}-600`} />
      </div>
    </div>
    {growth !== undefined && (
      <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
        {growth >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        {Math.abs(growth)}% vs last month
      </div>
    )}
  </div>
);

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1>Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Here's what's happening today</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard icon={ShoppingBag}  label="Today's orders"   value={data?.today?.orders || 0}           sub={`₹${data?.today?.revenue || 0} revenue`} color="brand" />
        <StatCard icon={TrendingUp}   label="This month"       value={`₹${data?.thisMonth?.revenue || 0}`} growth={data?.thisMonth?.revenueGrowth}        color="blue" />
        <StatCard icon={Activity}     label="Avg Order Value"  value={`₹${data?.allTime?.aov?.toFixed(0) || 0}`} sub="Across all time"                 color="emerald" />
        <StatCard icon={Gift}         label="Discounts Given"  value={`₹${data?.allTime?.totalDiscount || 0}`}  sub="Total savings to customers"        color="rose" />
        <StatCard icon={Users}        label="Total customers"  value={data?.totalCustomers || 0}           color="purple" />
        <StatCard icon={Clock}        label="Pending orders"   value={data?.pendingOrders || 0}            sub="Needs attention" color="orange" />
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Recent Orders</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {data?.recentOrders?.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">No orders yet. Share your WhatsApp link to start receiving orders!</p>
          )}
          {data?.recentOrders?.map(order => (
            <div key={order._id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{order.orderId}</p>
                <p className="text-xs text-gray-400">{order.customer?.name} · {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">₹{order.total}</span>
                <span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
