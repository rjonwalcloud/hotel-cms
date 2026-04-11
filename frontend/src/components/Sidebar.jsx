import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import {
  Hotel,
  LayoutDashboard,
  Building2,
  DoorOpen,
  Calendar,
  UtensilsCrossed,
  Settings,
  User,
  Users,
  BarChart3,
  Database,
  FileText,
  X,
  QrCode,
  CreditCard,
  Globe,
  Tag,
  Wifi,
  TrendingUp,
  Bell,
  DollarSign,
  Percent,
  Home, // Added based on Code Edit
  LogOut,
  Menu,
  ClipboardList,
  Package,
  Archive,
  Truck,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Layers,
  Search,
  Headphones
} from 'lucide-react';
import { useState } from 'react';
import HotelSwitcher from './HotelSwitcher';

export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, hasRole, hasPermission, getHiddenMenus } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState([]);
  const hiddenMenus = getHiddenMenus();

  const isActive = (path) => location.pathname.startsWith(path);

  console.log('Sidebar Debug - Role:', user?.roles?.[0]?.role);
  console.log('Sidebar Debug - Hidden Menus:', hiddenMenus);

  const superAdminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/admin/hotels', icon: Building2, label: t('nav.hotels') },
    { to: '/admin/subscriptions', icon: CreditCard, label: t('nav.subscriptions') },
    { to: '/admin/quotas', icon: BarChart3, label: t('nav.quotas') },
    { to: '/admin/audit', icon: FileText, label: t('nav.audit') },
    { to: '/admin/system', icon: Database, label: t('nav.system') },
    { to: '/admin/settings', icon: Settings, label: t('nav.settings') },
    { to: '/admin/users', icon: User, label: t('nav.users') },
    { to: '/admin/menu-visibility', icon: Menu, label: t('nav.menu_visibility') },
    { to: '/admin/support', icon: Headphones, label: t('nav.support') },
  ];

  const hotelAdminLinks = [
    { to: '/hotel/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/hotel/analytics', icon: BarChart3, label: t('nav.analytics') },
    { to: '/hotel/rooms', icon: DoorOpen, label: t('nav.rooms') },
    { to: '/hotel/room-inventory', icon: Calendar, label: t('nav.room_calendar') },
    {
      id: 'inventory',
      label: t('nav.item_inventory'),
      icon: Package,
      submenu: [
        { to: '/hotel/inventory/items', icon: Package, label: t('nav.inventory_items') },
        { to: '/hotel/inventory/stock', icon: Layers, label: t('nav.stock_mgmt') },
        { to: '/hotel/inventory/breakage', icon: TrendingDown, label: t('nav.breakage_loss') },
        { to: '/hotel/inventory/expenses', icon: DollarSign, label: t('nav.expenses') },
        { to: '/hotel/inventory/suppliers', icon: Truck, label: t('nav.suppliers') },
      ]
    },
    { to: '/hotel/room-types', icon: Tag, label: t('nav.room_types') },
    { to: '/hotel/amenities', icon: Wifi, label: t('nav.amenities') },
    { to: '/hotel/addons', icon: Tag, label: t('nav.room_addons') },
    { to: '/hotel/bookings', icon: Calendar, label: t('nav.bookings') },
    { to: '/hotel/bulk-bookings', icon: Users, label: t('nav.bulk_bookings') },
    { to: '/hotel/customers', icon: Users, label: t('nav.customers') },
    { to: '/hotel/booking-manager', icon: Globe, label: t('nav.booking_manager') },
    { to: '/hotel/qrcodes', icon: QrCode, label: t('nav.qr_codes') },
    { to: '/hotel/services', icon: UtensilsCrossed, label: t('nav.services') },
    { to: '/hotel/service-requests', icon: Bell, label: t('nav.service_requests') },
    { to: '/hotel/rates', icon: Percent, label: t('nav.rates') },
    { to: '/hotel/pos', icon: UtensilsCrossed, label: t('nav.pos_restaurant') },
    { to: '/hotel/promotions', icon: Tag, label: t('nav.promotions') },
    { to: '/hotel/tax-currency', icon: DollarSign, label: t('nav.tax_currency') },
    { to: '/hotel/tasks', icon: ClipboardList, label: t('nav.tasks') },
    { to: '/hotel/invoices', icon: FileText, label: t('nav.invoices') },
    { to: '/hotel/credit-notes', icon: FileText, label: 'Credit Notes' },
    { to: '/hotel/lost-found', icon: Search, label: t('nav.lost_found') },
    { to: '/hotel/support', icon: Headphones, label: t('nav.support') },
    { to: '/hotel/settings', icon: Settings, label: t('nav.settings') },
  ];

  // Staff links are permission-gated: only show if user has the required permission
  const allStaffLinks = [
    { to: '/staff/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/staff/bookings', icon: Calendar, label: t('nav.bookings'), perm: 'BOOKING_VIEW' },
    { to: '/staff/customers', icon: Users, label: t('nav.customers'), perm: 'BOOKING_VIEW' },
    { to: '/staff/rooms', icon: DoorOpen, label: t('nav.rooms'), perm: 'ROOM_VIEW' },
    { to: '/staff/tasks', icon: ClipboardList, label: t('nav.tasks'), perm: 'TASK_VIEW' },
    { to: '/staff/service-requests', icon: Bell, label: t('nav.service_requests'), perm: 'SERVICE_REQUEST_VIEW' },
    { to: '/staff/pos', icon: UtensilsCrossed, label: t('nav.pos_restaurant'), perm: 'SERVICE_REQUEST_VIEW' },
    { to: '/staff/breakage-report', icon: TrendingDown, label: t('nav.report_breakage'), perm: 'INVENTORY_BREAKAGE_REPORT' },
    { to: '/staff/invoices', icon: FileText, label: t('nav.invoices'), perm: 'BOOKING_VIEW' },
    { to: '/staff/lost-found', icon: Search, label: t('nav.lost_found'), perm: 'LOST_FOUND_VIEW' },
    { to: '/staff/support', icon: Headphones, label: t('nav.support') },
  ];

  const staffLinks = allStaffLinks.filter(link => !link.perm || hasPermission(link.perm));

  let links = [];
  if (hasRole('SUPER_ADMIN')) links = superAdminLinks;
  else if (hasRole('HOTEL_ADMIN') || hasRole('ADMIN')) links = hotelAdminLinks;
  else if (hasRole('STAFF')) links = staffLinks;

  // Filter out hidden menus (allow management for SuperAdmin)
  if (!hasRole('SUPER_ADMIN')) {
    links = links.filter(link => !hiddenMenus.includes(link.to));
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="flex flex-col px-6 pt-6 pb-2">
        <div className="flex items-center space-x-4 mb-6 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Hotel className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-lg font-black text-slate-900 tracking-tight block">Hotel CMS</span>
          </div>
        </div>

        {/* Hotel Switcher */}
        <HotelSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {links.map((link) => {
          if (link.submenu) {
            const isOpen = openMenus.includes(link.id);
            const active = link.submenu.some(sub => isActive(sub.to));

            return (
              <div key={link.id} className="space-y-1">
                <button
                  onClick={() => setOpenMenus(prev =>
                    prev.includes(link.id) ? prev.filter(m => m !== link.id) : [...prev, link.id]
                  )}
                  className={`w-full flex items-center justify-between px-6 py-3.5 rounded-2xl transition-all duration-200 group relative ${active
                    ? 'bg-primary-50/50 text-primary-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <link.icon className={`w-5 h-5 ${active ? 'text-primary-600' : ''}`} />
                    <span className="text-sm tracking-wide font-bold">{link.label}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                </button>

                {isOpen && (
                  <div className="ml-8 space-y-1 pl-4 border-l-2 border-slate-100">
                    {link.submenu.map((sub) => (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${isActive(sub.to)
                          ? 'text-primary-700 font-bold bg-primary-50'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                      >
                        <sub.icon className="w-4 h-4" />
                        <span className="text-[13px]">{sub.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const Icon = link.icon;
          const active = isActive(link.to);

          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center space-x-3.5 px-6 py-3.5 rounded-2xl transition-all duration-200 group relative ${active
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary-600 rounded-r-full" />
              )}
              <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className={`text-sm tracking-wide ${active ? 'font-bold' : 'font-medium'}`}>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-6">
        <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
            <span className="text-primary-600 font-bold text-lg">
              {user?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {user?.full_name || 'User'}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {user?.roles?.[0]?.role || 'Role'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-gray-200 min-h-0">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center"
      >
        <LayoutDashboard className="w-6 h-6" />
      </button>
    </>
  );
}
