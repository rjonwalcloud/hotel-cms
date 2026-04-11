import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  // If the URL doesn't end with /api or /api/, append it
  if (!envUrl.endsWith('/api') && !envUrl.endsWith('/api/')) {
    return envUrl.endsWith('/') ? `${envUrl}api` : `${envUrl}/api`;
  }
  return envUrl;
};

const API_URL = getBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginEndpoint) {
      if (!window.isLoggingOut && !window.location.pathname.includes('/login')) {
        window.isLoggingOut = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
        // Use replace to avoid back-button loops
        window.location.replace('/login');
      }
    }
    const errorData = error.response?.data;
    const errorMessage = errorData?.message || errorData?.error || error.message || 'An unexpected error occurred';

    // Create an Error-like object or just return the string/data
    // Since components expect error.message, we provide it.
    return Promise.reject({
      ...errorData,
      message: errorMessage
    });
  }
);

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Hotel APIs
export const hotelAPI = {
  getAll: (params) => api.get('/hotels', { params }),
  getById: (id) => api.get(`/hotels/${id}`),
  create: (data) => api.post('/hotels', data),
  update: (id, data) => api.put(`/hotels/${id}`, data),
  toggleStatus: (id, isActive) => api.patch(`/hotels/${id}/status`, { is_active: isActive }),
  getStats: (id) => api.get(`/hotels/${id}/stats`),
};

// Room APIs
export const roomAPI = {
  getByHotel: (hotelId, params) => api.get(`/rooms/hotel/${hotelId}`, { params }),
  getById: (id, hotelId) => api.get(`/rooms/${id}`, { params: { hotel_id: hotelId } }),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  updateStatus: (id, status, hotelId) => api.patch(`/rooms/${id}/status`, { status, hotel_id: hotelId }),
  delete: (id, hotelId) => api.delete(`/rooms/${id}`, { params: { hotel_id: hotelId } }),

  // Room Types
  getTypes: (hotelId) => api.get(`/rooms/types/hotel/${hotelId}`),
  createType: (data) => api.post('/rooms/types', data),
  updateType: (id, data) => api.put(`/rooms/types/${id}`, data),
  deleteType: (id, hotelId) => api.delete(`/rooms/types/${id}`, { params: { hotel_id: hotelId } }),
  syncInventory: (hotelId, days = 365) => api.post(`/rooms/types/hotel/${hotelId}/sync-inventory`, { days }),
};

// Booking APIs
export const bookingAPI = {
  checkAvailability: (params) => api.get('/bookings/check-availability', { params }),
  getByHotel: (hotelId, params) => api.get(`/bookings/hotel/${hotelId}`, { params }),
  getById: (id, hotelId) => api.get(`/bookings/${id}`, { params: { hotel_id: hotelId } }),
  create: (data) => api.post('/bookings', data),
  updateStatus: (id, status, hotelId) => api.patch(`/bookings/${id}/status/hotel/${hotelId}`, { status }),
  addPayment: (id, paidAmount, hotelId) => api.patch(`/bookings/${id}/payment/hotel/${hotelId}`, { paidAmount }),
  addRooms: (id, roomIds, hotelId) => api.post(`/bookings/${id}/rooms/hotel/${hotelId}`, { roomIds }),
  removeRoom: (id, roomId, hotelId) => api.delete(`/bookings/${id}/rooms/${roomId}/hotel/${hotelId}`),
  cancel: (id, hotelId, reason) => api.post(`/bookings/${id}/cancel`, { hotel_id: hotelId, reason }),
  checkIn: (id, hotelId, guestDetails, roomIds, bookingUpdates) => api.post(`/bookings/${id}/checkin`, { hotel_id: hotelId, guest_details: guestDetails, room_ids: roomIds, booking_updates: bookingUpdates }),
  checkOut: (id, hotelId, extraCharges, couponCode) => api.post(`/bookings/${id}/checkout`, { hotel_id: hotelId, extra_charges: extraCharges, coupon_code: couponCode }),
  getBilling: (id, hotelId, params = {}) => api.get(`/bookings/${id}/billing`, { params: { hotel_id: hotelId, ...params } }),
  getGuests: (hotelId, params) => api.get(`/bookings/guests/hotel/${hotelId}`, { params }),
  exportBookings: (hotelId) => api.get(`/bookings/hotel/${hotelId}/export`, { responseType: 'blob' }),
  settlePayment: (id, hotelId, paymentMethod) => api.post(`/bookings/${id}/settle-payment`, { hotel_id: hotelId, payment_method: paymentMethod }),
  createFrontBooking: (data) => api.post('/bookings/front-booking', data),
};

export const bulkBookingAPI = {
  create: (hotelId, data) => api.post(`/bulk-bookings/hotel/${hotelId}`, data),
  getByHotel: (hotelId, params) => api.get(`/bulk-bookings/hotel/${hotelId}`, { params }),
  getById: (id, hotelId) => api.get(`/bulk-bookings/${id}/hotel/${hotelId}`),
  updateStatus: (id, status, room_assignments, hotelId, guest_details) => api.patch(`/bulk-bookings/${id}/status/hotel/${hotelId}`, { status, room_assignments, guest_details }),
  getInvoice: (id, hotelId) => api.get(`/bulk-bookings/${id}/invoice/hotel/${hotelId}`),
  updateBilling: (id, hotelId, data) => api.patch(`/bulk-bookings/${id}/billing/hotel/${hotelId}`, data),
  settlePayment: (id, hotelId, paymentMethod) => api.post(`/bulk-bookings/${id}/checkout/hotel/${hotelId}`, { payment_method: paymentMethod })
};

// Rate Management APIs
export const rateAPI = {
  getPlans: (hotelId) => api.get(`/rates/plans/hotel/${hotelId}`),
  createPlan: (hotelId, data) => api.post(`/rates/plans/hotel/${hotelId}`, data),
  updatePlan: (id, hotelId, data) => api.put(`/rates/plans/${id}/hotel/${hotelId}`, data),
  deletePlan: (id, hotelId) => api.delete(`/rates/plans/${id}/hotel/${hotelId}`),
  getRules: (hotelId, params) => api.get(`/rates/rules/hotel/${hotelId}`, { params }),
  createRule: (hotelId, data) => api.post(`/rates/rules/hotel/${hotelId}`, data),
  updateRule: (id, hotelId, data) => api.put(`/rates/rules/${id}/hotel/${hotelId}`, data),
  deleteRule: (id, hotelId) => api.delete(`/rates/rules/${id}/hotel/${hotelId}`),
};

// Promotion APIs
export const promotionAPI = {
  getPromotions: (hotelId) => api.get(`/promotions/hotel/${hotelId}`),
  createPromotion: (hotelId, data) => api.post(`/promotions/hotel/${hotelId}`, data),
  updatePromotion: (id, hotelId, data) => api.put(`/promotions/${id}/hotel/${hotelId}`, data),
  deletePromotion: (id, hotelId) => api.delete(`/promotions/${id}/hotel/${hotelId}`),
  getCoupons: (hotelId) => api.get(`/promotions/coupons/hotel/${hotelId}`),
  createCoupon: (hotelId, data) => api.post(`/promotions/coupons/hotel/${hotelId}`, data),
  updateCoupon: (id, hotelId, data) => api.put(`/promotions/coupons/${id}/hotel/${hotelId}`, data),
  deleteCoupon: (id, hotelId) => api.delete(`/promotions/coupons/${id}/hotel/${hotelId}`),
  validateCoupon: (hotelId, data) => api.post(`/promotions/coupons/validate/hotel/${hotelId}`, data),
};

// Quote API
export const quoteAPI = {
  getQuote: (params) => api.get('/quote/price', { params }),
};

// Service APIs
export const serviceAPI = {
  // Categories
  getCategories: (hotelId) => api.get(`/services/categories/hotel/${hotelId}`),
  createCategory: (data) => api.post('/services/categories', data),
  updateCategory: (id, data) => api.put(`/services/categories/${id}`, data),
  deleteCategory: (id, hotelId) => api.delete(`/services/categories/${id}`, { params: { hotel_id: hotelId } }),

  // Items
  getItems: (hotelId, params) => api.get(`/services/items/hotel/${hotelId}`, { params }),
  getItemById: (id, hotelId) => api.get(`/services/items/${id}`, { params: { hotel_id: hotelId } }),
  createItem: (data) => api.post('/services/items', data),
  updateItem: (id, data) => api.put(`/services/items/${id}`, data),
  toggleAvailability: (id, isAvailable, hotelId) => api.patch(`/services/items/${id}/availability`, { is_available: isAvailable, hotel_id: hotelId }),
  deleteItem: (id, hotelId) => api.delete(`/services/items/${id}`, { params: { hotel_id: hotelId } }),
};

// Amenities APIs
export const amenityAPI = {
  getByHotel: (hotelId) => api.get(`/amenities/hotel`, { params: { hotel_id: hotelId } }),
  create: (data) => api.post('/amenities', data),
  update: (id, data) => api.put(`/amenities/${id}`, data),
  delete: (id, hotelId) => api.delete(`/amenities/${id}`, { params: { hotel_id: hotelId } }),
};

// Room Inventory APIs (Calendar/Availability)
export const roomInventoryAPI = {
  getDashboardStats: (hotelId) => api.get(`/inventory/hotel/${hotelId}/dashboard`),
  getCalendar: (hotelId, startDate, endDate) => api.get(`/inventory/hotel/${hotelId}/calendar`, {
    params: { start_date: startDate, end_date: endDate }
  }),
};

// Policy/Quota APIs
export const policyAPI = {
  getAllLimits: () => api.get('/policy/limits'),
  getHotelLimits: (hotelId) => api.get(`/policy/hotel/${hotelId}/limits`),
  setHotelLimit: (hotelId, limitKey, maxValue) => api.post(`/policy/hotel/${hotelId}/limits`, { limit_key: limitKey, max_value: maxValue }),
  getUsageStats: (hotelId) => api.get(`/policy/hotel/${hotelId}/usage`),
  resetCounter: (hotelId, limitKey) => api.post(`/policy/hotel/${hotelId}/reset-counter`, { limit_key: limitKey }),
  getQuotaSummary: () => api.get('/policy/quota-summary'),
};

// Audit APIs
export const auditAPI = {
  getByHotel: (hotelId, params) => api.get(`/audit/hotel/${hotelId}`, { params }),
  getById: (id, hotelId) => api.get(`/audit/log/${id}`, { params: { hotel_id: hotelId } }),
  getEntityHistory: (entityType, entityId, hotelId) => api.get(`/audit/entity/${entityType}/${entityId}`, { params: { hotel_id: hotelId } }),
  getStats: (hotelId, params) => api.get(`/audit/hotel/${hotelId}/stats`, { params }),
  getUserActivity: (userId, hotelId, limit) => api.get(`/audit/user/${userId}/activity`, { params: { hotel_id: hotelId, limit } }),
  getAll: (params) => api.get('/audit/all', { params }),
  exportCSV: (hotelId, fromDate, toDate) => {
    return api.get(`/audit/hotel/${hotelId}/export`, {
      params: { from_date: fromDate, to_date: toDate },
      responseType: 'blob',
    });
  },
  exportGlobalCSV: (params) => {
    return api.get('/audit/export/all', {
      params,
      responseType: 'blob',
    });
  },
};

// QR Code APIs
export const qrcodeAPI = {
  generate: (data) => api.post('/qrcodes/generate', data),
  bulkGenerate: (data) => api.post('/qrcodes/bulk-generate', data),
  getByHotel: (hotelId) => api.get(`/qrcodes/hotel/${hotelId}`),
  scan: (token) => api.get(`/qrcodes/scan/${token}`),
  createServiceRequest: (token, data) => api.post(`/qrcodes/scan/${token}/request`, data),
  bulkCreateServiceRequests: (token, data) => api.post(`/qrcodes/scan/${token}/request/bulk`, data),
  bulkCreateServiceRequestsStaff: (data) => api.post(`/qrcodes/requests/hotel/${data.hotel_id}/bulk`, data),
  getGuestOrders: (token) => api.get(`/qrcodes/scan/${token}/orders`),
  getServiceRequests: (hotelId, params) => api.get(`/qrcodes/requests/hotel/${hotelId}`, { params }),
  updateServiceRequestStatus: (requestId, data) => api.patch(`/qrcodes/requests/${requestId}/status`, data),
  bulkUpdateServiceRequestStatus: (data) => api.patch(`/qrcodes/requests/bulk-status`, data),
  getSRDetails: (requestId) => api.get(`/qrcodes/requests/${requestId}/details`),
  toggleStatus: (qrId, data) => api.patch(`/qrcodes/${qrId}/status`, data),
  delete: (qrId, hotelId) => api.delete(`/qrcodes/${qrId}`, { params: { hotel_id: hotelId } }),
  validateCouponPublic: (data) => api.post('/public/validate-coupon', data),
};

// Subscription APIs
export const subscriptionAPI = {
  // Plans
  getPlans: (params) => api.get('/subscriptions/plans', { params }),
  getPlanById: (planId) => api.get(`/subscriptions/plans/${planId}`),
  createPlan: (data) => api.post('/subscriptions/plans', data),
  updatePlan: (planId, data) => api.put(`/subscriptions/plans/${planId}`, data),
  // Subscriptions
  activate: (data) => api.post('/subscriptions/activate', data),
  renew: (subscriptionId) => api.post(`/subscriptions/${subscriptionId}/renew`),
  cancel: (subscriptionId, reason) => api.post(`/subscriptions/${subscriptionId}/cancel`, { reason }),
  getByHotel: (hotelId) => api.get(`/subscriptions/hotel/${hotelId}`),
  getAll: (params) => api.get('/subscriptions', { params }),
  getHistory: (subscriptionId) => api.get(`/subscriptions/${subscriptionId}/history`),
};

// Booking Manager APIs
export const bookingManagerAPI = {
  // Channels
  createChannel: (data) => api.post('/booking-manager/channels', data),
  getChannels: (hotelId) => api.get(`/booking-manager/channels/hotel/${hotelId}`),
  getChannel: (channelId, hotelId) => api.get(`/booking-manager/channels/${channelId}`, { params: { hotel_id: hotelId } }),
  updateChannel: (channelId, data) => api.put(`/booking-manager/channels/${channelId}`, data),
  toggleChannelStatus: (channelId, data) => api.patch(`/booking-manager/channels/${channelId}/status`, data),
  deleteChannel: (channelId, hotelId) => api.delete(`/booking-manager/channels/${channelId}`, { params: { hotel_id: hotelId } }),
  // Channel Bookings
  createChannelBooking: (data) => api.post('/booking-manager/bookings', data),
  getChannelBookings: (hotelId, params) => api.get(`/booking-manager/bookings/hotel/${hotelId}`, { params }),
  updateChannelBookingStatus: (bookingId, data) => api.patch(`/booking-manager/bookings/${bookingId}/status`, data),
  // Stats
  getStats: (hotelId) => api.get(`/booking-manager/stats/hotel/${hotelId}`),
};

// System Maintenance APIs
export const systemAPI = {
  downloadBackup: () => api.get('/system/backup', { responseType: 'blob' }),
  getConfigs: () => api.get('/system/configs'),
  updateConfigs: (data) => api.post('/system/configs', data),
};

// Public APIs (No Auth)
export const publicAPI = {
  getSystemConfigs: () => api.get('/public/system-configs'),
};

// Settings & Tax APIs
export const settingsAPI = {
  getSettings: (hotelId) => api.get('/settings', { params: { hotel_id: hotelId } }),
  updateSettings: (data, hotelId) => api.put('/settings', data, { params: { hotel_id: hotelId } }),
  getTaxes: (hotelId) => api.get('/settings/taxes', { params: { hotel_id: hotelId } }),
  createTax: (data, hotelId) => api.post('/settings/taxes', data, { params: { hotel_id: hotelId } }),
  updateTax: (id, data, hotelId) => api.put(`/settings/taxes/${id}`, data, { params: { hotel_id: hotelId } }),
  deleteTax: (id, hotelId) => api.delete(`/settings/taxes/${id}`, { params: { hotel_id: hotelId } }),
};

// Task APIs
export const taskAPI = {
  getByHotel: (hotelId) => api.get(`/tasks/hotel/${hotelId}`),
  getMyTasks: (hotelId) => api.get(`/tasks/my/${hotelId}`),
  getStaff: (hotelId) => api.get(`/tasks/staff/${hotelId}`),
  getDetails: (id) => api.get(`/tasks/${id}/details`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, data) => api.patch(`/tasks/${id}/status`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  // Auto-task rules
  getAutoRules: (hotelId) => api.get(`/tasks/auto-rules/${hotelId}`),
  createAutoRule: (data) => api.post('/tasks/auto-rules', data),
  updateAutoRule: (id, data) => api.put(`/tasks/auto-rules/${id}`, data),
  toggleAutoRule: (id) => api.patch(`/tasks/auto-rules/${id}/toggle`),
  deleteAutoRule: (id) => api.delete(`/tasks/auto-rules/${id}`),
};

export const adminUserAPI = {
  getUsersByHotel: (hotelId) => api.get(`/users/hotel/${hotelId}`),
  getAllPermissions: () => api.get('/users/permissions'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id, hotelId) => api.delete(`/users/${id}`, { params: { hotel_id: hotelId } }),
  updateMenuVisibility: (data) => api.post('/users/menu-visibility', data),
};

export const addonAPI = {
  getByHotel: (hotelId) => api.get(`/addons/hotel/${hotelId}`),
  create: (data) => api.post('/addons', data),
  update: (id, data) => api.put(`/addons/${id}`, data),
  delete: (id) => api.delete(`/addons/${id}`)
};

export const invoiceAPI = {
  getBookingInvoices: (params) => api.get('/financials/bookings', { params }),
  getServiceInvoices: (params) => api.get('/financials/qr-services', { params }),
  getAll: (params) => api.get('/financials/all', { params }),
};

// Item Inventory APIs (Supplies, POs, etc)
export const itemInventoryAPI = {
  // Categories
  getCategories: () => api.get('/item-inventory/categories'),
  createCategory: (data) => api.post('/item-inventory/categories', data),
  updateCategory: (id, data) => api.put(`/item-inventory/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/item-inventory/categories/${id}`),

  // Items
  getItems: (params) => api.get('/item-inventory/items', { params }),
  createItem: (data) => api.post('/item-inventory/items', data),
  updateItem: (id, data) => api.put(`/item-inventory/items/${id}`, data),
  deleteItem: (id) => api.delete(`/item-inventory/items/${id}`),

  // Stock
  getStockLevels: (params) => api.get('/item-inventory/stock', { params }),
  adjustStock: (data) => api.post('/item-inventory/stock/adjust', data),

  // Suppliers & POs
  getSuppliers: () => api.get('/item-inventory/suppliers'),
  createSupplier: (data) => api.post('/item-inventory/suppliers', data),
  getPOs: (params) => api.get('/item-inventory/purchase-orders', { params }),
  getPODetail: (poId) => api.get(`/item-inventory/purchase-orders/${poId}`),
  createPO: (data) => api.post('/item-inventory/purchase-orders', data),
  receivePO: (poId, data) => api.post(`/item-inventory/purchase-orders/${poId}/receive`, data),

  // Breakage & Expenses
  getBreakageReports: (params) => api.get('/item-inventory/breakage-report', { params }),
  reportBreakage: (data) => api.post('/item-inventory/breakage-report', data),
  getExpenses: (params) => api.get('/item-inventory/expenses', { params }),
  logExpense: (data) => api.post('/item-inventory/expenses', data),
};

export const creditNoteAPI = {
  getByHotel: (hotelId, params) => api.get(`/credit-notes/hotel/${hotelId}`, { params }),
  getById: (id, hotelId) => api.get(`/credit-notes/${id}`, { params: { hotel_id: hotelId } }),
  create: (data) => api.post('/credit-notes', data),
  approve: (id, hotelId) => api.patch(`/credit-notes/${id}/approve`, { hotel_id: hotelId }),
  reject: (id, hotelId, reason) => api.patch(`/credit-notes/${id}/reject`, { hotel_id: hotelId, reason }),
};

export const lostFoundAPI = {
  getByHotel: (hotelId, params) => api.get(`/lost-found/hotel/${hotelId}`, { params }),
  getById: (id, hotelId) => api.get(`/lost-found/${id}`, { params: { hotel_id: hotelId } }),
  create: (data) => api.post('/lost-found', data),
  update: (id, data) => api.put(`/lost-found/${id}`, data),
  updateStatus: (id, status, hotelId) => api.patch(`/lost-found/${id}/status`, { status, hotel_id: hotelId }),
  delete: (id, hotelId) => api.delete(`/lost-found/${id}`, { params: { hotel_id: hotelId } }),
};

export default api;
