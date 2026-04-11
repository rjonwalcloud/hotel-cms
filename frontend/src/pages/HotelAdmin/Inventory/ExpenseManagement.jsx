import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Calendar,
  CreditCard,
  TrendingUp
} from 'lucide-react';
import { itemInventoryAPI } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { useCurrencyStore } from '../../../store/currencyStore';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';

export default function ExpenseManagement() {
  const { t } = useTranslation();
  const { hotel } = useAuthStore();
  const { formatCurrency, currencySymbol } = useCurrencyStore();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const catsRes = await itemInventoryAPI.getCategories();
      setCategories(Array.isArray(catsRes) ? catsRes : []);

      try {
        const expRes = await itemInventoryAPI.getExpenses();
        setExpenses(Array.isArray(expRes) ? expRes : []);
      } catch (e) {
        setExpenses([]);
      }
    } catch (error) {
      toast.error(t('common.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      await itemInventoryAPI.logExpense({ ...data, hotel_id: hotel?.id });
      toast.success('Expense logged');
      setIsModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  // Calculate totals
  const totalSpend = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const thisMonth = expenses
    .filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
    })
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const columns = [
    {
      key: 'expense_date',
      label: 'Date',
      render: (val) => (
        <div className="flex items-center space-x-2 text-slate-500 text-xs">
          <Calendar className="w-3.5 h-3.5" />
          <span>{new Date(val).toLocaleDateString()}</span>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {val || 'General'}
        </span>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => <span className="font-medium text-slate-900">{val}</span>
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (val) => <span className="font-black text-slate-900">{formatCurrency(val)}</span>
    },
    {
      key: 'payment_method',
      label: 'Payment',
      render: (val) => (
        <div className="flex items-center space-x-1.5">
          <CreditCard className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-500">{val || '—'}</span>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.expenses')}</h1>
          <p className="text-slate-500 text-sm mt-1">Track inventory-related spending</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Log Expense</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{expenses.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(thisMonth)}</p>
        </div>
        <div className="bg-primary-600 p-4 rounded-2xl shadow-xl shadow-primary-500/20 relative overflow-hidden">
          <TrendingUp className="absolute -right-2 -bottom-2 w-20 h-20 text-white/10" />
          <p className="text-primary-100 text-xs font-bold uppercase tracking-wider">All Time</p>
          <p className="text-2xl font-black text-white mt-1">{formatCurrency(totalSpend)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={expenses}
          loading={loading}
          searchable={false}
          emptyMessage="No expenses recorded yet."
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Expense">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Description *</label>
            <input {...register('description', { required: true })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              placeholder="e.g. Monthly cleaning supplies order" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Category *</label>
              <select {...register('category', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="">Select Category</option>
                <option value="Purchase Order">Purchase Order</option>
                <option value="Stock Adjustment">Stock Adjustment</option>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                <option value="General">General</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Amount ({currencySymbol}) *</label>
              <input type="number" step="0.01" {...register('amount', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Date *</label>
              <input type="date" {...register('expense_date', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Payment Method *</label>
              <select {...register('payment_method', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/20">
              Log Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
