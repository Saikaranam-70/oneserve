import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff, Image } from 'lucide-react';

const EMPTY = { name: '', description: '', price: '', discountPrice: '', category: '', stock: '', sku: '', isAvailable: true };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/products?limit=100');
      setProducts(data.products);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFiles([]); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description, price: p.price, discountPrice: p.discountPrice || '', category: p.category, stock: p.stock === -1 ? '' : p.stock, sku: p.sku, isAvailable: p.isAvailable });
    setFiles([]);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== '' && fd.append(k, v));
      files.forEach(f => fd.append('images', f));

      if (editing) {
        await api.patch(`/products/${editing._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product updated');
      } else {
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product created');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const toggleAvailable = async (p) => {
    try {
      await api.patch(`/products/${p._id}`, { isAvailable: !p.isAvailable });
      setProducts(prev => prev.map(x => x._id === p._id ? { ...x, isAvailable: !x.isAvailable } : x));
    } catch { toast.error('Failed to update'); }
  };

  const deleteProduct = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      toast.success('Deleted');
      fetchProducts();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1>Products</h1><p className="text-gray-500 text-sm">Manage your catalog</p></div>
        <button onClick={openAdd} className="btn-primary text-sm"><Plus size={16} />Add Product</button>
      </div>

      {loading && <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="card h-52 animate-pulse bg-gray-50" />)}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map(p => (
          <div key={p._id} className={`card overflow-hidden ${!p.isAvailable ? 'opacity-60' : ''}`}>
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
              {p.images?.[0] ? <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" /> : <Image size={32} className="text-gray-300" />}
            </div>
            <div className="p-3">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              <p className="text-xs text-gray-400 truncate">{p.category}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="font-bold text-brand-700">₹{p.discountPrice || p.price}</span>
                {p.discountPrice && <span className="text-xs text-gray-400 line-through">₹{p.price}</span>}
              </div>
              <div className="flex gap-1 mt-2">
                <button onClick={() => toggleAvailable(p)} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700" title={p.isAvailable ? 'Hide' : 'Show'}>
                  {p.isAvailable ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700"><Pencil size={14} /></button>
                <button onClick={() => deleteProduct(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {[
                { label: 'Product Name', key: 'name', required: true },
                { label: 'Description', key: 'description' },
                { label: 'Price (₹)', key: 'price', type: 'number', required: true },
                { label: 'Discount Price (₹)', key: 'discountPrice', type: 'number' },
                { label: 'Category', key: 'category' },
                { label: 'SKU', key: 'sku' },
                { label: 'Stock (-1 = unlimited)', key: 'stock', type: 'number' },
              ].map(({ label, key, type = 'text', required }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input className="input" type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} required={required} />
                </div>
              ))}

              <div>
                <label className="label">Images</label>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => setFiles([...e.target.files])} className="text-sm" />
                {files.length > 0 && <p className="text-xs text-gray-400 mt-1">{files.length} file(s) selected</p>}
                {editing?.images?.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {editing.images.map(img => <img key={img.publicId} src={img.url} className="w-12 h-12 rounded-lg object-cover border border-gray-100" />)}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isAvailable} onChange={e => setForm(p => ({ ...p, isAvailable: e.target.checked }))} />
                Available for ordering
              </label>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
