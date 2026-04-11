import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Truck,
  FileText,
  Download,
  Mail,
  Phone,
  Building,
  Eye,
  X,
  Calendar,
  User,
  Package,
  ChevronDown,
  ChevronUp
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

export default function Suppliers() {
  const { t } = useTranslation();
  const { hotel } = useAuthStore();
  const { formatCurrency, currencySymbol } = useCurrencyStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'orders';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [expandedPO, setExpandedPO] = useState(null);
  const [poDetail, setPODetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiveLoading, setReceiveLoading] = useState(false);

  const { register, handleSubmit, reset } = useForm();
  const { register: regSup, handleSubmit: handleSupSub, reset: resetSup } = useForm();

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'orders');
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [supRes, itemsRes, poRes] = await Promise.all([
        itemInventoryAPI.getSuppliers(),
        itemInventoryAPI.getItems(),
        itemInventoryAPI.getPOs().catch(() => [])
      ]);
      setSuppliers(Array.isArray(supRes) ? supRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setOrders(Array.isArray(poRes) ? poRes : []);

    } catch (error) {
      toast.error(t('common.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const onPOSubmit = async (data) => {
    try {
      await itemInventoryAPI.createPO({ ...data, hotel_id: hotel?.id });
      toast.success(t('common.update_success'));
      setIsPOModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const onSupplierSubmit = async (data) => {
    try {
      await itemInventoryAPI.createSupplier({ ...data, hotel_id: hotel?.id });
      toast.success(t('common.update_success'));
      setIsSupplierModalOpen(false);
      resetSup();
      fetchData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const openReceiveModal = async (poRow) => {
    setSelectedPO(poRow);
    setReceiveLoading(true);
    setIsReceiveModalOpen(true);
    try {
      const detail = await itemInventoryAPI.getPODetail(poRow.id);
      const items = (detail.items || []).map(item => ({
        po_item_id: item.id,
        item_id: item.item_id,
        item_name: item.item_name,
        sku: item.sku,
        ordered_quantity: parseFloat(item.quantity),
        received_quantity: parseFloat(item.quantity), // default to ordered qty
        unit_price: parseFloat(item.unit_price),
        remarks: ''
      }));
      setReceiveItems(items);
    } catch (error) {
      toast.error('Failed to load PO items');
      setIsReceiveModalOpen(false);
    } finally {
      setReceiveLoading(false);
    }
  };

  const updateReceiveItem = (idx, field, value) => {
    setReceiveItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  const onReceiveSubmit = async (e) => {
    e.preventDefault();
    try {
      await itemInventoryAPI.receivePO(selectedPO.id, {
        items: receiveItems.map(item => ({
          po_item_id: item.po_item_id,
          received_quantity: item.received_quantity,
          remarks: item.remarks
        }))
      });
      toast.success('Stock updated successfully');
      setIsReceiveModalOpen(false);
      setReceiveItems([]);
      fetchData();
      // Refresh detail if expanded
      if (expandedPO === selectedPO.id) {
        setExpandedPO(null);
        setPODetail(null);
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const viewPODetail = async (poRow) => {
    if (expandedPO === poRow.id) {
      setExpandedPO(null);
      setPODetail(null);
      return;
    }
    try {
      setDetailLoading(true);
      setExpandedPO(poRow.id);
      const detail = await itemInventoryAPI.getPODetail(poRow.id);
      setPODetail(detail);
    } catch (error) {
      toast.error('Failed to load PO details');
      setExpandedPO(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const generateInvoice = async (poRow) => {
    try {
      const po = await itemInventoryAPI.getPODetail(poRow.id);
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('PURCHASE ORDER', 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`PO #: ${po.po_number}`, 14, 35);
      doc.text(`Date: ${new Date(po.created_at).toLocaleDateString()}`, 14, 41);
      doc.text(`Status: ${po.status}`, 14, 47);
      doc.text(`Created By: ${po.created_by_name || '—'}`, 14, 53);

      // Hotel info (right side)
      if (po.hotel_name) {
        doc.setFont('helvetica', 'bold');
        doc.text(po.hotel_name, 196, 35, { align: 'right' });
        doc.setFont('helvetica', 'normal');
      }

      // Supplier box
      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 60, 182, 30, 2, 2, 'FD');
      doc.setTextColor(60);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('SUPPLIER', 18, 68);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(po.supplier_name || '—', 18, 75);
      const supplierDetails = [po.supplier_contact, po.supplier_phone, po.supplier_email].filter(Boolean).join('  |  ');
      if (supplierDetails) doc.text(supplierDetails, 18, 82);

      // Items table
      const isReceived = po.status === 'RECEIVED';
      const headers = isReceived
        ? [['#', 'Item', 'SKU', 'Ordered', 'Received', 'Unit Price', 'Ordered Total', 'Received Total', 'Remarks']]
        : [['#', 'Item', 'SKU', 'Qty', 'Unit Price', 'Total']];

      const tableRows = (po.items || []).map((item, idx) => {
        const orderedQty = parseFloat(item.quantity);
        const recvQty = item.received_quantity != null ? parseFloat(item.received_quantity) : null;
        const recvTotal = recvQty != null ? recvQty * parseFloat(item.unit_price) : null;
        if (isReceived) {
          return [
            idx + 1,
            item.item_name || '—',
            item.sku || '—',
            orderedQty,
            recvQty != null ? recvQty : '—',
            `${currencySymbol}${parseFloat(item.unit_price).toFixed(2)}`,
            `${currencySymbol}${parseFloat(item.total_price).toFixed(2)}`,
            recvTotal != null ? `${currencySymbol}${recvTotal.toFixed(2)}` : '—',
            item.remarks || '—'
          ];
        }
        return [
          idx + 1,
          item.item_name || '—',
          item.sku || '—',
          orderedQty,
          `${currencySymbol}${parseFloat(item.unit_price).toFixed(2)}`,
          `${currencySymbol}${parseFloat(item.total_price).toFixed(2)}`
        ];
      });

      const colStyles = isReceived
        ? { 0: { cellWidth: 10, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
        : { 0: { cellWidth: 12, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } };

      doc.autoTable({
        startY: 98,
        head: headers,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: colStyles,
        margin: { left: 14, right: 14 }
      });

      // Totals
      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60);
      doc.text(`Ordered Total: ${currencySymbol}${parseFloat(po.total_amount).toFixed(2)}`, 196, finalY, { align: 'right' });

      if (po.received_amount != null) {
        const recAmt = parseFloat(po.received_amount);
        const ordAmt = parseFloat(po.total_amount);
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Received Total: ${currencySymbol}${recAmt.toFixed(2)}`, 196, finalY + 7, { align: 'right' });
        if (recAmt !== ordAmt) {
          const diff = recAmt - ordAmt;
          doc.setFontSize(9);
          doc.setTextColor(diff > 0 ? 34 : 220, diff > 0 ? 139 : 38, diff > 0 ? 34 : 38);
          doc.text(`(${diff > 0 ? '+' : ''}${currencySymbol}${diff.toFixed(2)})`, 196, finalY + 13, { align: 'right' });
        }
      }

      // Notes
      const notesY = po.received_amount != null ? finalY + 20 : finalY + 10;
      if (po.notes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Notes: ${po.notes}`, 14, notesY);
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

      doc.save(`PO-${po.po_number}.pdf`);
      toast.success('Invoice PDF downloaded');
    } catch (error) {
      toast.error('Failed to generate invoice');
    }
  };

  const poColumns = [
    {
      key: 'created_at',
      label: t('inventory_mgmt.procurement.incident_date'),
      render: (val) => new Date(val).toLocaleDateString()
    },
    {
      key: 'supplier_name',
      label: t('inventory_mgmt.procurement.vendor')
    },
    {
      key: 'total_amount',
      label: t('inventory_mgmt.procurement.total_value'),
      render: (val, row) => {
        const ordered = parseFloat(val) || 0;
        const received = row.received_amount != null ? parseFloat(row.received_amount) : null;
        const diff = received != null ? received - ordered : null;
        return (
          <div>
            <span className="font-bold text-slate-900">{formatCurrency(ordered)}</span>
            {received != null && diff !== 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-slate-400">Received:</span>
                <span className={`text-xs font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(received)}
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      label: t('inventory_mgmt.procurement.po_status.received'),
      render: (val) => {
        const statuses = {
          'PENDING': 'bg-amber-50 text-amber-600',
          'ORDERED': 'bg-blue-50 text-blue-600',
          'RECEIVED': 'bg-emerald-50 text-emerald-600',
          'CANCELLED': 'bg-slate-50 text-slate-400',
          'DRAFT': 'bg-gray-50 text-gray-600'
        };
        return (
          <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-tight ${statuses[val] || ''}`}>
            {val}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => viewPODetail(row)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
              expandedPO === row.id
                ? 'bg-primary-100 text-primary-700 border-primary-200'
                : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
            }`}
          >
            {expandedPO === row.id ? <ChevronUp className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {expandedPO === row.id ? 'Hide' : 'View'}
          </button>
          <button
            onClick={() => generateInvoice(row)}
            className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all border border-slate-200 flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Invoice
          </button>
          {row.status !== 'RECEIVED' && row.status !== 'CANCELLED' && (
            <button
              onClick={() => openReceiveModal(row)}
              className="px-3 py-1 bg-primary-50 text-primary-600 rounded-lg text-xs font-bold hover:bg-primary-100 transition-all border border-primary-100"
            >
              Receive Stock
            </button>
          )}
        </div>
      )
    }
  ];

  const supplierColumns = [
    {
      key: 'name',
      label: 'Company',
      render: (val, row) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <Building className="w-4 h-4 text-slate-500" />
          </div>
          <span className="font-medium text-slate-900">{row.name}</span>
        </div>
      )
    },
    {
      key: 'contact_person',
      label: 'Contact Person'
    },
    {
      key: 'email',
      label: 'Email / Phone',
      render: (val, row) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Mail className="w-3 h-3" />
            <span>{row.email}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Phone className="w-3 h-3" />
            <span>{row.phone}</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.procurement')}</h1>
          <p className="text-slate-500 text-sm mt-1">Manage purchase orders and supplier relationships</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'orders' ? (
            <button
              onClick={() => setIsPOModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Create PO</span>
            </button>
          ) : (
            <button
              onClick={() => setIsSupplierModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl transition-all ${
            activeTab === 'orders' ? 'bg-white text-primary-600 shadow-sm font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Orders</span>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl transition-all ${
            activeTab === 'suppliers' ? 'bg-white text-primary-600 shadow-sm font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Suppliers</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {activeTab === 'orders' ? (
          <>
            <DataTable
              columns={poColumns}
              data={orders}
              loading={loading}
              searchable={false}
              emptyMessage="No purchase orders found."
            />
            {/* PO Detail Panel */}
            {expandedPO && (
              <div className="border-t-2 border-primary-100 bg-slate-50/50 p-6 animate-in">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                  </div>
                ) : poDetail ? (
                  <div className="space-y-5">
                    {/* Detail Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">PO #{poDetail.po_number}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Purchase Order Details</p>
                      </div>
                      <button onClick={() => { setExpandedPO(null); setPODetail(null); }}
                        className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Date</p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{new Date(poDetail.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ordered By</p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{poDetail.created_by_name || '—'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Received By</p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{poDetail.received_by_name || '—'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Received Date</p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">
                          {poDetail.received_at ? new Date(poDetail.received_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Supplier Info */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Supplier</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{poDetail.supplier_name || '—'}</p>
                          <p className="text-xs text-slate-500">
                            {[poDetail.supplier_contact, poDetail.supplier_phone, poDetail.supplier_email].filter(Boolean).join(' | ') || 'No contact info'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Items Ordered */}
                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary-500" />
                        <p className="text-sm font-bold text-slate-900">Items Ordered</p>
                        <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600">
                          {poDetail.items?.length || 0}
                        </span>
                      </div>
                      <table className="w-full">
                        <thead className="bg-slate-50/80">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Received</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Price</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                            {poDetail.status === 'RECEIVED' && (
                              <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(poDetail.items || []).map((item, idx) => {
                            const ordered = parseFloat(item.quantity);
                            const received = item.received_quantity != null ? parseFloat(item.received_quantity) : null;
                            const diff = received != null ? received - ordered : null;
                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2.5 text-sm text-slate-400">{idx + 1}</td>
                                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{item.item_name}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-500">{item.sku || '—'}</td>
                                <td className="px-4 py-2.5 text-sm text-right font-bold text-slate-900">{ordered}</td>
                                <td className="px-4 py-2.5 text-sm text-right">
                                  {received != null ? (
                                    <div className="flex flex-col items-end">
                                      <span className="font-bold text-slate-900">{received}</span>
                                      {diff !== 0 && (
                                        <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {diff > 0 ? `+${diff}` : diff}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                                <td className="px-4 py-2.5 text-sm text-right font-bold text-slate-900">{formatCurrency(item.total_price)}</td>
                                {poDetail.status === 'RECEIVED' && (
                                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[150px]">{item.remarks || '—'}</td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-right text-sm font-black text-slate-700 uppercase">Ordered Total</td>
                            <td className="px-4 py-3 text-right text-base font-black text-slate-700">{formatCurrency(poDetail.total_amount)}</td>
                            {poDetail.status === 'RECEIVED' && <td></td>}
                          </tr>
                          {poDetail.received_amount != null && (
                            <tr className="border-t border-slate-100">
                              <td colSpan={5} className="px-4 py-3 text-right text-sm font-black text-slate-700 uppercase">Received Total</td>
                              <td className="px-4 py-3 text-right text-base font-black text-primary-600">
                                {formatCurrency(poDetail.received_amount)}
                                {parseFloat(poDetail.received_amount) !== parseFloat(poDetail.total_amount) && (
                                  <span className={`ml-2 text-xs font-bold ${parseFloat(poDetail.received_amount) > parseFloat(poDetail.total_amount) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ({parseFloat(poDetail.received_amount) > parseFloat(poDetail.total_amount) ? '+' : ''}{formatCurrency(parseFloat(poDetail.received_amount) - parseFloat(poDetail.total_amount))})
                                  </span>
                                )}
                              </td>
                              {poDetail.status === 'RECEIVED' && <td></td>}
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>

                    {/* Notes */}
                    {poDetail.notes && (
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-sm text-amber-800">{poDetail.notes}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <DataTable
            columns={supplierColumns}
            data={suppliers}
            loading={loading}
            searchable={false}
            emptyMessage="No suppliers registered yet."
          />
        )}
      </div>

      {/* Create PO Modal */}
      <Modal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        title="Create Purchase Order"
      >
        <form onSubmit={handleSubmit(onPOSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Supplier *</label>
              <select
                {...register('supplier_id', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Item *</label>
              <select
                {...register('item_id', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="">Select Item</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Quantity *</label>
              <input
                type="number"
                {...register('quantity', { required: true, min: 1 })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Unit Price *</label>
              <input
                type="number"
                step="0.01"
                {...register('unit_price', { required: true })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
            >
              Generate PO
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title="Register New Supplier"
      >
        <form onSubmit={handleSupSub(onSupplierSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Company Name *</label>
            <input
              {...regSup('name', { required: true })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              placeholder="e.g. Best Supplies Ltd."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Contact Person</label>
              <input
                {...regSup('contact_person')}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Phone</label>
              <input
                {...regSup('phone')}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input
              {...regSup('email')}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
            >
              Save Supplier
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Stock Modal */}
      <Modal
        isOpen={isReceiveModalOpen}
        onClose={() => { setIsReceiveModalOpen(false); setReceiveItems([]); }}
        title={`Receive Stock — PO #${selectedPO?.po_number || ''}`}
      >
        {receiveLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <form onSubmit={onReceiveSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-700">
                <strong>Info:</strong> Adjust the received quantity for each item. You can receive more or less than ordered.
              </p>
            </div>

            {/* Per-item receive table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                    <th className="px-3 py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered</th>
                    <th className="px-3 py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Received</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveItems.map((item, idx) => {
                    const diff = item.received_quantity - item.ordered_quantity;
                    return (
                      <tr key={item.po_item_id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900 text-sm">{item.item_name}</p>
                          {item.sku && <p className="text-[10px] text-slate-400">{item.sku}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-bold text-slate-700 text-sm">{item.ordered_quantity}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.received_quantity}
                              onChange={(e) => updateReceiveItem(idx, 'received_quantity', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                            {diff !== 0 && (
                              <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff > 0 ? `+${diff} extra` : `${diff} short`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.remarks}
                            onChange={(e) => updateReceiveItem(idx, 'remarks', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            placeholder="e.g. 1 damaged"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
              <span className="text-xs font-bold text-slate-500">Total Receiving</span>
              <span className="text-sm font-black text-slate-900">
                {receiveItems.reduce((s, i) => s + i.received_quantity, 0)} items
                {' — '}
                {formatCurrency(receiveItems.reduce((s, i) => s + (i.received_quantity * i.unit_price), 0))}
              </span>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg"
              >
                Confirm Receipt
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
