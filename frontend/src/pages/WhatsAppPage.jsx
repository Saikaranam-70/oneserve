import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import {
  CheckCircle, WifiOff, RefreshCw, Copy,
  Smartphone, Globe, Zap, ChevronRight,
  MessageSquare, AlertCircle, Loader2
} from 'lucide-react';

const METHODS = [
  {
    id: 'baileys',
    label: 'Baileys (WA Web)',
    badge: 'Easiest',
    badgeColor: 'bg-green-100 text-green-700',
    icon: Smartphone,
    desc: 'Scan QR with your WhatsApp mobile app. No Meta account needed. Best for getting started quickly.',
    steps: ['Click Connect WhatsApp', 'A QR code will appear below', 'Open WhatsApp on your phone', 'Go to Settings → Linked Devices → Link a Device', 'Scan the QR code'],
  },
  {
    id: 'wppconnect',
    label: 'WPPConnect',
    badge: 'Stable',
    badgeColor: 'bg-blue-100 text-blue-700',
    icon: Zap,
    desc: 'Alternative WhatsApp Web method. More reliable for high order volumes.',
    steps: ['Click Connect WhatsApp', 'A QR code will appear below', 'Open WhatsApp on your phone', 'Go to Settings → Linked Devices → Link a Device', 'Scan the QR code'],
  },
  {
    id: 'meta',
    label: 'Meta Cloud API',
    badge: 'Production',
    badgeColor: 'bg-purple-100 text-purple-700',
    icon: Globe,
    desc: 'Official Meta API. Requires a verified Meta Business account. Best for scale.',
    steps: ['Go to developers.facebook.com', 'Create an App → Add WhatsApp product', 'Copy your Phone Number ID and Access Token', 'Paste them below and click Connect', 'Set your webhook URL in Meta dashboard'],
  },
];

export default function WhatsAppPage() {
  const { business } = useAuthStore();
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('baileys');
  const [metaForm, setMetaForm] = useState({ metaPhoneNumberId: '', metaToken: '' });
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testForm, setTestForm] = useState({ to: '', message: '' });
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrInterval = useRef(null);

  const fetchStatus = async (silent = false) => {
    if (!silent) setStatusLoading(true);
    try {
      const { data } = await api.get('/whatsapp/status');
      setStatus(data);
      if (data.connected && qrInterval.current) {
        clearInterval(qrInterval.current);
        setQr(null);
      }
    } catch {
      // Silently fail — don't show toast, don't clear session
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => clearInterval(qrInterval.current);
  }, []);

  const startQRPolling = () => {
    setQr(null);
    setQrLoading(true);
    let attempts = 0;
    qrInterval.current = setInterval(async () => {
      attempts++;
      try {
        const { data } = await api.get('/whatsapp/qr');
        if (data.connected) {
          clearInterval(qrInterval.current);
          setQr(null);
          setQrLoading(false);
          fetchStatus(true);
          toast.success('✅ WhatsApp connected!');
        } else if (data.qr) {
          setQr(data.qr);
          setQrLoading(false);
        } else if (attempts > 20) {
          // Give up after ~60s
          clearInterval(qrInterval.current);
          setQrLoading(false);
          toast.error('QR timed out. Please try again.');
        }
      } catch {}
    }, 3000);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const payload = { method: selectedMethod };
      if (selectedMethod === 'meta') {
        if (!metaForm.metaPhoneNumberId || !metaForm.metaToken) {
          toast.error('Please fill in Phone Number ID and Access Token');
          return;
        }
        Object.assign(payload, metaForm);
      }
      await api.post('/whatsapp/connect', payload);
      if (selectedMethod === 'meta') {
        toast.success('Meta WhatsApp connected!');
        fetchStatus(true);
      } else {
        toast.success('Session starting — scan the QR code below');
        startQRPolling();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect WhatsApp? Your bot will stop receiving messages.')) return;
    try {
      await api.post('/whatsapp/disconnect');
      toast.success('WhatsApp disconnected');
      setStatus(null);
      setQr(null);
      clearInterval(qrInterval.current);
    } catch { toast.error('Failed to disconnect'); }
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/whatsapp/test', testForm);
      toast.success('Test message sent!');
      setTestForm({ to: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const copyWebhook = () => {
    const url = `${window.location.origin}/api/webhook/${business?._id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedMethodData = METHODS.find(m => m.id === selectedMethod);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">WhatsApp Connection</h1>
        <p className="text-gray-500 text-sm mt-0.5">Connect your WhatsApp number to start receiving orders automatically</p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 transition-all ${
        status?.connected
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-white'
      }`}>
        {statusLoading ? (
          <Loader2 size={20} className="text-gray-400 animate-spin" />
        ) : status?.connected ? (
          <CheckCircle size={20} className="text-green-600 shrink-0" />
        ) : (
          <WifiOff size={20} className="text-gray-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {statusLoading ? 'Checking status...' : status?.connected ? 'Connected' : 'Not connected'}
          </p>
          {status?.connected && (
            <p className="text-xs text-gray-500 truncate">
              {status.phoneNumber ? `+${status.phoneNumber}` : 'Number linked'} · via {status.method}
              {status.connectedAt && ` · since ${new Date(status.connectedAt).toLocaleDateString()}`}
            </p>
          )}
          {!status?.connected && !statusLoading && (
            <p className="text-xs text-gray-400">Choose a method below to connect your WhatsApp</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status?.connected && (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
            >
              Disconnect
            </button>
          )}
          <button
            onClick={() => fetchStatus(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
            title="Refresh status"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Connection section — only show when not connected */}
      {!status?.connected && (
        <div className="space-y-4">

          {/* Method selector */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Choose connection method</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {METHODS.map(m => {
                const Icon = m.icon;
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon size={16} className={isSelected ? 'text-brand-600' : 'text-gray-400'} />
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-brand-700' : 'text-gray-700'}`}>
                      {m.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method detail card */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Description */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <p className="text-sm text-gray-600">{selectedMethodData?.desc}</p>
            </div>

            {/* Steps */}
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Setup Steps</p>
              <div className="space-y-2">
                {selectedMethodData?.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-600">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta fields */}
            {selectedMethod === 'meta' && (
              <div className="p-4 border-t border-gray-100 space-y-3">
                <div>
                  <label className="label">Phone Number ID</label>
                  <input
                    className="input"
                    value={metaForm.metaPhoneNumberId}
                    onChange={e => setMetaForm(p => ({ ...p, metaPhoneNumberId: e.target.value }))}
                    placeholder="e.g. 123456789012345"
                  />
                  <p className="text-xs text-gray-400 mt-1">Found in Meta Business → WhatsApp → API Setup</p>
                </div>
                <div>
                  <label className="label">Access Token</label>
                  <input
                    className="input font-mono text-xs"
                    type="password"
                    value={metaForm.metaToken}
                    onChange={e => setMetaForm(p => ({ ...p, metaToken: e.target.value }))}
                    placeholder="EAAxxxxxxxxxx..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Temporary or Permanent token from Meta dashboard</p>
                </div>
              </div>
            )}
          </div>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {connecting ? (
              <><Loader2 size={16} className="animate-spin" /> Connecting...</>
            ) : (
              <>Connect WhatsApp <ChevronRight size={16} /></>
            )}
          </button>

          {/* QR code area */}
          {(qrLoading || qr) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              {qrLoading && !qr && (
                <div className="py-8">
                  <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">Generating QR code...</p>
                  <p className="text-xs text-gray-400 mt-1">This may take 10–20 seconds</p>
                </div>
              )}
              {qr && (
                <>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Scan this QR code with WhatsApp</p>
                  <div className="inline-block p-2 border-2 border-brand-200 rounded-xl mb-3">
                    <img src={qr} alt="WhatsApp QR" className="w-52 h-52 rounded-lg" />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                    <div className="flex gap-2">
                      <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">How to scan</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Open WhatsApp → tap ⋮ (3 dots) → Linked Devices → Link a Device → scan this QR
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">QR expires in 60 seconds — a new one will load automatically</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test message — only when connected */}
      {status?.connected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-brand-600" />
            <h2 className="font-semibold text-sm">Send a test message</h2>
          </div>
          <form onSubmit={sendTest} className="space-y-3">
            <div>
              <label className="label">Phone number (with country code, no + or spaces)</label>
              <input
                className="input"
                value={testForm.to}
                onChange={e => setTestForm(p => ({ ...p, to: e.target.value }))}
                placeholder="919876543210"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Example: 919876543210 for India +91 98765 43210</p>
            </div>
            <div>
              <label className="label">Message</label>
              <input
                className="input"
                value={testForm.message}
                onChange={e => setTestForm(p => ({ ...p, message: e.target.value }))}
                placeholder="Hello from OneServe! 👋"
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="btn-primary flex items-center gap-2"
            >
              {sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : 'Send Test Message'}
            </button>
          </form>
        </div>
      )}

      {/* Webhook URL — always visible */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Your Meta Webhook URL</p>
          <button
            onClick={copyWebhook}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <Copy size={12} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <code className="block text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-2.5 break-all font-mono">
          {window.location.origin}/api/webhook/{business?._id || 'YOUR_BUSINESS_ID'}
        </code>
        <p className="text-xs text-gray-400 mt-2">
          Paste this URL in Meta Business → WhatsApp → Configuration → Webhook URL.
          Verify token: set to the value of <code className="bg-gray-100 px-1 rounded">META_VERIFY_TOKEN</code> in your backend .env
        </p>
      </div>

    </div>
  );
}
