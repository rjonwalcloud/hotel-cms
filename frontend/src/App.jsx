import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Auth Pages
import Login from './pages/Login';

// Super Admin Pages
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import HotelsList from './pages/SuperAdmin/HotelsList';
import QuotaManagement from './pages/SuperAdmin/QuotaManagement';
import GlobalAudit from './pages/SuperAdmin/GlobalAudit';
import SubscriptionManagement from './pages/SuperAdmin/SubscriptionManagement';
import SystemBackup from './pages/SuperAdmin/SystemBackup';
import SystemSettings from './pages/SuperAdmin/SystemSettings';
import UserManagement from './pages/SuperAdmin/UserManagement';
import MenuVisibilityManagement from './pages/SuperAdmin/MenuVisibilityManagement';
import SupportSettings from './pages/SuperAdmin/SupportSettings';

// Hotel Admin Pages
import HotelAdminDashboard from './pages/HotelAdmin/Dashboard';
import RoomManagement from './pages/HotelAdmin/RoomManagement';
import RoomInventoryManagement from './pages/HotelAdmin/InventoryManagement';
import InventoryApp from './pages/HotelAdmin/Inventory/InventoryApp';
import RoomTypeManagement from './pages/HotelAdmin/RoomTypeManagement';
import AmenityManagement from './pages/HotelAdmin/AmenityManagement';
import BookingManagement from './pages/HotelAdmin/BookingManagement';
import BulkBookings from './pages/HotelAdmin/BulkBookings';
import CustomerManagement from './pages/HotelAdmin/CustomerManagement';
import ServiceManagement from './pages/HotelAdmin/ServiceManagement';
import HotelSettings from './pages/HotelAdmin/HotelSettings';
import CurrencyTaxManagement from './pages/HotelAdmin/CurrencyTaxManagement';
import QRCodeManagement from './pages/HotelAdmin/QRCodeManagement';
import BookingManager from './pages/HotelAdmin/BookingManager';
import ServiceRequests from './pages/HotelAdmin/ServiceRequests';
import RateManagement from './pages/HotelAdmin/RateManagement';
import PromotionManagement from './pages/HotelAdmin/PromotionManagement';
import TaskManagement from './pages/HotelAdmin/TaskManagement';
import AddonManagement from './pages/HotelAdmin/AddonManagement';
import Analytics from './pages/HotelAdmin/Analytics';
import InvoiceManagement from './pages/HotelAdmin/InvoiceManagement';
import RestaurantPOS from './pages/HotelAdmin/RestaurantPOS';
import CreditNotes from './pages/HotelAdmin/CreditNotes';
import LostFound from './pages/HotelAdmin/LostFound';
import Support from './pages/HotelAdmin/Support';

// Staff Pages
import StaffDashboard from './pages/Staff/Dashboard';
import StaffBookings from './pages/Staff/Bookings';
import StaffRooms from './pages/Staff/Rooms';
import StaffTasks from './pages/Staff/Tasks';
import StaffBreakageReport from './pages/Staff/BreakageReport';

// Public Pages
import LandingPage from './pages/Public/Landing/LandingPage';
import RoomServices from './pages/Public/RoomServices';

// Shared Pages
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token' && !e.newValue) {
        logout();
        window.location.href = '/login';
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [logout]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<RoleDashboard />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/hotelcms" element={<LandingPage />} />
        <Route path="/login" element={<LoginRouting />} />
        <Route path="/room-services/:token" element={<RoomServices />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<RoleDashboard />} />

          {/* Super Admin Routes */}
          <Route path="/admin/*" element={<ProtectedRoute role="SUPER_ADMIN" />}>
            <Route path="dashboard" element={<SuperAdminDashboard />} />
            <Route path="hotels" element={<HotelsList />} />
            <Route path="subscriptions" element={<SubscriptionManagement />} />
            <Route path="quotas" element={<QuotaManagement />} />
            <Route path="audit" element={<GlobalAudit />} />
            <Route path="system" element={<SystemBackup />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="menu-visibility" element={<MenuVisibilityManagement />} />
            <Route path="support" element={<SupportSettings />} />
          </Route>

          {/* Hotel Admin Routes */}
          <Route path="/hotel/*" element={<ProtectedRoute role="HOTEL_ADMIN" />}>
            <Route path="dashboard" element={<HotelAdminDashboard />} />
            <Route path="rooms" element={<RoomManagement />} />
            <Route path="room-inventory" element={<RoomInventoryManagement />} />
            <Route path="inventory/*" element={<InventoryApp />} />
            <Route path="room-types" element={<RoomTypeManagement />} />
            <Route path="amenities" element={<AmenityManagement />} />
            <Route path="bookings" element={<BookingManagement />} />
            <Route path="bulk-bookings" element={<BulkBookings />} />
            <Route path="customers" element={<CustomerManagement />} />
            <Route path="booking-manager" element={<BookingManager />} />
            <Route path="services" element={<ServiceManagement />} />
            <Route path="service-requests" element={<ServiceRequests />} />
            <Route path="rates" element={<RateManagement />} />
            <Route path="pos" element={<RestaurantPOS />} />
            <Route path="promotions" element={<PromotionManagement />} />
            <Route path="tax-currency" element={<CurrencyTaxManagement />} />
            <Route path="tasks" element={<TaskManagement />} />
            <Route path="invoices" element={<InvoiceManagement />} />
            <Route path="credit-notes" element={<CreditNotes />} />
            <Route path="settings" element={<HotelSettings />} />
            <Route path="addons" element={<AddonManagement />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="qrcodes" element={<QRCodeManagement />} />
            <Route path="lost-found" element={<LostFound />} />
            <Route path="support" element={<Support />} />
          </Route>

          {/* Staff Routes */}
          <Route path="/staff/*" element={<ProtectedRoute role="STAFF" />}>
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="bookings" element={<StaffBookings />} />
            <Route path="rooms" element={<StaffRooms />} />
            <Route path="tasks" element={<StaffTasks />} />
            <Route path="service-requests" element={<ServiceRequests />} />
            <Route path="pos" element={<RestaurantPOS />} />
            <Route path="breakage-report" element={<StaffBreakageReport />} />
            <Route path="invoices" element={<InvoiceManagement />} />
            <Route path="lost-found" element={<LostFound />} />
            <Route path="support" element={<Support />} />
          </Route>

          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function LoginRouting() {
  const { user, isAuthenticated } = useAuthStore();
  if (isAuthenticated && user && (user.roles?.length > 0 || user.hotel_id)) {
    return <Navigate to="/" replace />;
  }
  return <Login />;
}

function RoleDashboard() {
  const { user, logout, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.roles?.[0];
  const role = (typeof userRole === 'string' ? userRole : userRole?.role)?.toUpperCase();

  if (role === 'SUPER_ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'HOTEL_ADMIN' || role === 'ADMIN') return <Navigate to="/hotel/dashboard" replace />;
  if (role === 'STAFF') return <Navigate to="/staff/dashboard" replace />;

  // No valid role — log the user out (synchronous Zustand action, safe outside useEffect)
  if (user.roles?.length === 0 && !user.hotel_id) {
    logout();
    return <Navigate to="/login" replace />;
  }

  // Fallback if role is not recognized but user is logged in
  return <Navigate to="/hotel/dashboard" replace />;
}

export default App;
