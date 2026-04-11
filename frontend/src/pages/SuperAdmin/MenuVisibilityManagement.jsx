import { useState, useEffect } from 'react';
import { hotelAPI, adminUserAPI } from '../../services/api';
import {
  Building2,
  Users,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MenuVisibilityManagement() {
  const [hotels, setHotels] = useState([]);
  const [selectedHotels, setSelectedHotels] = useState([]);
  const [userType, setUserType] = useState('STAFF'); // STAFF, HOTEL_ADMIN
  const [individualUsers, setIndividualUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Hardcoded menu options based on Sidebar.jsx
  const menuOptions = [
    { label: 'Dashboard', to: '/hotel/dashboard' },
    { label: 'Rooms', to: '/hotel/rooms' },
    { label: 'Inventory', to: '/hotel/inventory' },
    { label: 'Room Types', to: '/hotel/room-types' },
    { label: 'Amenities', to: '/hotel/amenities' },
    { label: 'Room Addons', to: '/hotel/addons' },
    { label: 'Bookings', to: '/hotel/bookings' },
    { label: 'Bulk Bookings', to: '/hotel/bulk-bookings' },
    { label: 'Customers', to: '/hotel/customers' },
    { label: 'Booking Manager', to: '/hotel/booking-manager' },
    { label: 'QR Codes', to: '/hotel/qrcodes' },
    { label: 'Services', to: '/hotel/services' },
    { label: 'Service Requests', to: '/hotel/service-requests' },
    { label: 'Rate Management', to: '/hotel/rates' },
    { label: 'Promotions', to: '/hotel/promotions' },
    { label: 'Tax & Currency', to: '/hotel/tax-currency' },
    { label: 'Tasks', to: '/hotel/tasks' },
    { label: 'Settings', to: '/hotel/settings' },
    // Staff specific paths if needed (though they usually overlap)
    { label: 'Staff Dashboard', to: '/staff/dashboard' },
    { label: 'Staff Bookings', to: '/staff/bookings' },
    { label: 'Staff Rooms', to: '/staff/rooms' },
    { label: 'Staff Tasks', to: '/staff/tasks' },
    { label: 'Support Settings', to: '/admin/support' },
    { label: 'Support Hub', to: '/hotel/support' },
    { label: 'Staff Support', to: '/staff/support' },
  ];

  const [hiddenMenus, setHiddenMenus] = useState([]);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    try {
      setLoading(true);
      const res = await hotelAPI.getAll();
      setHotels(res.hotels || []);
    } catch (error) {
      toast.error('Failed to fetch hotels');
    } finally {
      setLoading(false);
    }
  };

  const fetchHotelUsers = async () => {
    if (selectedHotels.length === 0) return;
    try {
      setLoading(true);
      // Fetch users for all selected hotels (simplified: just fetch for first selected or handle loop)
      const allUsers = [];
      for (const hotelId of selectedHotels) {
        const res = await adminUserAPI.getUsersByHotel(hotelId);
        const users = res.users || [];
        allUsers.push(...users);
      }
      setIndividualUsers(allUsers);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (selectedHotels.length === 0) {
      toast.error('Please select at least one hotel');
      return;
    }

    try {
      setUpdating(true);

      const payload = {
        hotelIds: selectedHotels,
        hiddenMenuItems: hiddenMenus
      };

      if (selectedUsers.length > 0) {
        payload.userIds = selectedUsers;
      } else {
        payload.roleName = userType;
      }

      await adminUserAPI.updateMenuVisibility(payload);
      toast.success('Menu visibility updated successfully');

      // Clear selection after success
      setSelectedUsers([]);
      setHiddenMenus([]);
    } catch (error) {
      toast.error(error.message || 'Failed to update visibility');
    } finally {
      setUpdating(false);
    }
  };

  const toggleMenu = (to) => {
    setHiddenMenus(prev =>
      prev.includes(to) ? prev.filter(item => item !== to) : [...prev, to]
    );
  };

  const toggleHotel = (id) => {
    setSelectedHotels(prev =>
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    );
  };

  const toggleUser = (id) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Menu Visibility Management</h1>
        <p className="text-slate-500 mt-2">Manage which menu items are visible for users or roles across hotels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Select Hotels */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">1. Select Hotels</h2>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {Array.isArray(hotels) && hotels.map(hotel => (
              <button
                key={hotel.id}
                onClick={() => toggleHotel(hotel.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${selectedHotels.includes(hotel.id)
                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                    : 'bg-slate-50 border-transparent text-slate-600 hover:bg-white hover:border-slate-200'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${selectedHotels.includes(hotel.id) ? 'bg-primary-500' : 'bg-slate-300'}`} />
                  <span className="font-bold text-sm truncate">{hotel.name}</span>
                </div>
                {selectedHotels.includes(hotel.id) && <CheckCircle2 className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select Users / Role */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">2. Target Users</h2>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
            <button
              onClick={() => { setUserType('STAFF'); setSelectedUsers([]); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${userType === 'STAFF' && selectedUsers.length === 0 ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
            >
              All Staff
            </button>
            <button
              onClick={() => { setUserType('HOTEL_ADMIN'); setSelectedUsers([]); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${userType === 'HOTEL_ADMIN' && selectedUsers.length === 0 ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
            >
              All Admins
            </button>
            <button
              onClick={() => { if (individualUsers.length === 0) fetchHotelUsers(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${selectedUsers.length > 0 ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
            >
              Select Users
            </button>
          </div>

          {selectedHotels.length > 0 ? (
            <div className="space-y-4">
              {individualUsers.length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-primary-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                    {individualUsers
                      .filter(u => u.full_name.toLowerCase().includes(searchUser.toLowerCase()))
                      .map(u => (
                        <button
                          key={u.id}
                          onClick={() => toggleUser(u.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedUsers.includes(u.id)
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex-1 text-left">
                            <p className="font-bold text-xs">{u.full_name}</p>
                            <p className="text-[10px] text-slate-400">{u.role_name} • {u.email}</p>
                          </div>
                          {selectedUsers.includes(u.id) && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-slate-400 text-sm">Select "Select Users" to load individuals from selected hotels.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 px-6">
              <p className="text-slate-400 text-sm">Select one or more hotels first to see users.</p>
            </div>
          )}
        </div>

        {/* Step 3: Select Menu Visibility */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">3. Hide Menus</h2>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar pr-2">
            <div className="px-2 py-1 mb-2 bg-slate-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400">
              Check items to HIDE them
            </div>
            {menuOptions.map(option => (
              <button
                key={option.to}
                onClick={() => toggleMenu(option.to)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${hiddenMenus.includes(option.to)
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  {hiddenMenus.includes(option.to) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span className="font-bold text-sm tracking-tight">{option.label}</span>
                </div>
                {hiddenMenus.includes(option.to) && (
                  <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
                    <Save className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={handleUpdate}
              disabled={updating || selectedHotels.length === 0}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 flex items-center justify-center space-x-2"
            >
              {updating ? 'Updating...' : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Visibility Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
