import { useState, useEffect } from 'react';
import { addonAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import PromptModal from '../../components/PromptModal';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function AddonManagement() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();

  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_active: true
  });

  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (hotelId) {
      loadAddons();
    }
  }, [hotelId]);

  const loadAddons = async () => {
    try {
      setLoading(true);
      const data = await addonAPI.getByHotel(hotelId);
      setAddons(data.addons || []);
    } catch (error) {
      toast.error(t('addons.messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (addon = null) => {
    if (addon) {
      setEditingAddon(addon);
      setFormData({
        name: addon.name,
        description: addon.description || '',
        price: addon.price,
        is_active: addon.is_active
      });
    } else {
      setEditingAddon(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        hotel_id: hotelId,
        ...formData
      };
      
      if (editingAddon) {
        await addonAPI.update(editingAddon.id, payload);
        toast.success(t('addons.messages.update_success'));
      } else {
        await addonAPI.create(payload);
        toast.success(t('addons.messages.create_success'));
      }
      
      setShowModal(false);
      loadAddons();
    } catch (error) {
      toast.error(error.message || t('common.error'));
    }
  };

  const handleDelete = async (id) => {
    setPromptConfig({
      isOpen: true,
      title: t('addons.modals.delete_title'),
      message: t('addons.modals.delete_confirm'),
      onConfirm: async () => {
        try {
          await addonAPI.delete(id);
          toast.success(t('addons.messages.delete_success'));
          loadAddons();
        } catch (error) {
          toast.error(error.message || t('addons.messages.delete_error'));
        }
      }
    });
  };

  const handleToggleActive = async (addon) => {
    try {
      await addonAPI.update(addon.id, { is_active: !addon.is_active });
      toast.success(t('addons.messages.update_success'));
      loadAddons();
    } catch (error) {
      toast.error(t('addons.messages.toggle_error'));
    }
  };

  const columns = [
    { key: 'name', label: t('addons.table.name') },
    { key: 'description', label: t('addons.table.description'), render: (val) => val || '-' },
    { 
      key: 'price', 
      label: t('addons.table.price'),
      render: (val) => formatCurrency(val)
    },
    {
      key: 'is_active',
      label: t('addons.table.status'),
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {val ? t('common.active') : t('common.inactive')}
        </span>
      )
    },
    {
      key: 'actions',
      label: t('addons.table.actions'),
      render: (_, addon) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleToggleActive(addon)}
            className={`p-1 rounded ${addon.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
            title={addon.is_active ? t('common.deactivate') : t('common.activate')}
          >
            {addon.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleOpenModal(addon)}
            className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            title={t('common.edit')}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(addon.id)}
            className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <div className="p-4">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('addons.title')}</h1>
          <p className="text-gray-600">{t('addons.subtitle')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('addons.add_new')}
        </button>
      </div>

      <DataTable columns={columns} data={addons} searchable={true} searchField="name" />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAddon ? t('addons.modals.edit_title') : t('addons.modals.create_title')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('addons.form.name')} *</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder={t('addons.form.name_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('addons.form.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              rows="3"
              placeholder={t('addons.form.description_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('addons.form.price')} *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="input w-full"
              placeholder={t('addons.form.price_placeholder')}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              {t('addons.form.active')}
            </label>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {editingAddon ? t('addons.modals.edit_title') : t('addons.modals.create_title')}
            </button>
          </div>
        </form>
      </Modal>

      <PromptModal
        isOpen={promptConfig.isOpen}
        title={promptConfig.title}
        message={promptConfig.message}
        onConfirm={() => {
          promptConfig.onConfirm();
          setPromptConfig({ ...promptConfig, isOpen: false });
        }}
        onClose={() => setPromptConfig({ ...promptConfig, isOpen: false })}
      />
    </div>
  );
}
