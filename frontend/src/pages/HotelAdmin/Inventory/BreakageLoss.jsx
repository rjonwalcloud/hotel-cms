import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Package,
  User,
  Calendar,
  Download
} from 'lucide-react';
import { itemInventoryAPI } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { useCurrencyStore } from '../../../store/currencyStore';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function BreakageLoss() {
  const { t } = useTranslation();
  const { hotel } = useAuthStore();
  const { formatCurrency, currencySymbol } = useCurrencyStore();
  const [reports, setReports] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  // Report filter — month=-1 means "Whole Year"
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const itemsRes = await itemInventoryAPI.getItems();
      setItems(Array.isArray(itemsRes) ? itemsRes : []);

      try {
        const reportsRes = await itemInventoryAPI.getBreakageReports();
        setReports(Array.isArray(reportsRes) ? reportsRes : []);
      } catch (e) {
        setReports([]);
      }
    } catch (error) {
      toast.error(t('common.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      await itemInventoryAPI.reportBreakage({ ...data, hotel_id: hotel?.id });
      toast.success('Breakage reported and stock updated');
      setIsModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      toast.error(error.message || t('common.error'));
    }
  };

  // Filter reports based on selected month/year
  const filteredReports = reports.filter(r => {
    const d = new Date(r.created_at);
    if (d.getFullYear() !== reportYear) return false;
    if (reportMonth === -1) return true; // Whole year
    return d.getMonth() === reportMonth;
  });

  // Calculations based on filtered data
  const totalIncidents = filteredReports.length;
  const totalItemsLost = filteredReports.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
  const totalMoneyLoss = filteredReports.reduce((sum, r) => {
    return sum + ((parseFloat(r.item_price) || 0) * (parseInt(r.quantity) || 0));
  }, 0);

  // Period label for display
  const periodLabel = reportMonth === -1
    ? `Year ${reportYear}`
    : `${new Date(reportYear, reportMonth).toLocaleString('default', { month: 'long' })} ${reportYear}`;

  // Download report
  const downloadReport = () => {
    if (filteredReports.length === 0) {
      toast.error('No data for the selected period');
      return;
    }

    const doc = new jsPDF();
    const titlePeriod = reportMonth === -1
      ? `Full Year ${reportYear}`
      : `${new Date(reportYear, reportMonth).toLocaleString('default', { month: 'long' })} ${reportYear}`;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Breakage & Loss Report', 105, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(titlePeriod, 105, 26, { align: 'center' });
    if (hotel?.name) doc.text(hotel.name, 105, 32, { align: 'center' });

    // Summary by item
    const itemSummary = {};
    filteredReports.forEach(r => {
      const key = r.item_name || 'Unknown';
      if (!itemSummary[key]) itemSummary[key] = { qty: 0, price: parseFloat(r.item_price) || 0, category: r.category_name || '—' };
      itemSummary[key].qty += parseInt(r.quantity) || 0;
    });

    const summaryRows = Object.entries(itemSummary).map(([name, data]) => [
      name,
      data.category,
      data.qty,
      `${currencySymbol}${data.price.toFixed(2)}`,
      `${currencySymbol}${(data.price * data.qty).toFixed(2)}`
    ]);

    const grandTotal = Object.values(itemSummary).reduce((s, d) => s + d.price * d.qty, 0);

    doc.autoTable({
      startY: 40,
      head: [['Item', 'Category', 'Qty Lost', 'Unit Price', 'Total Loss']],
      body: summaryRows,
      foot: [['', '', '', 'Grand Total', `${currencySymbol}${grandTotal.toFixed(2)}`]],
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: [254, 242, 242], textColor: [220, 38, 38], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 }
    });

    // Detail table
    const detailY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Incident Details', 14, detailY);

    const detailRows = filteredReports.map(r => [
      new Date(r.created_at).toLocaleDateString(),
      r.item_name,
      r.category_name || '—',
      r.quantity,
      r.type || r.reason || '—',
      r.reported_by_name || '—',
      `${currencySymbol}${((parseFloat(r.item_price) || 0) * (parseInt(r.quantity) || 0)).toFixed(2)}`
    ]);

    doc.autoTable({
      startY: detailY + 4,
      head: [['Date', 'Item', 'Category', 'Qty', 'Reason', 'Reported By', 'Loss']],
      body: detailRows,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 6: { halign: 'right' } },
      margin: { left: 14, right: 14 }
    });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

    const fileName = reportMonth === -1
      ? `Breakage-Report-${reportYear}-Full-Year.pdf`
      : `Breakage-Report-${new Date(reportYear, reportMonth).toLocaleString('default', { month: 'long' })}-${reportYear}.pdf`;
    doc.save(fileName);
    toast.success('Report downloaded');
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (val) => (
        <div className="flex items-center space-x-2 text-slate-500 text-xs">
          <Calendar className="w-3.5 h-3.5" />
          <span>{new Date(val).toLocaleDateString()}</span>
        </div>
      )
    },
    {
      key: 'category_name',
      label: 'Category',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {val || 'Uncategorized'}
        </span>
      )
    },
    {
      key: 'item_name',
      label: 'Item',
      render: (val) => (
        <div className="flex items-center space-x-2">
          <Package className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-900">{val}</span>
        </div>
      )
    },
    {
      key: 'quantity',
      label: 'Qty Lost',
      render: (val) => <span className="font-bold text-rose-600">-{val}</span>
    },
    {
      key: 'item_price',
      label: 'Loss Value',
      render: (val, row) => {
        const loss = (parseFloat(val) || 0) * (parseInt(row.quantity) || 0);
        return <span className="font-black text-rose-600">{formatCurrency(loss)}</span>;
      }
    },
    {
      key: 'type',
      label: 'Reason',
      render: (val) => <span className="text-slate-600 text-sm">{val}</span>
    },
    {
      key: 'reported_by_name',
      label: 'Reported By',
      render: (val) => (
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <User className="w-3 h-3" />
          <span>{val || '—'}</span>
        </div>
      )
    }
  ];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(2024, i).toLocaleString('default', { month: 'long' })
  }));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.breakage_loss')}</h1>
          <p className="text-slate-500 text-sm mt-1">Report and track broken or lost inventory items</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-500/20 font-medium"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Report Damage</span>
        </button>
      </div>

      {/* Period Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-900">Filter & Reports</p>
            <p className="text-xs text-slate-500">Select a period to filter dashboard, table data, and download reports</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={reportMonth} onChange={e => setReportMonth(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none">
              <option value={-1}>Whole Year</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={reportYear} onChange={e => setReportYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={downloadReport}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-sm font-bold">
              <Download className="w-4 h-4" /><span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary — filtered by selected period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Incidents</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalIncidents}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{periodLabel}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Items Lost</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalItemsLost}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{periodLabel}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Loss</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(totalMoneyLoss)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{periodLabel}</p>
        </div>
        <div className="bg-rose-600 p-4 rounded-2xl shadow-xl shadow-rose-500/20 relative overflow-hidden">
          <AlertTriangle className="absolute -right-2 -bottom-2 w-20 h-20 text-white/10" />
          <p className="text-rose-100 text-xs font-bold uppercase tracking-wider">All Time Loss</p>
          <p className="text-2xl font-black text-white mt-1">
            {formatCurrency(reports.reduce((sum, r) => sum + ((parseFloat(r.item_price) || 0) * (parseInt(r.quantity) || 0)), 0))}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredReports}
          loading={loading}
          searchable={false}
          emptyMessage={`No breakage incidents for ${periodLabel}.`}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Report New Incident">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Item *</label>
              <select {...register('item_id', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="">Select Item</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.category_name ? `${item.category_name} — ` : ''}{item.name} ({formatCurrency(item.price)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Quantity *</label>
              <input type="number" {...register('quantity', { required: true, min: 1 })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Reason *</label>
              <select {...register('reason', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                <option value="Broken">Broken / Damaged</option>
                <option value="Lost">Lost / Missing</option>
                <option value="Expired">Expired</option>
                <option value="Theft">Possible Theft</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Notes</label>
            <textarea {...register('notes')}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none h-20 resize-none"
              placeholder="Describe the incident..." />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-500/20">
              Submit Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
