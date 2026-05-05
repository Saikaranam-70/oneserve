import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, ChevronDown, RefreshCw, Printer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready:     'bg-green-100 text-green-700',
  delivered: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivered' };

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: activeTab, page, limit: 15 });
      if (search) params.set('search', search);
      const [ordersRes, countsRes] = await Promise.all([
        api.get(`/orders?${params}`),
        api.get('/orders/counts'),
      ]);
      setOrders(ordersRes.data.orders);
      setTotalPages(ordersRes.data.pages);
      setCounts(countsRes.data.counts);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId, status) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success(`Order moved to ${status}`);
      fetchOrders();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const printLabel = (order) => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html>
        <head>
          <title>Print Label - ${order.orderId}</title>
          <style>
            body { font-family: monospace; padding: 20px; width: 300px; margin: auto; }
            .header { text-align: center; font-size: 1.2em; font-weight: bold; margin-bottom: 10px; }
            .section { margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
            .flex { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">ORDER ${order.orderId}</div>
          <div class="section">
            <div><strong>Customer:</strong> ${order.customer?.name}</div>
            <div><strong>Phone:</strong> ${order.customer?.phone}</div>
            <div><strong>Address:</strong> ${order.deliveryAddress || order.deliveryType}</div>
          </div>
          <div class="section">
            ${order.items.map(i => `<div class="flex"><span>${i.quantity}x ${i.name}</span><span>₹${i.total}</span></div>`).join('')}
          </div>
          <div class="section">
            <div class="flex"><span>Subtotal:</span><span>₹${order.subtotal}</span></div>
            <div class="flex"><span>Delivery:</span><span>₹${order.deliveryCharge}</span></div>
            ${order.discount ? `<div class="flex"><span>Discount (${order.couponCode}):</span><span>-₹${order.discount}</span></div>` : ''}
            <div class="flex" style="font-weight: bold; font-size: 1.1em; margin-top: 5px;"><span>TOTAL:</span><span>₹${order.total}</span></div>
          </div>
          <div style="text-align: center; font-size: 0.9em;">Powered by OneServe</div>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage and track customer orders</p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary text-sm"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9 text-sm" placeholder="Search orders or customers..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setActiveTab(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === s ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {s} {counts[s] ? <span className="ml-1 opacity-70">({counts[s]})</span> : ''}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="card divide-y divide-gray-50">
        {loading && [...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50 m-1 rounded-lg" />)}
        {!loading && orders.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">No {activeTab} orders</p>
        )}
        {!loading && orders.map(order => (
          <div key={order._id} className="px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{order.orderId}</span>
                <span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{order.customer?.name} · {order.customer?.phone}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')} · {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
              </p>
              {order.discount > 0 && (
                <p className="text-xs text-green-600 mt-0.5 font-medium">Coupon {order.couponCode} applied (-₹{order.discount})</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold">₹{order.total}</p>
              {NEXT_STATUS[order.status] && (
                <button
                  onClick={() => updateStatus(order._id, NEXT_STATUS[order.status])}
                  disabled={updatingId === order._id}
                  className="text-xs mt-1 text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50"
                >
                  {updatingId === order._id ? '...' : `→ ${NEXT_STATUS[order.status]}`}
                </button>
              )}
              <div className="flex flex-col items-end gap-1 mt-2">
                <button
                  onClick={() => printLabel(order)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
                >
                  <Printer size={12} /> Print Label
                </button>
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateStatus(order._id, 'cancelled')}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
