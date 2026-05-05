import { useEffect, useState } from 'react';
import api from '../services/api';
import { Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    // Customers come from the orders data grouped by phone
    api.get('/orders?limit=500').then(({ data }) => {
      const map = new Map();
      data.orders.forEach(o => {
        const key = o.customer?.phone;
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, { phone: key, name: o.customer.name, orders: 0, spent: 0, lastOrder: o.createdAt });
        }
        const c = map.get(key);
        c.orders += 1;
        c.spent += o.total;
        if (new Date(o.createdAt) > new Date(c.lastOrder)) c.lastOrder = o.createdAt;
      });
      setCustomers([...map.values()].sort((a, b) => b.spent - a.spent));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1>Customers</h1>
        <p className="text-gray-500 text-sm">All customers who ordered via WhatsApp</p>
      </div>

      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9 text-sm" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="grid grid-cols-4 px-5 py-2 text-xs text-gray-400 border-b border-gray-50 font-medium uppercase tracking-wide">
          <span>Customer</span><span>Phone</span><span>Orders</span><span>Total Spent</span>
        </div>
        {loading && [...Array(6)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-gray-50 m-1 rounded" />)}
        {!loading && filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No customers yet</p>}
        {filtered.map(c => (
          <div key={c.phone} className="grid grid-cols-4 px-5 py-3 border-b border-gray-50 last:border-0 text-sm items-center hover:bg-gray-50 transition-colors">
            <div>
              <p className="font-medium">{c.name || 'Unknown'}</p>
              <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(c.lastOrder), { addSuffix: true })}</p>
            </div>
            <span className="text-gray-600">{c.phone}</span>
            <span className="font-medium">{c.orders}</span>
            <span className="font-bold text-brand-700">₹{c.spent.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
