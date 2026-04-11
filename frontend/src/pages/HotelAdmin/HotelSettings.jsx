import { useState, useEffect } from 'react';
import { hotelAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Building2, Save } from 'lucide-react';

export default function HotelSettings() {
  const { t } = useTranslation();
  const { getHotelId, user } = useAuthStore();
  const hotelId = getHotelId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    phone: '',
    email: '',
    gst_number: '',
    logo: '',
  });

  useEffect(() => {
    if (hotelId) loadHotelData();
  }, [hotelId]);

  const loadHotelData = async () => {
    try {
      const data = await hotelAPI.getById(hotelId);
      setFormData({
        name: data.hotel.name || '',
        address: data.hotel.address || '',
        city: data.hotel.city || '',
        state: data.hotel.state || '',
        country: data.hotel.country || '',
        postal_code: data.hotel.postal_code || '',
        phone: data.hotel.phone || '',
        email: data.hotel.email || '',
        gst_number: data.hotel.gst_number || '',
        logo: data.hotel.logo || '',
      });
    } catch (error) {
      toast.error(t('settings.messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hotelAPI.update(hotelId, formData);
      toast.success(t('settings.messages.update_success'));
    } catch (error) {
      toast.error(error.message || t('settings.messages.update_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;
  if (!hotelId) return <div>{t('settings.no_hotel')}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Building2 className="w-8 h-8 text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-gray-600">{t('settings.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.form.hotel_name')} *
          </label>
          <input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.form.logo_url')}
          </label>
          <input
            value={formData.logo}
            onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
            placeholder={t('settings.form.logo_placeholder')}
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">{t('settings.form.logo_hint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.form.address')}
          </label>
          <input
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="input"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.city')} *
            </label>
            <input
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.state')}
            </label>
            <input
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.country')} *
            </label>
            <input
              required
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.postal_code')}
            </label>
            <input
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.phone')}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.email')}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.form.gst_number')}
            </label>
            <input
              placeholder={t('settings.form.gst_placeholder')}
              value={formData.gst_number}
              onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={loadHotelData}
            className="btn btn-secondary"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary inline-flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('common.save_changes')}
          </button>
        </div>
      </form>
    </div>
  );
}
