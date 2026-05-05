import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function SettingsPage() {
  const { business, setBusiness } = useAuthStore();
  const [profile, setProfile] = useState({ name: '', phone: '', address: '', category: '' });
  const [settings, setSettings] = useState({});
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (business) {
      setProfile({ name: business.name, phone: business.phone, address: business.address || '', category: business.category });
      setSettings(business.settings || {});
    }
  }, [business]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/business/profile', profile);
      setBusiness(data.business);
      toast.success('Profile saved');
    } catch { toast.error('Failed to save'); } finally { setSavingProfile(false); }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.patch('/business/settings', settings);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); } finally { setSavingSettings(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPwd(true);
    try {
      await api.patch('/auth/change-password', passwords);
      toast.success('Password updated');
      setPasswords({ currentPassword: '', newPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSavingPwd(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div><h1>Settings</h1><p className="text-gray-500 text-sm">Manage your business profile and preferences</p></div>

      {/* Business ID for webhook */}
      <div className="card p-4 bg-brand-50 border-brand-200">
        <p className="text-sm font-medium text-brand-800">Your Business ID</p>
        <code className="text-xs text-brand-700 break-all">{business?._id}</code>
        <p className="text-xs text-brand-600 mt-1">Use this in your Meta webhook URL</p>
      </div>

      {/* Profile */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Business Profile</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          {[{ k: 'name', l: 'Business Name' }, { k: 'phone', l: 'Phone' }, { k: 'address', l: 'Address' }].map(({ k, l }) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input" value={profile[k]} onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" className="btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Profile'}</button>
        </form>
      </div>

      {/* Bot settings */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Bot Messages</h2>
        <form onSubmit={saveSettings} className="space-y-3">
          {[
            { k: 'welcomeMessage', l: 'Welcome Message' },
            { k: 'orderConfirmationMessage', l: 'Order Confirmation (use {orderId})' },
            { k: 'orderReadyMessage', l: 'Order Ready (use {orderId})' },
          ].map(({ k, l }) => (
            <div key={k}>
              <label className="label">{l}</label>
              <textarea className="input resize-none" rows={2} value={settings[k] || ''} onChange={e => setSettings(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="label">Delivery Fee (₹)</label>
            <input 
              type="number" 
              className="input" 
              value={settings.deliveryFee || 0} 
              onChange={e => setSettings(p => ({ ...p, deliveryFee: Number(e.target.value) }))} 
            />
            <p className="text-xs text-gray-400 mt-1">Fee charged for Home Delivery orders</p>
          </div>
          <label className="flex items-center gap-2 text-sm mt-3">
            <input type="checkbox" checked={settings.autoConfirm || false} onChange={e => setSettings(p => ({ ...p, autoConfirm: e.target.checked }))} />
            Auto-confirm orders (skip manual confirmation)
          </label>
          <button type="submit" className="btn-primary" disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Settings'}</button>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input className="input" type="password" value={passwords.currentPassword} onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={passwords.newPassword} onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} required minLength={6} />
          </div>
          <button type="submit" className="btn-primary" disabled={savingPwd}>{savingPwd ? 'Updating...' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  );
}
