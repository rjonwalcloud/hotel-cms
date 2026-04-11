import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Box
} from 'lucide-react';
import { itemInventoryAPI } from '../../../services/api';
import { useCurrencyStore } from '../../../store/currencyStore';
import { toast } from 'react-hot-toast';

export default function ItemManagement() {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrencyStore();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCats, setExpandedCats] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catsRes] = await Promise.all([
        itemInventoryAPI.getItems(),
        itemInventoryAPI.getCategories()
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      const cats = Array.isArray(catsRes) ? catsRes : [];
      setCategories(cats);
      // Expand all by default
      setExpandedCats(new Set(cats.map(c => c.id)));
    } catch (error) {
      toast.error(t('common.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Filter items by search
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group items by category
  const grouped = categories.map(cat => ({
    ...cat,
    items: filteredItems.filter(item => item.category_id === cat.id)
  })).filter(cat => cat.items.length > 0);

  // Items without a category
  const uncategorized = filteredItems.filter(item => !item.category_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.inventory_items')}</h1>
        <p className="text-slate-500 text-sm mt-1">Browse your hotel supplies organized by category</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search items by name or SKU..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Categories</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{categories.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Items</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{items.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">In Stock</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {items.filter(i => parseInt(i.total_stock) > 0).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Low / Out</p>
          <p className="text-2xl font-black text-rose-600 mt-1">
            {items.filter(i => parseInt(i.total_stock) <= parseInt(i.min_stock_level || 0)).length}
          </p>
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-4">
        {grouped.map(cat => (
          <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedCats.has(cat.id)
                  ? <ChevronDown className="w-5 h-5 text-slate-400" />
                  : <ChevronRight className="w-5 h-5 text-slate-400" />
                }
                <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Box className="w-4 h-4 text-primary-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">{cat.name}</p>
                  {cat.description && <p className="text-xs text-slate-500">{cat.description}</p>}
                </div>
              </div>
              <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
              </span>
            </button>

            {/* Items */}
            {expandedCats.has(cat.id) && (
              <div className="border-t border-slate-100">
                <table className="w-full">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">In Stock</th>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cat.items.map(item => {
                      const stock = parseInt(item.total_stock) || 0;
                      const minStock = parseInt(item.min_stock_level) || 0;
                      const isLow = stock <= minStock && stock > 0;
                      const isOut = stock === 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center space-x-3">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-900 text-sm">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-500">{item.sku || '—'}</td>
                          <td className="px-6 py-3 text-sm font-bold text-slate-900">{formatCurrency(item.price)}</td>
                          <td className="px-6 py-3">
                            <span className={`font-bold text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                              {stock}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black uppercase">Out of Stock</span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase flex items-center w-fit gap-1">
                                <AlertCircle className="w-3 h-3" /> Low Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">In Stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="font-bold text-slate-900">Uncategorized</p>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {uncategorized.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900 text-sm">{item.name}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{item.sku || '—'}</td>
                    <td className="px-6 py-3 text-sm font-bold text-slate-900">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-3 font-bold text-sm">{parseInt(item.total_stock) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {grouped.length === 0 && uncategorized.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No items found. Go to <strong>Stocks</strong> to add categories and items.</p>
          </div>
        )}
      </div>
    </div>
  );
}
