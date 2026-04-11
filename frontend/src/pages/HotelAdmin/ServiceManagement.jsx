import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, Utensils, Trash2, Edit, RefreshCw } from 'lucide-react';

export default function ServiceManagement() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', is_restaurant: false });
  const [itemForm, setItemForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price: '',
    max_quantity: '',
    dietary_type: 'ALL',
  });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const confirmAction = (title, message, onConfirm) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };

  useEffect(() => {
    if (hotelId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [hotelId]);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [catData, itemData] = await Promise.all([
        serviceAPI.getCategories(hotelId),
        serviceAPI.getItems(hotelId),
      ]);
      setCategories(catData.categories || []);
      setItems(itemData.items || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubmitCategory = async (e) => {
    e.preventDefault();
    try {
      if (editingCategoryId) {
        await serviceAPI.updateCategory(editingCategoryId, { ...categoryForm, hotel_id: hotelId });
        toast.success('Category updated!');
      } else {
        await serviceAPI.createCategory({ ...categoryForm, hotel_id: hotelId });
        toast.success('Category created!');
      }
      setShowCategoryModal(false);
      loadData();
      setCategoryForm({ name: '', description: '', is_restaurant: false });
      setEditingCategoryId(null);
    } catch (error) {
      toast.error(error.message || `Failed to ${editingCategoryId ? 'update' : 'create'} category`);
    }
  };

  const handleSubmitItem = async (e) => {
    e.preventDefault();
    try {
      if (editingItemId) {
        await serviceAPI.updateItem(editingItemId, { ...itemForm, hotel_id: hotelId });
        toast.success('Item updated!');
      } else {
        await serviceAPI.createItem({ ...itemForm, hotel_id: hotelId });
        toast.success('Item created!');
      }
      setShowItemModal(false);
      loadData();
      setItemForm({ category_id: '', name: '', description: '', price: '', max_quantity: '', dietary_type: 'ALL' });
      setEditingItemId(null);
    } catch (error) {
      toast.error(error.message || `Failed to ${editingItemId ? 'update' : 'create'} item`);
    }
  };

  const openEditCategory = (cat) => {
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      is_restaurant: cat.is_restaurant || false
    });
    setEditingCategoryId(cat.id);
    setShowCategoryModal(true);
  };

  const openEditItem = (item) => {
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      max_quantity: item.max_quantity || '',
      dietary_type: item.dietary_type || 'ALL',
    });
    setEditingItemId(item.id);
    setShowItemModal(true);
  };

  const handleToggleAvailability = async (item) => {
    try {
      await serviceAPI.toggleAvailability(item.id, !item.is_available, hotelId);
      toast.success('Availability updated');
      loadData();
    } catch (error) {
      toast.error(error.error || error.message || 'Failed to update');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    confirmAction(
      'Delete Category',
      `Are you sure you want to delete "${name}"? This will also delete all items in this category.`,
      async () => {
        try {
          await serviceAPI.deleteCategory(id, hotelId);
          toast.success('Category deleted');
          loadData();
        } catch (error) {
          toast.error(error.error || error.message || 'Failed to delete category');
        }
      }
    );
  };

  const handleDeleteItem = async (item) => {
    confirmAction('Delete Item', `Are you sure you want to delete "${item.name}"?`, async () => {
      try {
        await serviceAPI.deleteItem(item.id, hotelId);
        toast.success('Item deleted');
        loadData();
      } catch (error) {
        toast.error(error.error || error.message || 'Failed to delete item');
      }
    });
  };

  const itemColumns = [
    { key: 'name', label: 'Item' },
    { key: 'category_name', label: 'Category' },
    {
      key: 'dietary_type',
      label: 'Type',
      render: (value) => {
        if (value === 'VEG') return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded border border-green-200 uppercase">Veg</span>;
        if (value === 'NON_VEG') return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded border border-red-200 uppercase">Non-Veg</span>;
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded border border-gray-200 uppercase">All</span>;
      }
    },
    { key: 'description', label: 'Description' },
    {
      key: 'price',
      label: 'Price',
      render: (value) => value ? formatCurrency(value) : 'N/A'
    },
    {
      key: 'max_quantity',
      label: 'Max Qty',
      render: (value) => value || 'No Limit'
    },
    {
      key: 'is_available',
      label: 'Available',
      render: (value, item) => (
        <button
          onClick={() => handleToggleAvailability(item)}
          className={`px-2 py-1 rounded text-xs ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (_, item) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditItem(item)}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
            title="Edit Item"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteItem(item)}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Delete Item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    },
  ];

  if (loading) return <div>Loading...</div>;
  if (!hotelId) return <div>No hotel assigned</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('services.title')}</h1>
          <p className="text-gray-600">{t('services.subtitle')}</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center transition-all active:scale-95"
          title={t('services.refresh_list')}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? t('common.refreshing') : t('services.refresh_list')}
        </button>
      </div>

      {/* Categories */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{t('services.categories')}</h2>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="btn btn-primary text-sm inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('services.add_category')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center group transition-colors hover:bg-gray-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{cat.name}</h3>
                  {cat.is_restaurant && (
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-black uppercase rounded-lg border border-primary-200">
                      {t('services.restaurant_label')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">{cat.description}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditCategory(cat)}
                  className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-200 rounded"
                  title="Edit Category"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-200 rounded"
                  title="Delete Category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Menu Items</h2>
          <button
            onClick={() => setShowItemModal(true)}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>
        <DataTable columns={itemColumns} data={items} />
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategoryId(null);
          setCategoryForm({ name: '', description: '', is_restaurant: false });
        }}
        title={editingCategoryId ? t('services.edit_category') : t('services.add_category')}
      >
        <form onSubmit={handleSubmitCategory} className="space-y-4">
          <input
            required
            placeholder="Category Name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            className="input"
          />
          <textarea
            placeholder="Description"
            value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
            className="input"
            rows="3"
          />
          <div className="pt-2 pb-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={categoryForm.is_restaurant}
                onChange={(e) => setCategoryForm({ ...categoryForm, is_restaurant: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              <span className="ml-3 text-sm font-bold text-slate-700">{t('services.mark_restaurant')}</span>
            </label>
            <p className="text-[10px] text-slate-400 mt-1 ml-14 uppercase font-black">{t('services.restaurant_only_help')}</p>
          </div>
          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">
              {editingCategoryId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCategoryModal(false);
                setCategoryForm({ name: '', description: '' });
                setEditingCategoryId(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Item Modal */}
      <Modal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          setEditingItemId(null);
          setItemForm({ category_id: '', name: '', description: '', price: '', max_quantity: '', dietary_type: 'ALL' });
        }}
        title={editingItemId ? t('common.edit') : t('common.add')}
      >
        <form onSubmit={handleSubmitItem} className="space-y-4">
          <select
            required
            value={itemForm.category_id}
            onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
            className="input"
          >
            <option value="">Select Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <input
            required
            placeholder={t('room_types.name')}
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            className="input"
          />
          <textarea
            placeholder={t('room_types.description')}
            value={itemForm.description}
            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            className="input"
            rows="2"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder={t('room_types.base_price')}
            value={itemForm.price}
            onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
            className="input"
          />
          <input
            type="number"
            min="1"
            placeholder="Max Quantity per Order (Optional)"
            value={itemForm.max_quantity}
            onChange={(e) => setItemForm({ ...itemForm, max_quantity: e.target.value })}
            className="input"
          />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Dietary Type</label>
            <div className="flex gap-2">
              {['ALL', 'VEG', 'NON_VEG'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setItemForm({ ...itemForm, dietary_type: type })}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${itemForm.dietary_type === type
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">
              {editingItemId ? t('common.update') : t('common.create')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowItemModal(false);
                setItemForm({ category_id: '', name: '', description: '', price: '', max_quantity: '', dietary_type: 'ALL' });
                setEditingItemId(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
