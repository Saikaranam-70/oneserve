import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Megaphone, Send, Smartphone, Users, Loader2 } from 'lucide-react';

export default function CampaignsPage() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [customersCount, setCustomersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data } = await api.get('/orders?limit=500');
        const uniquePhones = new Set(data.orders.map(o => o.customer?.phone).filter(Boolean));
        setCustomersCount(uniquePhones.size);
      } catch (err) {
        toast.error('Failed to load customers');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) return toast.error('Message cannot be empty');
    if (customersCount === 0) return toast.error('No customers to send to');

    if (!confirm(`Are you sure you want to send this message to ${customersCount} customers?`)) return;

    setSending(true);
    try {
      const { data } = await api.post('/whatsapp/broadcast', { message });
      toast.success(data.message || 'Broadcast started successfully!');
      setMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Megaphone className="text-brand-600" />
          Marketing Campaigns
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Send promotional messages, updates, and offers to all your registered customers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col - Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send size={18} className="text-brand-500" />
              Compose Broadcast
            </h2>
            
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="label">Message content</label>
                <textarea
                  className="input min-h-[150px] resize-y"
                  placeholder="e.g., 🎉 Weekend Special! Use code WEEKEND20 for 20% off all orders today. Reply *menu* to order now!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-2">
                  *Use standard WhatsApp formatting: *bold*, _italic_, ~strikethrough~.*
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users size={16} />
                  {loading ? (
                    <span className="text-gray-400">Loading audience...</span>
                  ) : (
                    <span>Sending to <strong className="text-gray-900">{customersCount}</strong> customers</span>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={sending || loading || customersCount === 0 || !message.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  {sending ? (
                    <><Loader2 size={16} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={16} /> Broadcast Now</>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          {/* Pro Tip Box */}
          <div className="bg-brand-50 rounded-xl p-4 border border-brand-100">
            <h3 className="text-brand-800 font-semibold text-sm mb-1">💡 Best Practices for Campaigns</h3>
            <ul className="text-brand-700 text-xs space-y-1 list-disc pl-4">
              <li>Keep it short and to the point.</li>
              <li>Always include a clear Call to Action (e.g., "Reply *order* to buy now").</li>
              <li>Avoid sending too many messages to prevent users from blocking your bot.</li>
            </ul>
          </div>
        </div>

        {/* Right Col - Preview */}
        <div className="lg:col-span-1">
          <div className="bg-gray-100 rounded-3xl p-4 border-4 border-gray-200 shadow-inner h-[500px] flex flex-col relative overflow-hidden">
            
            {/* Phone header */}
            <div className="bg-teal-600 text-white px-4 py-3 rounded-t-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Smartphone size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">Your Business</p>
                <p className="text-[10px] text-teal-100">bot</p>
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 bg-[#efeae2] p-4 overflow-y-auto space-y-4">
              {/* Dummy received message */}
              <div className="bg-white p-2 rounded-lg rounded-tl-none text-sm max-w-[85%] shadow-sm text-gray-800 self-start inline-block">
                Thank you for your order!
                <div className="text-[10px] text-gray-400 text-right mt-1">10:00 AM</div>
              </div>

              {/* Broadcast Preview Message */}
              {message && (
                <div className="flex flex-col items-end w-full">
                  <div className="bg-[#d9fdd3] p-2 rounded-lg rounded-tr-none text-sm max-w-[85%] shadow-sm text-gray-800 whitespace-pre-wrap break-words">
                    {message}
                    <div className="text-[10px] text-gray-500 text-right mt-1">Now</div>
                  </div>
                </div>
              )}
            </div>

            {/* Phone footer */}
            <div className="bg-[#f0f2f5] p-2 rounded-b-2xl flex items-center gap-2">
              <div className="flex-1 bg-white rounded-full py-2 px-4 text-xs text-gray-400 border border-gray-300">
                Type a message
              </div>
            </div>

          </div>
          <p className="text-center text-xs text-gray-400 mt-3 font-medium">Live Preview</p>
        </div>

      </div>
    </div>
  );
}
