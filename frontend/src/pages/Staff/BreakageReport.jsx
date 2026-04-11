import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  AlertTriangle, 
  Package, 
  Building2,
  CheckCircle,
  Plus
} from 'lucide-react';
import { itemInventoryAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';

export default function StaffBreakageReport() {
  const { t } = useTranslation();
  const { hotel } = useAuthStore();
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, storesRes] = await Promise.all([
        itemInventoryAPI.getItems({ hotel_id: hotel?.id }),
        itemInventoryAPI.getStores()
      ]);
      setItems(itemsRes.data);
      setStores(storesRes.data);
    } catch (error) {
      toast.error(t('common.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      await itemInventoryAPI.reportBreakage({ ...data, hotel_id: hotel?.id });
      toast.success('Incident reported successfully. Thank you!');
      reset();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t('inventory_mgmt.breakage.title')}</h1>
        <p className="text-slate-500 text-sm">{t('inventory_mgmt.breakage.subtitle')}</p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
              <Package className="w-4 h-4 text-primary-600" />
              <span>{t('inventory_mgmt.item')} *</span>
            </label>
            <select
              {...register('item_id', { required: true })}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all appearance-none"
            >
              <option value="">Choose item...</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-primary-600" />
                <span>{t('inventory_mgmt.quantity')} *</span>
              </label>
              <input
                type="number"
                {...register('quantity', { required: true, min: 1 })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all font-bold"
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                <span>{t('inventory_mgmt.breakage.location')} *</span>
              </label>
              <select
                {...register('store_id', { required: true })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all appearance-none"
              >
                <option value="">Choose store...</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Reason *</span>
            </label>
            <select
              {...register('reason', { required: true })}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all appearance-none"
            >
              <option value="Broken">Broken / Damaged</option>
              <option value="Lost">Lost / Missing</option>
              <option value="Expired">Expired</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
              <span>Additional Comments</span>
            </label>
            <textarea
              {...register('notes')}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all h-32 resize-none"
              placeholder="e.g. Found broken in Room 204 during cleaning..."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-3"
          >
            {isSubmitting ? (
              <span>Submitting...</span>
            ) : (
              <>
                <CheckCircle className="w-6 h-6" />
                <span>Submit Report</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
        <h4 className="text-sm font-bold text-blue-900 mb-1">Need Help?</h4>
        <p className="text-xs text-blue-700">If an item is dangerous (e.g. broken glass), please inform your supervisor immediately after reporting here.</p>
      </div>
    </div>
  );
}
