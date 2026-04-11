import React, { useState, useEffect, useCallback } from 'react';
import { bookingAPI, roomAPI, promotionAPI, addonAPI, quoteAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import PromptModal from '../../components/PromptModal';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, XCircle, DollarSign, Eye, Clock, Loader2, RefreshCw, Tag, Info, UserPlus, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

export default function BookingManagement() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [extraCharges, setExtraCharges] = useState([{ description: '', amount: '' }]);
  const [billingSummary, setBillingSummary] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [isSettling, setIsSettling] = useState(false);

  // Front / Standard Check-in Booking state
  const [showFrontBookingModal, setShowFrontBookingModal] = useState(false);
  const [isExistingBookingCheckIn, setIsExistingBookingCheckIn] = useState(false);
  const [fbStep, setFbStep] = useState(0);
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbForm, setFbForm] = useState({
    guest_name: '', guest_email: '', guest_phone: '',
    check_in_date: '', check_out_date: '',
    adults: 1, children: 0,
    room_type_id: '', room_ids: [],
    addons: [], guest_details: []
  });

  const [fbQuote, setFbQuote] = useState(null);
  const [fbQuoteLoading, setFbQuoteLoading] = useState(false);

  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineBooking, setTimelineBooking] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [availableAddons, setAvailableAddons] = useState([]);

  const [roomTypes, setRoomTypes] = useState([]);
  const [availableRoomsByType, setAvailableRoomsByType] = useState({});
  const [assignedRoomIds, setAssignedRoomIds] = useState([]);

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const confirmAction = (title, message, onConfirm) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };

  const promptAction = (title, message, onConfirm) => {
    setPromptConfig({ isOpen: true, title, message, onConfirm });
  };

  // Filtering states
  const [filters, setFilters] = useState({
    status: '',
    from_date: '',
    to_date: '',
    search: '',
  });
  const [datePreset, setDatePreset] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    check_in_date: '',
    check_out_date: '',
    adults: 1,
    children: 0,
    room_type_id: '',
    quantity: 1,
    addons: []
  });

  useEffect(() => {
    if (hotelId) {
      loadBookings();
      loadRoomTypes();
    } else {
      setLoading(false);
    }
  }, [hotelId, filters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadBookings = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await bookingAPI.getByHotel(hotelId, filters);
      setBookings(data.bookings || []);
    } catch (error) {
      toast.error(t('bookings.messages.loading'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRoomTypes = async () => {
    try {
      const data = await roomAPI.getTypes(hotelId);
      setRoomTypes(data.roomTypes || []);
    } catch (error) {
      console.error('Failed to load room types');
    }
  };

  const loadActiveAddons = async () => {
    try {
      const data = await addonAPI.getByHotel(hotelId);
      setAvailableAddons(data.addons?.filter(a => a.is_active) || []);
    } catch (err) {
      console.error('Failed to load addons');
    }
  };

  const loadAvailableRooms = async () => {
    if (!hotelId) return;
    try {
      const data = await roomAPI.getByHotel(hotelId);
      const rooms = data.rooms || [];
      const byType = {};
      rooms.filter(r => r.status === 'AVAILABLE').forEach(r => {
        if (!byType[r.room_type_id]) byType[r.room_type_id] = [];
        byType[r.room_type_id].push(r);
      });
      setAvailableRoomsByType(byType);
    } catch (error) {
      console.error('Failed to load rooms');
    }
  };

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let from = '';
    let to = '';

    switch (preset) {
      case 'today':
        from = format(today, 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        from = format(tomorrow, 'yyyy-MM-dd');
        to = format(tomorrow, 'yyyy-MM-dd');
        break;
      case 'this-week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        from = format(startOfWeek, 'yyyy-MM-dd');
        to = format(endOfWeek, 'yyyy-MM-dd');
        break;
      case 'last-30-days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        from = format(thirtyDaysAgo, 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'all':
      default:
        from = '';
        to = '';
        break;
    }

    if (preset !== 'custom') {
      setFilters(prev => ({ ...prev, from_date: from, to_date: to }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await bookingAPI.create({ ...formData, hotel_id: hotelId });
      toast.success(t('bookings.modals.create.submit'));
      toast.success('Booking created!');
      setShowModal(false);
      loadBookings();
      resetForm();
    } catch (error) {
      toast.error(error.message || t('bookings.modals.create.submit'));
    }
  };

  // Front Booking / Check-in handlers
  const openFrontBooking = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
    setFbForm({
      guest_name: '', guest_email: '', guest_phone: '',
      check_in_date: today, check_out_date: tomorrow,
      adults: 1, children: 0,
      room_type_id: '', room_ids: [],
      addons: [], guest_details: [{ full_name: '', age: '', id_proof_type: 'Aadhar', id_proof_number: '' }]
    });
    setFbStep(0);
    setFbQuote(null);
    setIsExistingBookingCheckIn(false);
    setSelectedBooking(null);
    loadAvailableRooms();
    loadActiveAddons();
    setShowFrontBookingModal(true);
  };

  const handleOpenCheckIn = async (booking) => {
    setSelectedBooking(booking);
    try {
      // Fetch full booking details to get addons
      const response = await bookingAPI.getById(booking.id, hotelId);
      const fullBooking = response.booking || booking;

      const checkInStr = fullBooking.check_in_date ? format(new Date(fullBooking.check_in_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const checkOutStr = fullBooking.check_out_date ? format(new Date(fullBooking.check_out_date), 'yyyy-MM-dd') : format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
      const adults = fullBooking.adults || 1;
      const children = fullBooking.children || 0;

      setFbForm({
        guest_name: fullBooking.guest_name || '',
        guest_email: fullBooking.guest_email || '',
        guest_phone: fullBooking.guest_phone || '',
        check_in_date: checkInStr,
        check_out_date: checkOutStr,
        adults,
        children,
        room_type_id: fullBooking.room_type_id || '',
        room_ids: fullBooking.rooms ? fullBooking.rooms.map(r => r.id) : [],
        addons: fullBooking.addons ? fullBooking.addons.map(a => ({ addon_id: a.addon_id, quantity: a.quantity, name: a.name, price: a.price_at_booking })) : [],
        guest_details: Array.from({ length: adults + children }, () => ({
          full_name: '', age: '', id_proof_type: 'Aadhar', id_proof_number: ''
        }))
      });
      setFbStep(0);
      setIsExistingBookingCheckIn(true);
      loadAvailableRooms();
      loadActiveAddons();
      setShowFrontBookingModal(true);
    } catch (error) {
      toast.error('Failed to load booking details for check-in');
    }
  };

  const handleFrontBookingSubmit = async () => {
    if (!fbForm.guest_name || !fbForm.room_type_id || !fbForm.room_ids.length) {
      toast.error('Please fill guest name, select room type and assign room(s)');
      return;
    }
    try {
      setFbSubmitting(true);
      if (isExistingBookingCheckIn && selectedBooking) {
        await bookingAPI.checkIn(selectedBooking.id, hotelId, fbForm.guest_details, fbForm.room_ids, { ...fbForm });
        toast.success(t('bookings.messages.check_in_success'));
      } else {
        await bookingAPI.createFrontBooking({ ...fbForm, hotel_id: hotelId });
        toast.success('Walk-in guest checked in successfully!');
      }
      setShowFrontBookingModal(false);
      loadBookings();
    } catch (error) {
      toast.error(error.message || 'Failed to complete check-in');
    } finally {
      setFbSubmitting(false);
    }
  };

  const handleOpenCheckOut = (booking) => {
    setSelectedBooking(booking);
    setExtraCharges([{ description: '', amount: '' }]);
    setShowCheckOutModal(true);
  };

  const handlePreviewBilling = async () => {
    try {
      const charges = extraCharges.filter(c => c.description && c.amount);
      const res = await bookingAPI.getBilling(selectedBooking.id, hotelId, {
        charges: JSON.stringify(charges),
        coupon_code: couponCode
      });
      setBillingSummary(res.billing);
      toast.success(t('bookings.messages.bill_calculated'));
    } catch (err) {
      console.error('Preview billing error:', err);
      toast.error('Failed to calculate bill');
    }
  };

  const handleCheckOutSubmit = async () => {
    confirmAction(t('bookings.messages.confirm_check_out'), t('bookings.messages.confirm_check_out_msg'), async () => {
      try {
        const charges = extraCharges.filter(c => c.description && c.amount);
        const result = await bookingAPI.checkOut(selectedBooking.id, hotelId, charges, couponCode);
        toast.success(t('bookings.messages.check_out_success'));

        // Update local state to show the finalized invoice and settlement options
        setBillingSummary(result.billing);
        // Refresh the selected booking status locally
        setSelectedBooking(prev => ({ ...prev, status: 'CHECKED_OUT' }));
        setCouponCode('');
        loadBookings();
      } catch (error) {
        const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Check-out failed';
        if (errMsg.toLowerCase().includes('pending service request')) {
          confirmAction('Checkout Blocked', errMsg, () => {
            // Acknowledge warning
            setShowCheckOutModal(false);
          });
        } else {
          toast.error(errMsg);
        }
      }
    });
  };

  const handleSettlePayment = async () => {
    if (!selectedBooking || !paymentMethod) return;
    setIsSettling(true);
    try {
      await bookingAPI.settlePayment(selectedBooking.id, hotelId, paymentMethod);
      toast.success('Payment settled successfully!');
      // Update local billing summary state to reflect payment
      setBillingSummary(prev => ({
        ...prev,
        payment_status: 'PAID',
        payment_method: paymentMethod
      }));
      loadBookings();
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'Failed to settle payment';
      toast.error(errMsg);
    } finally {
      setIsSettling(false);
    }
  };

  const handleViewInvoice = async (booking) => {
    try {
      const data = await bookingAPI.getBilling(booking.id, hotelId);
      setBillingSummary(data.billing);
      setSelectedBooking(booking);
      setShowCheckOutModal(true);
    } catch (error) {
      toast.error('Failed to load invoice details');
    }
  };

  const handleCancel = async (booking) => {
    promptAction(t('bookings.messages.cancel_confirm_title'), t('bookings.messages.cancel_confirm_msg'), async (reason) => {
      try {
        await bookingAPI.cancel(booking.id, hotelId, reason);
        toast.success(t('bookings.messages.booking_cancelled'));
        loadBookings();
      } catch (error) {
        toast.error(error.message || 'Cancellation failed');
      }
    });
  };

  const handleViewTimeline = async (booking) => {
    try {
      setTimelineLoading(true);
      setShowTimelineModal(true);
      const data = await bookingAPI.getById(booking.id, hotelId);
      setTimelineBooking(data.booking);
    } catch (error) {
      toast.error(t('bookings.messages.not_found'));
      setShowTimelineModal(false);
    } finally {
      setTimelineLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      guest_name: '',
      guest_email: '',
      guest_phone: '',
      check_in_date: '',
      check_out_date: '',
      adults: 1,
      children: 0,
      room_type_id: '',
      quantity: 1,
      addons: []
    });
    setSelectedBooking(null);
  };

  const columns = [
    {
      key: 'booking_ref',
      label: t('bookings.table.pnr'),
      render: (value) => <span className="font-mono">{value || 'NA'}</span>
    },
    { key: 'guest_name', label: t('bookings.table.guest') },
    {
      key: 'room_type_id',
      label: t('bookings.table.requirements'),
      render: (value, booking) => {
        if (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') {
          return booking.rooms?.map(r => r.room_number).join(', ') || 'N/A';
        }
        return `${booking.quantity || 1}x ${booking.room_type_name || 'Room'}`;
      }
    },
    {
      key: 'check_in_date',
      label: t('bookings.table.check_in'),
      render: (value) => value ? format(new Date(value), 'MMM dd, yyyy') : 'N/A'
    },
    {
      key: 'check_out_date',
      label: t('bookings.table.check_out'),
      render: (value) => value ? format(new Date(value), 'MMM dd, yyyy') : 'N/A'
    },
    {
      key: 'total_amount',
      label: t('bookings.table.amount'),
      render: (value) => value ? formatCurrency(value) : '--'
    },
    {
      key: 'status',
      label: t('bookings.table.status'),
      render: (value) => {
        const statusMap = {
          'CREATED': t('bookings.status.created'),
          'CONFIRMED': t('bookings.status.confirmed'),
          'CHECKED_IN': t('bookings.status.checked_in'),
          'CHECKED_OUT': t('bookings.status.checked_out'),
          'CANCELLED': t('bookings.status.cancelled'),
          'NO_SHOW': t('bookings.status.no_show'),
          'REFUNDED': t('bookings.status.refunded')
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'CREATED' ? 'bg-gray-100 text-gray-800' :
            value === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
              value === 'CHECKED_IN' ? 'bg-blue-100 text-blue-800' :
                value === 'CHECKED_OUT' ? 'bg-purple-100 text-purple-800' :
                  value === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                    value === 'NO_SHOW' ? 'bg-orange-100 text-orange-800' :
                      value === 'REFUNDED' ? 'bg-slate-100 text-slate-800' :
                        'bg-yellow-100 text-yellow-800'
            }`}>
            {statusMap[value] || value.replace('_', ' ')}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_, booking) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewTimeline(booking)}
            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center"
            title={t('bookings.actions.details')}
          >
            <Eye className="w-3 h-3 md:mr-1" /> <span className="hidden md:inline">{t('bookings.actions.details')}</span>
          </button>
          {(booking.status === 'CREATED' || booking.status === 'CONFIRMED') && (
            <button
              onClick={() => handleOpenCheckIn(booking)}
              className="text-xs btn btn-primary py-1 px-2"
              title={t('bookings.actions.check_in')}
            >
              <CheckCircle className="w-3 h-3 mr-1" /> {t('bookings.actions.check_in')}
            </button>
          )}
          {booking.status === 'CHECKED_IN' && (
            <button
              onClick={() => handleOpenCheckOut(booking)}
              className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 flex items-center"
              title={t('bookings.actions.check_out')}
            >
              <DollarSign className="w-3 h-3 mr-1" /> {t('bookings.actions.check_out')}
            </button>
          )}
          {booking.status === 'CHECKED_OUT' && (
            <button
              onClick={() => handleViewInvoice(booking)}
              className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 flex items-center"
              title={booking.payment_status === 'PAID' ? 'Paid Invoice' : 'Unpaid Invoice'}
            >
              <DollarSign className="w-3 h-3 mr-1" /> {booking.payment_status === 'PAID' ? 'Paid Invoice' : 'Unpaid Invoice'}
            </button>
          )}
          {(booking.status === 'CREATED' || booking.status === 'CONFIRMED') && (
            <button
              onClick={() => handleCancel(booking)}
              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
              title={t('bookings.actions.cancel')}
            >
              <XCircle className="w-3 h-3" />
            </button>
          )}
        </div>
      )
    },
  ];

  if (loading) return <div>{t('bookings.messages.loading')}</div>;
  if (!hotelId) return <div>{t('bookings.messages.no_hotel')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('bookings.title')}</h1>
          <p className="text-gray-600">{t('bookings.subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => loadBookings(true)}
            disabled={refreshing}
            className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center transition-all active:scale-95"
            title={t('common.refresh')}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('common.refreshing') : t('common.refresh')}
          </button>
          <button
            onClick={() => {
              resetForm();
              loadAvailableRooms();
              loadActiveAddons();
              setShowModal(true);
            }}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('bookings.new_booking')}
          </button>
          <button
            onClick={openFrontBooking}
            className="btn bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Front Booking
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('bookings.search_guest')}</label>
            <input
              type="text"
              placeholder={t('bookings.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input text-sm"
            />
          </div>

          <div className="w-40">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('bookings.status_filter')}</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="input text-sm"
            >
              <option value="">{t('bookings.all_statuses')}</option>
              {Object.entries({
                'CREATED': t('bookings.status.created'),
                'CONFIRMED': t('bookings.status.confirmed'),
                'CHECKED_IN': t('bookings.status.checked_in'),
                'CHECKED_OUT': t('bookings.status.checked_out'),
                'NO_SHOW': t('bookings.status.no_show'),
                'REFUNDED': t('bookings.status.refunded'),
                'CANCELLED': t('bookings.status.cancelled')
              }).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="w-44">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('bookings.date_range')}</label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="input text-sm"
            >
              <option value="all">{t('bookings.all_time')}</option>
              <option value="today">{t('bookings.today')}</option>
              <option value="tomorrow">{t('bookings.tomorrow')}</option>
              <option value="this-week">{t('bookings.this_week')}</option>
              <option value="last-30-days">{t('bookings.last_30_days')}</option>
              <option value="custom">{t('bookings.custom_range')}</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <>
              <div className="w-40">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('bookings.from')}</label>
                <input
                  type="date"
                  value={filters.from_date}
                  onChange={(e) => setFilters(prev => ({ ...prev, from_date: e.target.value }))}
                  className="input text-sm"
                />
              </div>
              <div className="w-40">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('bookings.to')}</label>
                <input
                  type="date"
                  value={filters.to_date}
                  onChange={(e) => setFilters(prev => ({ ...prev, to_date: e.target.value }))}
                  className="input text-sm"
                />
              </div>
            </>
          )}

          <button
            onClick={() => {
              setFilters({ status: '', from_date: '', to_date: '', search: '' });
              setSearchTerm('');
              setDatePreset('all');
            }}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium pb-2"
          >
            {t('bookings.clear_filters')}
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={bookings} searchable={false} />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t('bookings.modals.create.title')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.room_type')} *
              </label>
              <select
                required
                value={formData.room_type_id}
                onChange={(e) => setFormData({ ...formData, room_type_id: e.target.value })}
                className="input"
              >
                <option value="">{t('bookings.modals.create.select_category')}</option>
                {roomTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name} - ${type.base_price}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.quantity')}
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.adults')}
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.adults}
                onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.children')}
              </label>
              <input
                type="number"
                min="0"
                value={formData.children}
                onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.check_in')} *
              </label>
              <input
                required
                type="date"
                value={formData.check_in_date}
                onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                className="input"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.check_out')} *
              </label>
              <input
                required
                type="date"
                value={formData.check_out_date}
                onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                className="input"
                min={formData.check_in_date || format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('bookings.modals.create.room_addons')}
            </label>
            <div className="space-y-2 border rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
              {availableAddons.length > 0 ? availableAddons.map(addon => {
                const isSelected = formData.addons.some(a => a.addon_id === addon.id);
                return (
                  <div key={addon.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              addons: [...formData.addons, { addon_id: addon.id, quantity: 1, name: addon.name, price: addon.price }]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              addons: formData.addons.filter(a => a.addon_id !== addon.id)
                            });
                          }
                        }}
                        className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-800">{addon.name} ({formatCurrency(addon.price)})</span>
                    </div>
                    {isSelected && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={formData.addons.find(a => a.addon_id === addon.id)?.quantity || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setFormData({
                              ...formData,
                              addons: formData.addons.map(a => a.addon_id === addon.id ? { ...a, quantity: val } : a)
                            });
                          }}
                          className="input !py-1 !px-2 w-16 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              }) : (
                <p className="text-xs text-gray-500 italic">{t('bookings.modals.create.no_addons')}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('bookings.modals.create.guest_name')} *
            </label>
            <input
              required
              placeholder="John Doe"
              value={formData.guest_name}
              onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.guest_email')}
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookings.modals.create.guest_phone')}
              </label>
              <input
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">
              {t('bookings.modals.create.submit')}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </Modal>



      <Modal
        isOpen={showCheckOutModal}
        onClose={() => {
          setShowCheckOutModal(false);
          setBillingSummary(null);
        }}
        title={t('bookings.modals.check_out.title')}
      >
        {selectedBooking && (
          <>
            {!billingSummary ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">{t('bookings.modals.check_out.extra_charges_title')}</h3>
                  {extraCharges.map((charge, index) => (
                    <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                      <input
                        className="col-span-3 input text-sm"
                        placeholder={t('bookings.modals.check_out.charge_desc_placeholder')}
                        value={charge.description}
                        onChange={(e) => {
                          const newCharges = [...extraCharges];
                          newCharges[index].description = e.target.value;
                          setExtraCharges(newCharges);
                        }}
                      />
                      <input
                        type="number"
                        className="col-span-1 input text-sm"
                        placeholder="$"
                        value={charge.amount}
                        onChange={(e) => {
                          const newCharges = [...extraCharges];
                          newCharges[index].amount = e.target.value;
                          setExtraCharges(newCharges);
                        }}
                      />
                      <button
                        onClick={() => setExtraCharges(extraCharges.filter((_, i) => i !== index))}
                        className="col-span-1 text-red-500 hover:text-red-700"
                      >
                        <XCircle className="w-5 h-5 mx-auto" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setExtraCharges([...extraCharges, { description: '', amount: '' }])}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + {t('bookings.modals.check_out.add_charge')}
                  </button>
                </div>

                {/* Coupon Code Section */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-2 flex items-center gap-2"><Tag className="w-4 h-4" /> {t('bookings.modals.check_out.apply_coupon')}</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input text-sm flex-1 font-mono uppercase tracking-wider"
                      placeholder={t('bookings.modals.check_out.coupon_placeholder')}
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                      disabled={!!couponResult?.valid}
                    />
                    {!couponResult?.valid ? (
                      <button
                        onClick={async () => {
                          if (!couponCode.trim()) return toast.error(t('bookings.modals.check_out.coupon_placeholder'));
                          setValidatingCoupon(true);
                          try {
                            const res = await promotionAPI.validateCoupon(hotelId, { code: couponCode, amount: 0, nights: 1 });
                            setCouponResult({ valid: true, ...res.data });
                            toast.success(`${t('bookings.modals.check_out.coupon_applied')}!`);
                          } catch (err) {
                            setCouponResult({ valid: false, error: err.response?.data?.message || err.message });
                            toast.error(err.response?.data?.message || 'Invalid coupon');
                          } finally { setValidatingCoupon(false); }
                        }}
                        disabled={validatingCoupon}
                        className="btn btn-sm bg-green-600 text-white hover:bg-green-700 px-4"
                      >
                        {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : t('bookings.modals.check_out.finalize').split(' ')[0]} {/* Roughly 'Apply' */}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setCouponCode(''); setCouponResult(null); }}
                        className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 px-4"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                  {couponResult?.valid && (
                    <p className="text-sm text-green-700 font-bold mt-2">✅ {t('bookings.modals.check_out.coupon_applied')}</p>
                  )}
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    onClick={handlePreviewBilling}
                    disabled={validatingCoupon}
                    className="btn btn-primary flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {t('bookings.modals.check_out.preview_bill')}
                  </button>
                  <button
                    onClick={() => setShowCheckOutModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div
                  id="invoice-content"
                  className={`border-2 p-6 bg-white rounded-lg shadow-sm relative overflow-hidden ${billingSummary.payment_status === 'PAID' ? 'border-green-500 bg-green-50/10' : 'border-gray-100'}`}
                >
                  {billingSummary.payment_status === 'PAID' && (
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <CheckCircle className="w-32 h-32 text-green-600 rotate-12" />
                    </div>
                  )}
                  <div className="flex justify-between border-b pb-4 mb-4">
                    <div>
                      <h2 className={`text-xl font-bold uppercase ${billingSummary.payment_status === 'PAID' ? 'text-green-800' : 'text-gray-900'}`}>{billingSummary.hotel_name}</h2>
                      {billingSummary.hotel_gst && <p className="text-xs text-gray-500">GSTIN: {billingSummary.hotel_gst}</p>}
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-semibold text-gray-700">{t('bookings.billing.invoice')}</h3>
                      {billingSummary.invoice_number && (
                        <p className="text-sm font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block mt-1">
                          {billingSummary.invoice_number}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">{t('bookings.billing.date')}: {new Date().toLocaleDateString()}</p>
                      <div className="mt-2 text-right">
                        {billingSummary.payment_status === 'PAID' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {t('bookings.modals.check_out.paid')} {t('bookings.modals.check_out.via')} {billingSummary.payment_method}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {t('bookings.modals.check_out.not_paid')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">{t('bookings.billing.guest_name')}</p>
                      <p className="text-sm font-medium">{billingSummary.guest_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-400 uppercase">{t('bookings.billing.occupancy')}</p>
                      <p className="text-sm font-medium">
                        {billingSummary.adults} {t('bookings.modals.timeline.adult_plural')}, {billingSummary.children} {t('bookings.modals.timeline.child_plural')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">{t('bookings.billing.rooms')}</p>
                      <p className="text-sm font-medium">{billingSummary.room_numbers.join(', ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-400 uppercase">{t('bookings.billing.duration')}</p>
                      <p className="text-sm font-medium">{t('bookings.billing.nights', { count: billingSummary.nights })}</p>
                    </div>
                  </div>

                  <table className="w-full text-sm mb-6">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="py-2 px-3 font-semibold text-gray-600">{t('bookings.billing.description')}</th>
                        <th className="py-2 px-3 font-semibold text-gray-600 text-right">{t('bookings.billing.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 1. ROOM CHARGES SECTION */}
                      <tr className="border-b bg-gray-50/50">
                        <td className="py-3 px-3 font-medium text-gray-800">Base {t('bookings.billing.room_charges', { count: billingSummary.nights })}</td>
                        <td className="py-3 px-3 text-right font-medium">{formatCurrency(billingSummary.totalRoomCharge)}</td>
                      </tr>
                      {billingSummary.occupancySurcharge > 0 && (
                        <tr className="border-b bg-indigo-50/20 text-indigo-800">
                          <td className="py-2 px-3 pl-6 text-sm">
                            ↳ Additional Surcharge (for extra adult/child)
                          </td>
                          <td className="py-2 px-3 text-right text-sm">+{formatCurrency(billingSummary.occupancySurcharge)}</td>
                        </tr>
                      )}


                      {/* Pre-tax discounts */}
                      {billingSummary.promoDiscount > 0 && (
                        <tr className="border-b text-green-700 bg-green-50/20">
                          <td className="py-2 px-3 pl-6 text-sm">
                            ↳ {t('bookings.billing.rate_discount')} {billingSummary.applied_promotion?.name ? `(${billingSummary.applied_promotion.name})` : ''}
                          </td>
                          <td className="py-2 px-3 text-right text-sm">-{formatCurrency(billingSummary.promoDiscount)}</td>
                        </tr>
                      )}
                      {billingSummary.couponDiscount > 0 && (
                        <tr className="border-b text-blue-700 bg-blue-50/20">
                          <td className="py-2 px-3 pl-6 text-sm">
                            ↳ {t('bookings.billing.coupon_discount')} {billingSummary.applied_coupon?.code ? `(${billingSummary.applied_coupon.code})` : ''}
                          </td>
                          <td className="py-2 px-3 text-right text-sm">-{formatCurrency(billingSummary.couponDiscount)}</td>
                        </tr>
                      )}

                      {/* Room-specific taxes */}
                      {billingSummary.taxBreakdown?.filter(t => t.applied_to === 'ROOM').map((tax, idx) => (
                        <tr key={`room-tax-${idx}`} className="border-b">
                          <td className="py-2 px-3 pl-6 text-sm text-gray-500 italic">
                            ↳ {tax.name} ({tax.rate}%) {tax.is_inclusive ? '(Inclusive)' : ''}
                          </td>
                          <td className="py-2 px-3 text-right text-sm text-gray-500">
                            {formatCurrency(tax.amount)}
                          </td>
                        </tr>
                      ))}

                      {/* 2. ADDONS SECTION (Itemized) */}
                      {billingSummary.addons && billingSummary.addons.length > 0 && (
                        <>
                          <tr className="border-b bg-indigo-50/20">
                            <td className="py-2 px-3 font-semibold text-indigo-900" colSpan="2">{t('bookings.billing.room_addons_title')}</td>
                          </tr>
                          {billingSummary.addons.map((a, idx) => {
                            const itemTotal = parseFloat(a.total_price || 0);
                            return (
                              <React.Fragment key={`addon-${idx}`}>
                                <tr className="border-b text-indigo-800">
                                  <td className="py-2 px-3 pl-6 text-sm">
                                    {a.name} (x{a.quantity})
                                  </td>
                                  <td className="py-2 px-3 text-right text-sm">{formatCurrency(itemTotal)}</td>
                                </tr>
                                {/* Taxes for this addon (SERVICE/SERVICES/ALL) */}
                                {billingSummary.taxBreakdown?.filter(t => t.category === 'ALL' || t.category === 'SERVICE' || t.category === 'SERVICES').map((tax, tidx) => {
                                  const rate = parseFloat(tax.rate);
                                  const taxAmt = tax.is_inclusive ? (itemTotal - (itemTotal / (1 + rate / 100))) : (itemTotal * (rate / 100));
                                  return (
                                    <tr key={`addon-tax-${idx}-${tidx}`} className="border-b">
                                      <td className="py-1 px-3 pl-10 text-xs text-gray-400 italic">
                                        ↳ {tax.name} ({tax.rate}%) {tax.is_inclusive ? '(Incl.)' : '(Excl.)'}
                                      </td>
                                      <td className="py-1 px-3 text-right text-xs text-gray-400">
                                        {formatCurrency(taxAmt)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </>
                      )}

                      {/* 3. EXTRA CHARGES (Manual) SECTION */}
                      {billingSummary.extraCharges && billingSummary.extraCharges.length > 0 && (
                        <>
                          <tr className="border-b bg-gray-50/30">
                            <td className="py-2 px-3 font-semibold text-gray-800" colSpan="2">Extra Charges</td>
                          </tr>
                          {billingSummary.extraCharges.map((charge, idx) => {
                            const itemTotal = parseFloat(charge.amount || 0);
                            return (
                              <React.Fragment key={`extra-${idx}`}>
                                <tr className="border-b text-gray-700">
                                  <td className="py-2 px-3 pl-6 text-sm">
                                    {charge.description || 'Manual Service'}
                                  </td>
                                  <td className="py-2 px-3 text-right text-sm">{formatCurrency(itemTotal)}</td>
                                </tr>
                                {/* Taxes for this manual charge (SERVICE/SERVICES/ALL) */}
                                {billingSummary.taxBreakdown?.filter(t => t.category === 'ALL' || t.category === 'SERVICE' || t.category === 'SERVICES').map((tax, tidx) => {
                                  const rate = parseFloat(tax.rate);
                                  const taxAmt = tax.is_inclusive ? (itemTotal - (itemTotal / (1 + rate / 100))) : (itemTotal * (rate / 100));
                                  return (
                                    <tr key={`extra-tax-${idx}-${tidx}`} className="border-b">
                                      <td className="py-1 px-3 pl-10 text-xs text-gray-400 italic">
                                        ↳ {tax.name} ({tax.rate}%) {tax.is_inclusive ? '(Incl.)' : '(Excl.)'}
                                      </td>
                                      <td className="py-1 px-3 text-right text-xs text-gray-400">
                                        {formatCurrency(taxAmt)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </>
                      )}

                      {/* 4. ROOM SERVICE (Service Requests) SECTION */}
                      {billingSummary.serviceRequestsTotal > 0 && (
                        <>
                          <tr className="border-b bg-amber-50/20">
                            <td className="py-2 px-3 font-semibold text-amber-900" colSpan="2">{t('bookings.billing.room_service_title')}</td>
                          </tr>
                          {billingSummary.serviceRequests.map((sr, idx) => {
                            const itemTotal = sr.quantity * parseFloat(sr.service_price || 0);
                            return (
                              <React.Fragment key={`sr-${idx}`}>
                                <tr className="border-b text-amber-800">
                                  <td className="py-2 px-3 pl-6 text-sm">
                                    {sr.service_name} (x{sr.quantity})
                                  </td>
                                  <td className="py-2 px-3 text-right text-sm">{formatCurrency(itemTotal)}</td>
                                </tr>
                                {/* Taxes for this service request (Category Match + ALL/SERVICE) */}
                                {billingSummary.taxBreakdown?.filter(t =>
                                  t.category === 'ALL' ||
                                  t.category === 'SERVICE' ||
                                  t.category === 'SERVICES' ||
                                  t.category?.toUpperCase() === sr.category_name?.toUpperCase()
                                ).map((tax, tidx) => {
                                  const rate = parseFloat(tax.rate);
                                  const taxAmt = tax.is_inclusive ? (itemTotal - (itemTotal / (1 + rate / 100))) : (itemTotal * (rate / 100));
                                  return (
                                    <tr key={`sr-tax-${idx}-${tidx}`} className="border-b">
                                      <td className="py-1 px-3 pl-10 text-xs text-gray-400 italic">
                                        ↳ {tax.name} ({tax.rate}%) {tax.is_inclusive ? '(Incl.)' : '(Excl.)'}
                                      </td>
                                      <td className="py-1 px-3 text-right text-xs text-gray-400">
                                        {formatCurrency(taxAmt)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </>
                      )}

                      {/* GRAND TOTAL */}
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td className="py-3 px-3">{t('bookings.billing.grand_total')}</td>
                        <td className="py-3 px-3 text-right text-purple-700 font-bold text-xl">
                          {formatCurrency(billingSummary.finalTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="text-center pt-4 border-t border-dashed">
                    <p className="text-sm text-gray-500 italic">{t('bookings.billing.thank_you')}</p>
                  </div>
                </div>

                {/* Payment Settlement Flow */}
                {billingSummary.payment_status !== 'PAID' && selectedBooking.status === 'CHECKED_OUT' && (
                  <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-inner">
                    <h4 className="text-purple-900 font-bold mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" /> {t('bookings.modals.check_out.settle_title')}
                    </h4>
                    <p className="text-sm text-purple-700 mb-4">{t('bookings.modals.check_out.settle_description')}</p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                      {['CASH', 'UPI', 'CC', 'DC'].map(method => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`px-3 py-3 rounded-lg border-2 text-xs font-bold transition-all ${paymentMethod === method
                            ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                            : 'bg-white border-purple-200 text-purple-600 hover:border-purple-400'
                            }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>

                    {/* Payment Context Details */}
                    {(paymentMethod === 'UPI' || paymentMethod === 'CC' || paymentMethod === 'DC') && (
                      <div className="bg-white p-4 rounded-xl border border-purple-100 mb-6 flex flex-col md:flex-row gap-6 items-center">
                        {paymentMethod === 'UPI' && (billingSummary.hotel_settings?.upi_id || billingSummary.hotel_settings?.upi_qr_code) && (
                          <div className="flex-shrink-0 bg-gray-50 p-2 rounded-lg border">
                            {billingSummary.hotel_settings.upi_qr_code ? (
                              <img
                                src={billingSummary.hotel_settings.upi_qr_code}
                                alt="Custom Payment QR"
                                className="w-24 h-24 object-contain"
                              />
                            ) : (
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${billingSummary.hotel_settings.upi_id}&pn=${billingSummary.hotel_name}&am=${billingSummary.finalTotal}&cu=INR`)}`}
                                alt="Generated Payment QR"
                                className="w-24 h-24"
                              />
                            )}
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          {paymentMethod === 'UPI' && (
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">UPI ID</p>
                              <p className="text-sm font-mono font-bold text-purple-900">{billingSummary.hotel_settings?.upi_id || 'Not Configured'}</p>
                            </div>
                          )}
                          {(paymentMethod === 'CC' || paymentMethod === 'DC' || paymentMethod === 'CASH') && billingSummary.hotel_settings?.bank_name && (
                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Bank Name</p>
                                <p className="text-sm font-bold text-gray-800">{billingSummary.hotel_settings.bank_name}</p>
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">A/C Number</p>
                                  <p className="text-sm font-mono font-bold text-gray-800">{billingSummary.hotel_settings.account_number}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">IFSC Code</p>
                                  <p className="text-sm font-mono font-bold text-gray-800">{billingSummary.hotel_settings.ifsc_code}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {!billingSummary.hotel_settings?.bank_name && !billingSummary.hotel_settings?.upi_id && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 italic">
                              <Info className="w-3 h-3" /> Please configure bank/UPI details in settings.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleSettlePayment}
                      disabled={isSettling}
                      className="w-full btn bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center gap-2 py-3 shadow-lg"
                    >
                      {isSettling ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      {t('bookings.modals.check_out.settle_button', { amount: formatCurrency(billingSummary.finalTotal) })}
                    </button>
                  </div>
                )}

                <div className="flex justify-center pt-4 border-t mt-4 print:hidden space-x-3 sticky bottom-0 bg-white py-2">
                  {selectedBooking.status !== 'CHECKED_OUT' && (
                    <button
                      onClick={handleCheckOutSubmit}
                      className="btn bg-purple-600 text-white hover:bg-purple-700 flex-1"
                    >
                      {t('bookings.modals.check_out.finalize')}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const printContent = document.getElementById('invoice-content').innerHTML;
                      const originalContent = document.body.innerHTML;
                      document.body.innerHTML = printContent;
                      window.print();
                      document.body.innerHTML = originalContent;
                      window.location.reload();
                    }}
                    className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 flex-1"
                  >
                    {t('bookings.modals.check_out.print')}
                  </button>
                  <button
                    onClick={() => {
                      if (selectedBooking.status === 'CHECKED_OUT') {
                        setShowCheckOutModal(false);
                        setBillingSummary(null);
                      } else {
                        setBillingSummary(null); // Back to editor
                      }
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    {selectedBooking.status === 'CHECKED_OUT' ? t('common.close') : t('bookings.modals.check_out.back')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        isOpen={showTimelineModal}
        onClose={() => { setShowTimelineModal(false); setTimelineBooking(null); }}
        title={t('bookings.modals.timeline.title')}
        size="lg"
      >
        {timelineLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : timelineBooking ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">{t('bookings.table.guest')}</p>
                <p className="font-medium text-gray-900">{timelineBooking.guest_name}</p>
                <p className="text-xs text-gray-600 text-truncate">{timelineBooking.guest_email || 'No email provided'}</p>
                {timelineBooking.guest_phone && <p className="text-xs text-gray-600">{timelineBooking.guest_phone}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Reference (PNR)</p>
                <p className="font-mono font-medium text-gray-900 bg-white inline-block px-1 rounded border shadow-sm">{timelineBooking.booking_ref || 'NA'}</p>
                <p className="text-xs text-gray-600 mt-1">Total: <b>{formatCurrency(timelineBooking.total_amount)}</b></p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Stay Details</p>
                <p className="text-sm font-medium text-gray-900">
                  {timelineBooking.check_in_date ? format(new Date(timelineBooking.check_in_date), 'MMM dd, yyyy') : 'N/A'} - {timelineBooking.check_out_date ? format(new Date(timelineBooking.check_out_date), 'MMM dd, yyyy') : 'N/A'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {timelineBooking.quantity || 1}x {timelineBooking.room_type_name || 'Room'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Occupancy</p>
                <p className="text-sm font-medium text-gray-900">
                  {timelineBooking.adults || 1} {timelineBooking.adults === 1 ? t('bookings.modals.timeline.adult_single') : t('bookings.modals.timeline.adult_plural')}
                  {timelineBooking.children > 0 ? `, ${timelineBooking.children} ${timelineBooking.children === 1 ? t('bookings.modals.timeline.child_single') : t('bookings.modals.timeline.child_plural')}` : ''}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {t('bookings.modals.timeline.total_guests', { count: (timelineBooking.adults || 0) + (timelineBooking.children || 0) })}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> {t('bookings.modals.timeline.audit_trail')}
              </h3>

              {(() => {
                const combinedTimeline = [
                  ...(timelineBooking.events || []).map(e => ({
                    title: e.event_type?.replace(/_/g, ' ') || 'Event',
                    description: e.description,
                    date: e.created_at,
                    type: 'EVENT'
                  })),
                  ...(timelineBooking.status_history || []).map(sh => ({
                    title: `Status: ${sh.to_status}`,
                    description: sh.reason || (sh.from_status ? `From ${sh.from_status} to ${sh.to_status}` : `Initial Status: ${sh.to_status}`),
                    date: sh.changed_at,
                    actor: sh.changed_by || 'System',
                    type: 'STATUS'
                  }))
                ].sort((a, b) => new Date(a.date) - new Date(b.date));

                if (combinedTimeline.length === 0) {
                  return (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <p className="text-gray-500 text-sm">{t('bookings.modals.timeline.no_events')}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-0 relative">
                    {combinedTimeline.map((item, idx) => (
                      <div key={idx} className="flex gap-4 group">
                        <div className="flex flex-col items-center pt-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${item.type === 'STATUS' ? 'bg-indigo-100 text-indigo-600 border border-indigo-200' : (item.title.startsWith('CANCEL') ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-600 border border-green-200')}`}>
                            {item.title.startsWith('CANCEL') ? <XCircle className="w-3 h-3" /> : (item.type === 'STATUS' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />)}
                          </div>
                          {idx !== combinedTimeline.length - 1 && <div className="w-0.5 h-full bg-gray-200 my-1 group-last:hidden"></div>}
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex-1 mb-3 shadow-sm transition-all hover:bg-white hover:shadow-md">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <span className="font-bold text-gray-900 text-xs tracking-tight">{item.title}</span>
                            <span className="text-[10px] text-gray-500 bg-white border border-gray-100 px-1.5 py-0.5 rounded shadow-sm font-semibold whitespace-nowrap">
                              {new Date(item.date).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-600 text-xs mt-1 leading-relaxed">{item.description}</p>
                          {item.actor && (
                            <p className="text-[10px] font-semibold text-indigo-600 mt-2 uppercase tracking-wide">
                              👤 Action by: {item.actor}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 flex justify-end sticky bottom-0 bg-white border-t border-gray-100">
              <button type="button" onClick={() => setShowTimelineModal(false)} className="btn btn-secondary shadow-sm">
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 py-8 text-center bg-gray-50 rounded-lg">{t('bookings.modals.timeline.no_events')}</p>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      <PromptModal
        isOpen={promptConfig.isOpen}
        onClose={() => setPromptConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={promptConfig.onConfirm}
        title={t('common.prompt')}
        message={t('common.reason_required')}
        placeholder={t('common.reason_placeholder')}
        confirmColor="bg-red-600 hover:bg-red-700"
      />

      {/* Check-In / Front Booking Modal */}
      <Modal isOpen={showFrontBookingModal} onClose={() => setShowFrontBookingModal(false)} title={isExistingBookingCheckIn ? "Check-In: Guest Details & Room Assignment" : "Front Booking — Walk-in Guest"} size="lg">
        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-6 gap-2">
          {['Guest Info', 'Room', 'Addons', 'Review'].map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${fbStep === idx ? 'bg-emerald-600 text-white shadow-lg' : fbStep > idx ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                }`}>{idx + 1}</div>
              <span className={`ml-1.5 text-xs font-medium hidden sm:inline ${fbStep === idx ? 'text-emerald-700' : 'text-gray-400'}`}>{label}</span>
              {idx < 3 && <ChevronRightIcon className="w-4 h-4 text-gray-300 mx-2" />}
            </div>
          ))}
        </div>

        {/* Step 0: Guest Info */}
        {fbStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name *</label>
              <input type="text" required value={fbForm.guest_name} onChange={e => setFbForm({ ...fbForm, guest_name: e.target.value })} className="input" placeholder="Walk-in guest name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={fbForm.guest_phone} onChange={e => setFbForm({ ...fbForm, guest_phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={fbForm.guest_email} onChange={e => setFbForm({ ...fbForm, guest_email: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date *</label>
                <input type="date" value={fbForm.check_in_date} onChange={e => setFbForm({ ...fbForm, check_in_date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date *</label>
                <input type="date" value={fbForm.check_out_date} onChange={e => setFbForm({ ...fbForm, check_out_date: e.target.value })} className="input" min={fbForm.check_in_date} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adults *</label>
                <input type="number" min="1" value={fbForm.adults} onChange={e => {
                  const newAdults = parseInt(e.target.value) || 1;
                  const totalGuests = newAdults + fbForm.children;
                  const newDetails = Array.from({ length: totalGuests }, (_, i) => fbForm.guest_details[i] || { full_name: '', age: '', id_proof_type: 'Aadhar', id_proof_number: '' });
                  setFbForm({ ...fbForm, adults: newAdults, guest_details: newDetails });
                }} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                <input type="number" min="0" value={fbForm.children} onChange={e => {
                  const newChildren = parseInt(e.target.value) || 0;
                  const totalGuests = fbForm.adults + newChildren;
                  const newDetails = Array.from({ length: totalGuests }, (_, i) => fbForm.guest_details[i] || { full_name: '', age: '', id_proof_type: 'Aadhar', id_proof_number: '' });
                  setFbForm({ ...fbForm, children: newChildren, guest_details: newDetails });
                }} className="input" />
              </div>
            </div>
            {/* Guest Details - Required */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Guest Details * <span className="text-xs font-normal text-gray-400">({fbForm.adults} adult{fbForm.adults > 1 ? 's' : ''}{fbForm.children > 0 ? ` + ${fbForm.children} child${fbForm.children > 1 ? 'ren' : ''}` : ''})</span></h4>
              {fbForm.guest_details.map((g, i) => (
                <div key={i} className="mb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{i < fbForm.adults ? `Adult ${i + 1}` : `Child ${i - fbForm.adults + 1}`}</p>
                  <div className="grid grid-cols-4 gap-2">
                    <input placeholder="Full Name *" value={g.full_name} onChange={e => { const d = [...fbForm.guest_details]; d[i] = { ...d[i], full_name: e.target.value }; setFbForm({ ...fbForm, guest_details: d }); }} className="input text-sm" required />
                    <input placeholder="Age" type="number" value={g.age} onChange={e => { const d = [...fbForm.guest_details]; d[i] = { ...d[i], age: e.target.value }; setFbForm({ ...fbForm, guest_details: d }); }} className="input text-sm" />
                    <select value={g.id_proof_type} onChange={e => { const d = [...fbForm.guest_details]; d[i] = { ...d[i], id_proof_type: e.target.value }; setFbForm({ ...fbForm, guest_details: d }); }} className="input text-sm">
                      <option>Aadhar</option><option>Passport</option><option>DL</option><option>Voter ID</option>
                    </select>
                    <input placeholder="ID Number *" value={g.id_proof_number} onChange={e => { const d = [...fbForm.guest_details]; d[i] = { ...d[i], id_proof_number: e.target.value }; setFbForm({ ...fbForm, guest_details: d }); }} className="input text-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Room Selection */}
        {fbStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
              <select value={fbForm.room_type_id} onChange={e => setFbForm({ ...fbForm, room_type_id: e.target.value, room_ids: [] })} className="input">
                <option value="">Select Room Type</option>
                {roomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name} — {formatCurrency(rt.base_price)}/night ({(availableRoomsByType[rt.id] || []).length} available)</option>
                ))}
              </select>
            </div>
            {fbForm.room_type_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Room(s) *</label>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {(availableRoomsByType[fbForm.room_type_id] || []).map(room => {
                    const isSelected = fbForm.room_ids.includes(room.id);
                    return (
                      <button key={room.id} type="button" onClick={() => {
                        setFbForm(prev => ({
                          ...prev,
                          room_ids: isSelected ? prev.room_ids.filter(id => id !== room.id) : [...prev.room_ids, room.id]
                        }));
                      }} className={`p-3 rounded-xl border-2 text-center transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}>
                        <span className="text-lg font-bold block">{room.room_number}</span>
                        <span className="text-[10px] text-gray-400 uppercase">{room.floor ? `Floor ${room.floor}` : 'Room'}</span>
                      </button>
                    );
                  })}
                  {(!availableRoomsByType[fbForm.room_type_id] || availableRoomsByType[fbForm.room_type_id].length === 0) && (
                    <p className="col-span-4 text-center text-sm text-gray-400 py-4">No available rooms for this type</p>
                  )}
                </div>
                {fbForm.room_ids.length > 0 && (
                  <p className="text-sm text-emerald-600 font-medium mt-2">{fbForm.room_ids.length} room(s) selected</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Addons */}
        {fbStep === 2 && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-700">Room Addons (Optional)</h4>
            <div className="space-y-2 border rounded-lg p-3 bg-gray-50 max-h-60 overflow-y-auto">
              {availableAddons.length > 0 ? availableAddons.map(addon => {
                const isSelected = fbForm.addons.some(a => a.addon_id === addon.id);
                return (
                  <div key={addon.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input type="checkbox" checked={isSelected} onChange={e => {
                        if (e.target.checked) {
                          setFbForm({ ...fbForm, addons: [...fbForm.addons, { addon_id: addon.id, quantity: 1, name: addon.name, price: addon.price }] });
                        } else {
                          setFbForm({ ...fbForm, addons: fbForm.addons.filter(a => a.addon_id !== addon.id) });
                        }
                      }} className="mr-2 h-4 w-4 text-emerald-600 border-gray-300 rounded" />
                      <span className="text-sm font-medium">{addon.name} ({formatCurrency(addon.price)})</span>
                    </div>
                    {isSelected && (
                      <input type="number" min="1" value={fbForm.addons.find(a => a.addon_id === addon.id)?.quantity || 1}
                        onChange={e => setFbForm({ ...fbForm, addons: fbForm.addons.map(a => a.addon_id === addon.id ? { ...a, quantity: parseInt(e.target.value) || 1 } : a) })}
                        className="w-16 input text-sm text-center" />
                    )}
                  </div>
                );
              }) : <p className="text-sm text-gray-400 text-center py-4">No addons available</p>}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {fbStep === 3 && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <h4 className="font-bold text-emerald-800 mb-2">{isExistingBookingCheckIn ? 'Check-In Summary' : 'Front Booking Summary'}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Guest:</span> <strong>{fbForm.guest_name}</strong></div>
                <div><span className="text-gray-500">Phone:</span> <strong>{fbForm.guest_phone || '—'}</strong></div>
                <div><span className="text-gray-500">Check-in:</span> <strong>{fbForm.check_in_date}</strong></div>
                <div><span className="text-gray-500">Check-out:</span> <strong>{fbForm.check_out_date}</strong></div>
                <div><span className="text-gray-500">Adults:</span> <strong>{fbForm.adults}</strong></div>
                <div><span className="text-gray-500">Children:</span> <strong>{fbForm.children}</strong></div>
                <div><span className="text-gray-500">Room Type:</span> <strong>{roomTypes.find(rt => rt.id === fbForm.room_type_id)?.name || '—'}</strong></div>
                <div><span className="text-gray-500">Rooms:</span> <strong>{fbForm.room_ids.length} selected</strong></div>
              </div>

              {/* Pricing Section */}
              {fbQuote && (
                <div className="mt-3 pt-3 border-t border-emerald-200 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Room Charge ({fbQuote.nights} nights x {fbQuote.quantity} rooms)</span>
                    <span className="font-medium">{formatCurrency(fbQuote.room_subtotal)}</span>
                  </div>
                  {fbQuote.occupancy_surcharge > 0 && (
                    <div className="flex justify-between text-indigo-700">
                      <span>Additional (for extra adult/child)</span>
                      <span className="font-medium">+{formatCurrency(fbQuote.occupancy_surcharge)}</span>
                    </div>
                  )}
                  {fbForm.addons.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Addons Total</span>
                      <span className="font-medium">
                        +{formatCurrency(fbForm.addons.reduce((sum, a) => sum + (a.price * a.quantity), 0))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-bold text-emerald-900 border-t border-emerald-100 border-dashed">
                    <span>Estimated Total (excl. Tax)</span>
                    <span>{formatCurrency(fbQuote.room_subtotal + fbQuote.occupancy_surcharge + fbForm.addons.reduce((sum, a) => sum + (a.price * a.quantity), 0))}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <Info className="w-4 h-4 inline mr-1" />
              {isExistingBookingCheckIn ? (
                <>Any changes made to room type, dates, or addons will automatically recalculate the final invoice.</>
              ) : (
                <>This will create a booking with PNR <strong>FB-XXXXXX</strong> and immediately check in the guest.</>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <button type="button" onClick={() => fbStep === 0 ? setShowFrontBookingModal(false) : setFbStep(fbStep - 1)}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center">
            <ChevronLeft className="w-4 h-4 mr-1" /> {fbStep === 0 ? 'Cancel' : 'Back'}
          </button>
          {fbStep < 3 ? (
            <button type="button" onClick={async () => {
              if (fbStep === 0 && !fbForm.guest_name) { toast.error('Guest name is required'); return; }
              if (fbStep === 0 && fbForm.guest_details.some(g => !g.full_name || !g.id_proof_number)) { toast.error('Please fill all guest names and ID numbers'); return; }
              if (fbStep === 1 && (!fbForm.room_type_id || !fbForm.room_ids.length)) { toast.error('Select room type and at least one room'); return; }

              if (fbStep === 2) {
                // Fetch quote before going to step 3
                setFbQuoteLoading(true);
                try {
                  const data = await quoteAPI.getQuote({
                    hotel_id: hotelId,
                    room_type_id: fbForm.room_type_id,
                    check_in: fbForm.check_in_date,
                    check_out: fbForm.check_out_date,
                    quantity: fbForm.room_ids.length || 1,
                    adults: fbForm.adults,
                    children: fbForm.children
                  });
                  setFbQuote(data.quote);
                } catch (error) {
                  toast.error(error.message || 'Failed to fetch price quote');
                } finally {
                  setFbQuoteLoading(false);
                }
              }
              setFbStep(fbStep + 1);
            }} disabled={fbQuoteLoading} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center disabled:opacity-50">
              {fbQuoteLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : 'Next'} <ChevronRightIcon className="w-4 h-4 ml-1" />
            </button>
          ) : (
            <button type="button" onClick={handleFrontBookingSubmit} disabled={fbSubmitting}
              className="px-6 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center">
              {fbSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {fbSubmitting ? 'Creating...' : 'Check In Guest'}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
