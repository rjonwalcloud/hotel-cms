import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { bookingAPI } from '../../services/api';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function StaffBookings() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const hotelId = getHotelId();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) loadBookings();
  }, [hotelId]);

  const loadBookings = async () => {
    try {
      const data = await bookingAPI.getByHotel(hotelId);
      setBookings(data.bookings || []);
    } catch (error) {
      toast.error(t('bookings.messages.load_error') || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (booking) => {
    try {
      await bookingAPI.checkIn(booking.id, hotelId);
      toast.success(t('bookings.messages.check_in_success'));
      loadBookings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCheckOut = async (booking) => {
    try {
      await bookingAPI.checkOut(booking.id, hotelId);
      toast.success(t('bookings.messages.check_out_success'));
      loadBookings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'guest_name', label: t('bookings.table.guest') },
    { key: 'room_number', label: t('rooms.room_number') },
    { 
      key: 'check_in_date', 
      label: t('bookings.table.check_in'),
      render: (value) => format(new Date(value), 'MMM dd, yyyy')
    },
    { 
      key: 'check_out_date', 
      label: t('bookings.table.check_out'),
      render: (value) => format(new Date(value), 'MMM dd, yyyy')
    },
    { 
      key: 'status', 
      label: t('bookings.table.status'),
      render: (value) => {
        const statusMap = {
          'CONFIRMED': { label: t('bookings.status.confirmed'), color: 'bg-green-100 text-green-800' },
          'CHECKED_IN': { label: t('bookings.status.checked_in'), color: 'bg-blue-100 text-blue-800' },
          'CHECKED_OUT': { label: t('bookings.status.checked_out'), color: 'bg-gray-100 text-gray-800' },
          'CANCELLED': { label: t('bookings.status.cancelled'), color: 'bg-red-100 text-red-800' },
        };
        const status = statusMap[value] || { label: value, color: 'bg-yellow-100 text-yellow-800' };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: t('nav.actions') || 'Actions',
      render: (_, booking) => (
        <div className="flex space-x-2">
          {booking.status === 'CONFIRMED' && (
            <button
              onClick={() => handleCheckIn(booking)}
              className="text-xs btn btn-primary py-1 px-2 inline-flex items-center"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('bookings.actions.check_in')}
            </button>
          )}
          {booking.status === 'CHECKED_IN' && (
            <button
              onClick={() => handleCheckOut(booking)}
              className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 inline-flex items-center"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('bookings.actions.check_out')}
            </button>
          )}
        </div>
      )
    },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  );

  if (!hotelId) return (
    <div className="text-center py-12">
      <p className="text-gray-500">{t('dashboard.no_hotel')}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('bookings.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('bookings.subtitle')}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <DataTable columns={columns} data={bookings} />
      </div>
    </div>
  );
}
