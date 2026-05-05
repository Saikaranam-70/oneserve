import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Ticket, Plus, Trash2, Power, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: ''
  });

  const fetchCoupons = async () => {
    try {
      const { data } = await api.get('/coupons');
      setCoupons(data.coupons);
    } catch {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/coupons', form);
      toast.success('Coupon created successfully!');
      setForm({ code: '', discountType: 'percentage', discountValue: '', minOrderValue: '', maxDiscount: '' });
      fetchCoupons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/coupons/${id}`);
      setCoupons(prev => prev.map(c => c._id === id ? { ...c, isActive: !c.isActive } : c));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const deleteCoupon = async (id) => {
    if (!confirm('Delete this coupon permanently?')) return;
    try {
      await api.delete(`/coupons/${id}`);
      setCoupons(prev => prev.filter(c => c._id !== id));
      toast.success('Coupon deleted');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Ticket className="text-brand-600" />
          Discount Coupons
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Create and manage promo codes to automatically give discounts to your customers at checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-brand-500" />
              New Coupon
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Coupon Code</label>
                <input
                  className="input uppercase"
                  placeholder="e.g. WELCOME10"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select
                    className="input"
                    value={form.discountType}
                    onChange={e => setForm({ ...form, discountType: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Value</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 10"
                    value={form.discountValue}
                    onChange={e => setForm({ ...form, discountValue: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Minimum Order Value (Optional)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 500"
                  value={form.minOrderValue}
                  onChange={e => setForm({ ...form, minOrderValue: e.target.value })}
                />
              </div>

              {form.discountType === 'percentage' && (
                <div>
                  <label className="label">Max Discount Amount (Optional)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 100"
                    value={form.maxDiscount}
                    onChange={e => setForm({ ...form, maxDiscount: e.target.value })}
                  />
                </div>
              )}

              <button type="submit" disabled={saving || !form.code} className="btn-primary w-full flex justify-center">
                {saving ? <Loader2 size={18} className="animate-spin" /> : 'Create Coupon'}
              </button>
            </form>
          </div>
        </div>

        {/* Coupons List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-5 px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
              <span className="col-span-2">Code & Details</span>
              <span>Min. Order</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            
            <div className="divide-y divide-gray-50">
              {loading && [...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50 m-2 rounded-xl" />)}
              {!loading && coupons.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">No coupons found. Create one to start!</div>
              )}
              {coupons.map(coupon => (
                <div key={coupon._id} className="grid grid-cols-5 px-5 py-4 items-center text-sm hover:bg-gray-50 transition-colors">
                  <div className="col-span-2">
                    <span className="font-bold text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">{coupon.code}</span>
                    <p className="text-xs text-gray-500 mt-1">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                      {coupon.maxDiscount ? ` (Up to ₹${coupon.maxDiscount})` : ''}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Created {formatDistanceToNow(new Date(coupon.createdAt))} ago</p>
                  </div>
                  <div className="text-gray-600 font-medium">
                    {coupon.minOrderValue ? `₹${coupon.minOrderValue}` : 'None'}
                  </div>
                  <div>
                    <button
                      onClick={() => toggleStatus(coupon._id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        coupon.isActive 
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Power size={12} className={coupon.isActive ? 'text-green-600' : 'text-gray-400'} />
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => deleteCoupon(coupon._id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Coupon"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
