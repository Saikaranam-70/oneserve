import { useEffect, useState } from 'react';
import api from '../services/api';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/analytics/revenue?period=${period}`),
      api.get('/analytics/top-products?limit=8'),
      api.get('/analytics/orders-by-status'),
    ]).then(([r, t, s]) => {
      setRevenue(r.data.data);
      setTopProducts(t.data.data);
      setByStatus(s.data.data.map(x => ({ name: x._id, value: x.count })));
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  const exportCSV = async () => {
    try {
      const res = await api.get('/analytics/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported!');
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading analytics...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1>Analytics</h1><p className="text-gray-500 text-sm">Sales insights and trends</p></div>
        <button onClick={exportCSV} className="btn-secondary text-sm"><Download size={14} />Export CSV</button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {['7d', '30d', '90d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
          </button>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Revenue over time</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
            <Tooltip formatter={v => [`₹${v}`, 'Revenue']} />
            <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top products */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Top products by revenue</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
              <YAxis type="category" dataKey="_id" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={v => [`₹${v}`, 'Revenue']} />
              <Bar dataKey="totalRevenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by status */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Orders by status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
