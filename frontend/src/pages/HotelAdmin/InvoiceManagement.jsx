import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle,
  Clock,
  CreditCard,
  ShoppingBag,
  Hotel,
  UtensilsCrossed,
  ArrowRight,
  Banknote,
  Download
} from 'lucide-react';
import { invoiceAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function InvoiceManagement() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency, currencySymbol } = useCurrencyStore();
  const hotelId = getHotelId();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [filters, setFilters] = useState({
    paymentStatus: 'ALL',
    paymentMethod: 'ALL',
    invoiceType: 'ALL'
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(2024, i).toLocaleString('default', { month: 'long' })
  }));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const loadInvoices = async () => {
    if (!hotelId) return;
    try {
      setLoading(true);
      const params = { hotel_id: hotelId };
      if (searchTerm) params.search = searchTerm;
      if (reportMonth !== -1) {
        params.startDate = `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}-01`;
        params.endDate = `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}-${new Date(reportYear, reportMonth + 1, 0).getDate()} 23:59:59`;
      } else {
        params.startDate = `${reportYear}-01-01`;
        params.endDate = `${reportYear}-12-31 23:59:59`;
      }
      if (filters.paymentStatus !== 'ALL') params.paymentStatus = filters.paymentStatus;
      if (filters.paymentMethod !== 'ALL') params.paymentMethod = filters.paymentMethod;
      if (filters.invoiceType !== 'ALL') params.invoiceType = filters.invoiceType;

      const data = await invoiceAPI.getAll(params);
      setInvoices(Array.isArray(data) ? data : []);
      setErrorMsg(null);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setErrorMsg(error.message || 'Unknown database error occurred');
      toast.error(error.message || 'Failed to load invoices', { duration: 10000 });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [hotelId]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadInvoices();
  };

  const handleReset = () => {
    setSearchTerm('');
    setReportMonth(new Date().getMonth());
    setReportYear(new Date().getFullYear());
    setFilters({ paymentStatus: 'ALL', paymentMethod: 'ALL', invoiceType: 'ALL' });
    setTimeout(() => loadInvoices(), 50);
  };

  const safeFormatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      return format(date, 'dd MMM yyyy');
    } catch (e) {
      return '—';
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
          <CheckCircle className="w-3 h-3" /> PAID
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" /> UNPAID
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeConfig = {
      'BOOKING': { bg: 'bg-blue-50 text-blue-600', icon: Hotel, label: 'Booking' },
      'BULK_BOOKING': { bg: 'bg-indigo-50 text-indigo-600', icon: Hotel, label: 'Group Booking' },
      'SERVICE': { bg: 'bg-purple-50 text-purple-600', icon: ShoppingBag, label: 'Service' },
      'POS': { bg: 'bg-orange-50 text-orange-600', icon: UtensilsCrossed, label: 'POS' }
    };
    const config = typeConfig[type] || typeConfig['SERVICE'];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${config.bg}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'CASH': 'Cash',
      'CARD': 'Card',
      'UPI': 'UPI',
      'POST_TO_ROOM': 'Room Charge',
      'BANK_TRANSFER': 'Bank Transfer',
      'PO': 'Purchase Order'
    };
    return methods[method] || method || '—';
  };

  const getPaidViaTag = (row) => {
    if (!row.paid_via && !row.paid_via_ref) return null;

    if (row.paid_via === 'BOOKING') {
      return (
        <div className="flex items-center gap-1 mt-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold">
            <Hotel className="w-2.5 h-2.5" />
            Paid via Booking
          </span>
          {row.paid_via_ref && (
            <span className="text-[9px] font-mono text-blue-500">{row.paid_via_ref}</span>
          )}
        </div>
      );
    }

    if (row.paid_via === 'POS') {
      return (
        <div className="flex items-center gap-1 mt-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[9px] font-bold">
            <UtensilsCrossed className="w-2.5 h-2.5" />
            Paid via POS
          </span>
          {row.paid_via_ref && (
            <span className="text-[9px] font-mono text-orange-500">{row.paid_via_ref}</span>
          )}
        </div>
      );
    }

    return null;
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (val) => (
        <span className="text-slate-600 text-xs font-medium">
          {safeFormatDate(val)}
        </span>
      )
    },
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (val) => (
        <span className="font-mono font-bold text-primary-600 text-xs">
          {val || '—'}
        </span>
      )
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (val, row) => (
        <div>
          <span className="font-bold text-xs text-slate-800">
            {val || '—'}
          </span>
          {row.order_group_id && row.type === 'POS' && (
            <p className="text-[9px] text-slate-400 font-mono">Order: {row.order_group_id.slice(0, 8)}...</p>
          )}
        </div>
      )
    },
    {
      key: 'guest_name',
      label: 'Guest',
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-900 text-sm">{val || '—'}</p>
          {row.room_number && (
            <p className="text-[10px] text-slate-400 font-medium">Room {row.room_number}</p>
          )}
        </div>
      )
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (val) => (
        <span className="font-bold text-slate-900 text-sm">
          {formatCurrency(val || 0)}
        </span>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (val) => getTypeBadge(val)
    },
    {
      key: 'payment_method',
      label: 'Paid By',
      render: (val, row) => (
        <div>
          {val ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600">
              <CreditCard className="w-3 h-3" />
              {getPaymentMethodLabel(val)}
            </span>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
          {getPaidViaTag(row)}
        </div>
      )
    },
    {
      key: 'payment_status',
      label: 'Status',
      render: (val) => getStatusBadge(val)
    }
  ];

  // Stats
  const totalCount = invoices.length;
  const paidCount = invoices.filter(i => i.payment_status === 'PAID').length;
  const unpaidCount = totalCount - paidCount;
  const totalAmount = invoices.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const paidAmount = invoices.filter(i => i.payment_status === 'PAID').reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  // Type counts
  const bookingCount = invoices.filter(i => i.type === 'BOOKING').length;
  const serviceCount = invoices.filter(i => i.type === 'SERVICE').length;
  const posCount = invoices.filter(i => i.type === 'POS').length;

  const downloadReport = () => {
    if (invoices.length === 0) {
      toast.error('No invoices to export for the current filters');
      return;
    }

    const doc = new jsPDF();
    const titlePeriod = reportMonth === -1
      ? `Full Year ${reportYear}`
      : `${new Date(reportYear, reportMonth).toLocaleString('default', { month: 'long' })} ${reportYear}`;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Report', 105, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Period: ${titlePeriod}`, 105, 26, { align: 'center' });

    // Payment Status Summary
    const summaryRows = [
      ['Total Invoices', totalCount.toString()],
      ['Paid Invoices', paidCount.toString()],
      ['Unpaid Invoices', unpaidCount.toString()],
      ['Total Value', `${currencySymbol}${totalAmount.toFixed(2)}`],
      ['Total Paid', `${currencySymbol}${paidAmount.toFixed(2)}`],
      ['Total Unpaid', `${currencySymbol}${(totalAmount - paidAmount).toFixed(2)}`]
    ];

    doc.autoTable({
      startY: 35,
      head: [['Summary', 'Value']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
      tableWidth: 80
    });

    const detailY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Invoice Details', 14, detailY);

    const detailRows = invoices.map(r => [
      safeFormatDate(r.created_at),
      r.invoice_number || '—',
      r.guest_name || '—',
      r.type,
      getPaymentMethodLabel(r.payment_method),
      r.payment_status,
      `${currencySymbol}${(parseFloat(r.amount) || 0).toFixed(2)}`
    ]);

    doc.autoTable({
      startY: detailY + 4,
      head: [['Date', 'Invoice #', 'Guest', 'Type', 'Paid By', 'Status', 'Amount']],
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

    doc.save(`Invoice-Report-${new Date().getTime()}.pdf`);
    toast.success('Report downloaded');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary-600" />
            {t('nav.invoices')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">All invoices from bookings, service requests, and POS orders</p>
        </div>
        <button
          onClick={downloadReport}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg text-sm font-bold"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[9px] font-bold text-blue-500">{bookingCount} booking</span>
            <span className="text-[9px] font-bold text-purple-500">{serviceCount} SR</span>
            <span className="text-[9px] font-bold text-orange-500">{posCount} POS</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Paid</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{paidCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Unpaid</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{unpaidCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(totalAmount - paidAmount)}</p>
        </div>
        <div className="col-span-2 bg-primary-600 p-4 rounded-2xl shadow-xl shadow-primary-500/20 relative overflow-hidden">
          <Banknote className="absolute -right-2 -bottom-2 w-20 h-20 text-white/10" />
          <p className="text-primary-100 text-xs font-bold uppercase tracking-wider">Total Value</p>
          <p className="text-2xl font-black text-white mt-1">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <form onSubmit={handleSearch} className="space-y-3">
          {/* Row 1: Search + Type + Status */}
          <div className="flex flex-col lg:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Booking/SR/POS number, Invoice #, Room or Guest..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium"
              />
            </div>

            {/* Invoice Type Filter */}
            <select
              value={filters.invoiceType}
              onChange={(e) => setFilters({ ...filters, invoiceType: e.target.value })}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 min-w-[130px]"
            >
              <option value="ALL">All Types</option>
              <option value="BOOKING">Bookings</option>
              <option value="BULK_BOOKING">Group Bookings</option>
              <option value="SERVICE">Service Requests</option>
              <option value="POS">POS / Restaurant</option>
            </select>

            {/* Payment Status Filter */}
            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 min-w-[130px]"
            >
              <option value="ALL">All Status</option>
              <option value="PAID">Paid</option>
              <option value="NOT_PAID">Unpaid</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 min-w-[140px]"
            >
              <option value="ALL">All Payments</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="POST_TO_ROOM">Room Charge</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {/* Row 2: Date range + buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <select value={reportMonth} onChange={e => setReportMonth(parseInt(e.target.value))}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium">
                <option value={-1}>Whole Year</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={reportYear} onChange={e => setReportYear(parseInt(e.target.value))}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-lg text-sm font-bold"
              >
                <Filter className="w-4 h-4" />
                Apply
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {errorMsg && (
          <div className="p-4 bg-red-50 border-b border-red-100 m-4 rounded-xl">
            <h3 className="text-red-800 font-bold mb-1">Database Error</h3>
            <p className="text-red-600 font-mono text-xs whitespace-pre-wrap break-words">{String(errorMsg)}</p>
          </div>
        )}
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchable={false}
          emptyMessage="No invoices found. Adjust filters or create bookings/service requests."
        />
      </div>
    </div>
  );
}
