import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Package,
  Tags,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { itemInventoryAPI } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { useCurrencyStore } from '../../../store/currencyStore';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';

export default function StockManagement() {
  const { t } = useTranslation();
  const { hotel } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Editing state
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  const { register, handleSubmit, reset } = useForm();
  const { register: regCat, handleSubmit: handleCatSub, reset: resetCat } = useForm();
  const { register: regAdj, handleSubmit: handleAdjSub, reset: resetAdj, watch: watchAdj } = useForm({
    defaultValues: { type: 'IN' }
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catsRes, stockRes] = await Promise.all([
        itemInventoryAPI.getItems(),
        itemInventoryAPI.getCategories(),
        itemInventoryAPI.getStockLevels()
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setCategories(Array.isArray(catsRes) ? catsRes : []);
      setStock(Array.isArray(stockRes) ? stockRes : []);
    } catch (error) {
      toast.error(t('common.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  // Item CRUD
  const openItemModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      reset({ name: item.name, category_id: item.category_id, sku: item.sku, unit: item.unit, min_stock_level: item.min_stock_level, price: item.price, description: item.description });
    } else {
      reset({ name: '', category_id: '', sku: '', unit: '', min_stock_level: '', price: '', description: '' });
    }
    setIsItemModalOpen(true);
  };

  const onItemSubmit = async (data) => {
    try {
      if (editingItem) {
        await itemInventoryAPI.updateItem(editingItem.id, data);
        toast.success('Item updated');
      } else {
        await itemInventoryAPI.createItem({ ...data, hotel_id: hotel?.id });
        toast.success('Item created');
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
      reset();
      fetchData();
    } catch (error) {
      toast.error(error.message || t('common.error'));
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete item "${item.name}"? This cannot be undone.`)) return;
    try {
      await itemInventoryAPI.deleteItem(item.id);
      toast.success('Item deleted');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Cannot delete item');
    }
  };

  // Category CRUD
  const openCategoryModal = (cat = null) => {
    setEditingCategory(cat);
    if (cat) {
      resetCat({ name: cat.name, description: cat.description });
    } else {
      resetCat({ name: '', description: '' });
    }
    setIsCategoryModalOpen(true);
  };

  const onCategorySubmit = async (data) => {
    try {
      if (editingCategory) {
        await itemInventoryAPI.updateCategory(editingCategory.id, data);
        toast.success('Category updated');
      } else {
        await itemInventoryAPI.createCategory(data);
        toast.success('Category created');
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      resetCat();
      fetchData();
    } catch (error) {
      toast.error(error.message || t('common.error'));
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"? Items in this category must be removed first.`)) return;
    try {
      await itemInventoryAPI.deleteCategory(cat.id);
      toast.success('Category deleted');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Cannot delete category');
    }
  };

  // Adjust stock
  const onAdjustSubmit = async (data) => {
    try {
      // Calculate total cost for expense logging
      const selectedItem = items.find(i => i.id === data.item_id);
      const itemPrice = parseFloat(selectedItem?.price) || 0;
      const totalCost = itemPrice * Math.abs(parseFloat(data.quantity) || 0);

      await itemInventoryAPI.adjustStock({
        ...data,
        hotel_id: hotel?.id,
        total_cost: totalCost,
        payment_method: data.payment_method || 'Cash'
      });
      toast.success('Stock updated');
      setIsAdjustModalOpen(false);
      resetAdj();
      fetchData();
    } catch (error) {
      toast.error(error.message || t('common.error'));
    }
  };

  // Columns
  const itemColumns = [
    {
      key: 'name',
      label: 'Item',
      render: (val, row) => (
        <div className="flex items-center space-x-3">
          <Package className="w-4 h-4 text-slate-400" />
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            {row.sku && <p className="text-xs text-slate-500">{row.sku}</p>}
          </div>
        </div>
      )
    },
    { key: 'category_name', label: 'Category',
      render: (val) => val ? (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{val}</span>
      ) : '—'
    },
    { key: 'price', label: 'Price',
      render: (val) => <span className="font-bold text-slate-900">{formatCurrency(val)}</span>
    },
    { key: 'total_stock', label: 'In Stock',
      render: (val) => <span className="font-bold text-slate-900">{parseInt(val) || 0}</span>
    }
  ];

  const categoryColumns = [
    { key: 'name', label: 'Category Name',
      render: (val) => <span className="font-medium text-slate-900">{val}</span>
    },
    { key: 'description', label: 'Description',
      render: (val) => <span className="text-slate-500">{val || '—'}</span>
    }
  ];

  const stockColumns = [
    { key: 'item_name', label: 'Item',
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-900">{row.item_name}</p>
          {row.sku && <p className="text-xs text-slate-500">{row.sku}</p>}
        </div>
      )
    },
    { key: 'category_name', label: 'Category',
      render: (val) => val ? (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{val}</span>
      ) : '—'
    },
    { key: 'quantity', label: 'Quantity',
      render: (val) => <span className="font-bold text-slate-900">{parseInt(val) || 0}</span>
    },
    { key: 'updated_at', label: 'Last Updated',
      render: (val) => <span className="text-xs text-slate-500">{val ? new Date(val).toLocaleString() : '—'}</span>
    }
  ];

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'items', label: 'Items', count: items.length },
    { id: 'categories', label: 'Categories', count: categories.length },
    { id: 'stock', label: 'Stock Levels', count: stock.length }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stocks</h1>
          <p className="text-slate-500 text-sm mt-1">Manage categories, items, and stock levels</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => openCategoryModal()}
            className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
            <Tags className="w-4 h-4" /><span>Add Category</span>
          </button>
          <button onClick={() => openItemModal()}
            className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
            <Plus className="w-4 h-4" /><span>Add Item</span>
          </button>
          <button onClick={() => setIsAdjustModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-500/20">
            <RotateCcw className="w-4 h-4" /><span>Adjust Stock</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
            className={`px-5 py-2 rounded-xl text-sm transition-all ${
              activeTab === tab.id ? 'bg-white text-primary-600 shadow-sm font-bold' : 'text-slate-500 font-medium'
            }`}>
            {tab.label} <span className="text-xs ml-1 opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder={`Search ${activeTab}...`}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {activeTab === 'items' && (
          <DataTable columns={itemColumns} data={filteredItems} loading={loading} searchable={false}
            onEdit={(item) => openItemModal(item)}
            onDelete={handleDeleteItem}
            emptyMessage="No items yet. Click 'Add Item' to get started." />
        )}
        {activeTab === 'categories' && (
          <DataTable columns={categoryColumns} data={filteredCategories} loading={loading} searchable={false}
            onEdit={(cat) => openCategoryModal(cat)}
            onDelete={handleDeleteCategory}
            emptyMessage="No categories yet. Click 'Add Category' to create one." />
        )}
        {activeTab === 'stock' && (
          <DataTable columns={stockColumns} data={stock} loading={loading} searchable={false}
            emptyMessage="No stock records. Use 'Adjust Stock' to add inventory." />
        )}
      </div>

      {/* Item Modal (Add/Edit) */}
      <Modal isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }} title={editingItem ? 'Edit Item' : 'Add Item'}>
        <form onSubmit={handleSubmit(onItemSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Item Name *</label>
              <input {...register('name', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                placeholder="e.g. Toilet Soap" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Category *</label>
              <select {...register('category_id', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">SKU / Code</label>
              <input {...register('sku')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="e.g. SOAP-001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Unit *</label>
              <input {...register('unit', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="e.g. Pcs, Box, Kg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Price per Unit *</label>
              <input type="number" step="0.01" {...register('price', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Min. Stock Level</label>
              <input type="number" {...register('min_stock_level')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea {...register('description')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none h-20 resize-none" placeholder="Optional details..." />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
              {editingItem ? 'Update Item' : 'Save Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Modal (Add/Edit) */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }} title={editingCategory ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleCatSub(onCategorySubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Category Name *</label>
            <input {...regCat('name', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="e.g. Kitchen, Bar, Toiletries" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea {...regCat('description')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none h-20 resize-none" />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
              {editingCategory ? 'Update Category' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="Adjust Stock">
        <form onSubmit={handleAdjSub(onAdjustSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Item *</label>
              <select {...regAdj('item_id', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="">Select Item</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name} — {formatCurrency(item.price)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Payment Method</label>
              <select {...regAdj('payment_method')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Type *</label>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button type="button" onClick={() => resetAdj({ ...watchAdj(), type: 'IN' })}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition-all ${
                    watchAdj('type') === 'IN' ? 'bg-white shadow-sm text-emerald-600 font-bold' : 'text-slate-500'
                  }`}>
                  <ArrowUpRight className="w-4 h-4" /><span>Stock IN</span>
                </button>
                <button type="button" onClick={() => resetAdj({ ...watchAdj(), type: 'OUT' })}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition-all ${
                    watchAdj('type') === 'OUT' ? 'bg-white shadow-sm text-rose-600 font-bold' : 'text-slate-500'
                  }`}>
                  <ArrowDownLeft className="w-4 h-4" /><span>Stock OUT</span>
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Quantity *</label>
              <input type="number" {...regAdj('quantity', { required: true, min: 1 })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Note / Reason</label>
            <textarea {...regAdj('notes')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none h-20 resize-none" placeholder="Optional remarks..." />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">Confirm Adjustment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
