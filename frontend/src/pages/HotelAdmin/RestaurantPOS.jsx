import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceAPI, bookingAPI, qrcodeAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import {
  Search,
  ShoppingCart,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  Receipt,
  CheckCircle,
  XCircle,
  RefreshCw,
  Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

export default function RestaurantPOS() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();

  // Data State
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDietary, setSelectedDietary] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentType, setPaymentType] = useState('ROOM'); // 'ROOM' or 'PAID'
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderGroup, setLastOrderGroup] = useState(null);

  const handlePrint = (divId) => {
    const printContent = document.getElementById(divId);
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const printWindow = window.open(windowUrl, uniqueName, 'left=100,top=100,width=800,height=900');

    printWindow.document.write(`
        <html>
            <head>
                <title>Print - POS</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .kitchen-title { font-size: 24px; font-weight: 900; background: #000; color: #fff; padding: 10px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  useEffect(() => {
    if (hotelId) {
      loadData();
    }
  }, [hotelId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catData, itemsData, bookingData] = await Promise.all([
        serviceAPI.getCategories(hotelId),
        serviceAPI.getItems(hotelId),
        bookingAPI.getByHotel(hotelId, { status: 'CHECKED_IN' })
      ]);

      const allCategories = catData.categories || [];
      const restaurantCategories = allCategories.filter(c => c.is_restaurant);

      setCategories(restaurantCategories);

      // Filter items to only show those in restaurant categories
      const allItems = itemsData.items || [];
      const restaurantItems = allItems.filter(i =>
        i.is_available && restaurantCategories.some(c => c.id === i.category_id)
      );

      setItems(restaurantItems);
      setActiveBookings(bookingData.bookings || []);
    } catch (error) {
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Data
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchesDietary = selectedDietary === 'all' || item.dietary_type === selectedDietary;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesDietary && matchesSearch;
    });
  }, [items, selectedCategory, selectedDietary, searchQuery]);

  const filteredBookings = useMemo(() => {
    if (!bookingSearch) return [];
    return activeBookings.filter(b =>
      b.guest_name?.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.rooms?.some(r => r.room_number?.includes(bookingSearch)) ||
      b.booking_ref?.toLowerCase().includes(bookingSearch.toLowerCase())
    ).slice(0, 5);
  }, [activeBookings, bookingSearch]);

  // Cart Actions
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error(t('pos.cart_empty') || 'Cart is empty');
      return;
    }
    if (!selectedBooking && paymentType === 'ROOM') {
      toast.error(t('pos.select_guest_for_room') || 'Please select a guest for room posting');
      return;
    }

    setIsSubmitting(true);
    try {
      // We need the token for the room and hotel
      // Since staff is placing it, we can't easily get the guest's QR token
      // BUT we can use the backend bulk create with room_id/booking_id directly
      // However, qrcodeAPI.bulkCreateServiceRequests expects a 'token'.
      // I should probably add a STAFF endpoint for this or find a way.

      // For now, let's look at how we can bypass the token or if we have it
      // Actually, staff has hotel_id. I should check if there's a STAFF VERSION of this API.

      // If not, I'll use a placeholder or the booking's associated room's QR token if I have it.
      const payload = {
        hotel_id: hotelId,
        services: cart.map(item => ({
          service_item_id: item.id,
          quantity: item.quantity
        })),
        booking_id: selectedBooking?.id,
        booking_ref: selectedBooking?.booking_ref,
        room_id: selectedBooking?.rooms?.[0]?.id,
        guest_name: selectedBooking ? selectedBooking.guest_name : (walkinName || t('pos.walkin_guest')),
        guest_phone: selectedBooking ? selectedBooking.guest_phone : walkinPhone,
        status: 'ACCEPTED',
        is_billed: paymentType === 'PAID',
        payment_method: paymentType === 'ROOM' ? 'POST_TO_ROOM' : paymentMethod,
        notes: `POS Order - ${selectedBooking ? (paymentType === 'PAID' ? 'Immediate Payment' : 'Charge to Room') : 'Walk-in'}`
      };

      const response = await qrcodeAPI.bulkCreateServiceRequestsStaff(payload);

      setLastOrderGroup({
        id: response.requests[0]?.order_group_id || 'N/A',
        room_number: selectedBooking?.rooms?.[0]?.room_number || 'Walk-in',
        guest_name: selectedBooking?.guest_name || 'Walk-in Guest',
        items: cart,
        total: totalAmount,
        created_at: new Date().toISOString()
      });

      toast.success(t('pos.order_success'));
      setCart([]);
      setSelectedBooking(null);
      setBookingSearch('');
      setShowSuccessModal(true);
    } catch (error) {
      toast.error(t('pos.order_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <RefreshCw className="w-10 h-10 animate-spin text-primary-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium tracking-wide">Initializing POS System...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] gap-4 overflow-hidden -m-6 p-6 bg-slate-50/50">
      {/* Left: Menu Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
        {/* Category & Search Header */}
        <div className="p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <ChefHat className="w-8 h-8 mr-3 text-primary-600" />
              {t('pos.title')}
            </h1>
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                placeholder={t('pos.find_items')}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-2xl transition-all duration-200 text-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 shadow-sm ${selectedCategory === 'all'
                    ? 'bg-primary-600 text-white shadow-primary-200 transform scale-105'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300 hover:text-primary-600'
                  }`}
              >
                {t('pos.all_delicacies')}
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 shadow-sm ${selectedCategory === cat.id
                      ? 'bg-primary-600 text-white shadow-primary-200 transform scale-105'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300 hover:text-primary-600'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
              {['all', 'VEG', 'NON_VEG'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedDietary(type)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedDietary === type
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {type === 'all' ? 'All' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="group flex flex-col bg-white border border-slate-200/80 rounded-2xl p-4 text-left transition-all duration-200 hover:shadow-xl hover:shadow-slate-200/50 hover:border-primary-200 active:scale-95"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                    <Plus className="w-6 h-6 text-primary-600" />
                  </div>
                  {item.dietary_type && item.dietary_type !== 'ALL' && (
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${item.dietary_type === 'VEG' ? 'border-green-500' : 'border-red-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${item.dietary_type === 'VEG' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors line-clamp-1">{item.name}</h3>
                <p className="text-xs text-slate-500 mb-4 line-clamp-2 min-h-[32px]">{item.description || 'Fresh and delicious'}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-lg font-black text-primary-600">{formatCurrency(item.price)}</span>
                </div>
              </button>
            ))}
          </div>
          {filteredItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-60">
              <ChefHat className="w-20 h-20 text-slate-300 mb-4" />
              <p className="text-slate-500 font-bold">{t('pos.no_items')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Order & Cart Sidebar */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white">
          <h2 className="text-xl font-black flex items-center">
            <ShoppingCart className="w-6 h-6 mr-3 text-primary-400" />
            {t('pos.current_order')}
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{t('pos.ticket')} #{new Date().getTime().toString().slice(-6)}</p>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md hover:border-slate-200">
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.name}</h4>
                <p className="text-xs font-black text-primary-600">{formatCurrency(item.price)} each</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-500"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-slate-900">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-500"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-10 opacity-30">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">{t('pos.order_empty')}</p>
            </div>
          )}
        </div>

        {/* Footer: Guest Select & Payment */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
          {/* Guest Selection */}
          <div className="space-y-2 relative">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('pos.guest_assignment')}</label>
            {!selectedBooking ? (
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="text"
                  placeholder={t('pos.search_room_guest')}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl text-sm font-medium transition-all"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                />
                {filteredBookings.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50">
                    {filteredBookings.map(b => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBooking(b);
                          setBookingSearch('');
                        }}
                        className="w-full p-4 text-left hover:bg-primary-50 border-b border-slate-100 last:border-0 transition-colors group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{b.guest_name}</span>
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black group-hover:bg-primary-100 group-hover:text-primary-600">
                            ROOM {b.rooms?.[0]?.room_number || 'N/A'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-primary-600 rounded-2xl shadow-lg shadow-primary-200 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold leading-tight">{selectedBooking.guest_name}</p>
                    <p className="text-primary-100 text-[10px] font-black uppercase tracking-wider">Room {selectedBooking.rooms?.[0]?.room_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedBooking(null);
                    setPaymentType('PAID');
                    setWalkinName('');
                    setWalkinPhone('');
                  }}
                  className="p-2 text-primary-200 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>

          {!selectedBooking && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('pos.guest_name')}</label>
                <input
                  type="text"
                  placeholder={t('pos.walkin_guest')}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl text-sm font-medium transition-all"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('pos.guest_phone')}</label>
                <input
                  type="text"
                  placeholder="0000000000"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl text-sm font-medium transition-all"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Payment Type */}
          <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setPaymentType('ROOM')}
              disabled={!selectedBooking}
              className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center transition-all ${!selectedBooking ? 'bg-slate-50 text-slate-200 cursor-not-allowed' :
                  paymentType === 'ROOM' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {t('pos.post_to_room')}
            </button>
            <button
              onClick={() => setPaymentType('PAID')}
              className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center transition-all ${paymentType === 'PAID' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {t('pos.pay_now')}
            </button>
          </div>

          {paymentType === 'PAID' && (
            <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-top-2 duration-300">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${paymentMethod === 'CASH' ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-white hover:border-primary-200'}`}
              >
                <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'CASH' ? 'text-primary-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-black">{t('pos.cash')}</span>
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${paymentMethod === 'CARD' ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-white hover:border-primary-200'}`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'CARD' ? 'text-primary-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-black">{t('pos.card')}</span>
              </button>
              <button
                onClick={() => setPaymentMethod('UPI')}
                className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${paymentMethod === 'UPI' ? 'border-primary-500 bg-primary-50' : 'border-slate-100 bg-white hover:border-primary-200'}`}
              >
                <Smartphone className={`w-5 h-5 mb-1 ${paymentMethod === 'UPI' ? 'text-primary-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-black">{t('pos.upi')}</span>
              </button>
            </div>
          )}

          {/* Subtotal */}
          <div className="space-y-1 px-1">
            <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <span>Subtotal</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-900 text-2xl font-black">
              <span>Total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={isSubmitting || cart.length === 0 || (paymentType === 'ROOM' && !selectedBooking)}
            className={`w-full py-5 rounded-2xl font-black text-lg transition-all duration-300 flex items-center justify-center shadow-2xl ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' :
                cart.length === 0 || (paymentType === 'ROOM' && !selectedBooking) ? 'bg-slate-200 text-slate-400' : 'bg-primary-600 text-white shadow-primary-200 hover:bg-primary-700 hover:scale-[1.02] active:scale-95'
              }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-6 h-6 mr-3" />
                {t('pos.place_order')}
              </>
            )}
          </button>
        </div>
      </div>
      {/* Success / Print Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={t('pos.order_success')}
      >
        {lastOrderGroup && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-black text-slate-900">{t('pos.order_success')}</h3>
              <p className="text-slate-500 font-medium">Ticket #{lastOrderGroup.id.slice(-6).toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handlePrint('pos-kitchen-print')}
                className="flex flex-col items-center justify-center p-6 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all group"
              >
                <Printer className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-xs uppercase tracking-widest">Kitchen Print</span>
              </button>
              <button
                onClick={() => handlePrint('pos-invoice-print')}
                className="flex flex-col items-center justify-center p-6 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 transition-all group"
              >
                <Receipt className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-xs uppercase tracking-widest">Invoice Print</span>
              </button>
            </div>

            {/* Hidden Templates */}
            <div className="hidden">
              <div id="pos-kitchen-print">
                <div className="kitchen-title">KITCHEN ORDER</div>
                <div className="font-bold">Room: {lastOrderGroup.room_number || 'Walk-in'}</div>
                <div>Guest: {lastOrderGroup.guest_name}</div>
                <hr />
                <table>
                  <thead>
                    <tr><th>Item</th><th>Qty</th></tr>
                  </thead>
                  <tbody>
                    {lastOrderGroup.items.map(item => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div id="pos-invoice-print">
                <div className="text-center font-bold" style={{ fontSize: '20px' }}>SERVICE RECEIPT</div>
                <div className="text-center">Ticket #{lastOrderGroup.id.slice(-6).toUpperCase()}</div>
                <hr />
                <div>Room: {lastOrderGroup.room_number || 'Walk-in'}</div>
                <div>Guest: {lastOrderGroup.guest_name}</div>
                <div>Date: {new Date(lastOrderGroup.created_at).toLocaleString()}</div>
                <hr />
                <table>
                  <thead>
                    <tr><th>Item</th><th>Qty</th><th className="text-right">Price</th></tr>
                  </thead>
                  <tbody>
                    {lastOrderGroup.items.map(item => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr />
                <div className="text-right font-bold" style={{ fontSize: '18px' }}>
                  Total: {formatCurrency(lastOrderGroup.total)}
                </div>
                <div className="text-center" style={{ marginTop: '20px', fontSize: '12px' }}>
                  Thank you for your order!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
