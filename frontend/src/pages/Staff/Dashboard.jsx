import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { bookingAPI, qrcodeAPI, taskAPI } from '../../services/api';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Calendar, CheckCircle, LogOut, Wrench, ClipboardList, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function StaffDashboard() {
  const { getHotelId } = useAuthStore();
  const hotelId = getHotelId();
  const [bookingData, setBookingData] = useState({ checkIns: [], checkOuts: [] });
  const [serviceRequests, setServiceRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bookings');

  useEffect(() => {
    if (hotelId) loadDashboardData();
  }, [hotelId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const [confirmedRes, checkedInRes, srRes, tasksRes] = await Promise.all([
        bookingAPI.getByHotel(hotelId, { status: 'CONFIRMED' }),
        bookingAPI.getByHotel(hotelId, { status: 'CHECKED_IN' }),
        qrcodeAPI.getServiceRequests(hotelId),
        taskAPI.getMyTasks(hotelId)
      ]);

      const activeBookings = [...(confirmedRes.bookings || []), ...(checkedInRes.bookings || [])];

      const checkIns = activeBookings.filter(b => format(new Date(b.check_in_date), 'yyyy-MM-dd') === today && b.status === 'CONFIRMED');
      const checkOuts = activeBookings.filter(b => format(new Date(b.check_out_date), 'yyyy-MM-dd') === today && b.status === 'CHECKED_IN');

      setBookingData({ checkIns, checkOuts });

      setServiceRequests((srRes.requests || []).filter(r => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)));

      setTasks((tasksRes.tasks || []).filter(t => ['PENDING', 'IN_PROGRESS'].includes(t.status)));

    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };



  const bookingColumns = [
    { key: 'guest_name', label: 'Guest Name' },
    { key: 'room_number', label: 'Room' },
    {
      key: 'type',
      label: 'Action Needed',
      render: (_, booking) => (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
          }`}>
          {booking.status === 'CONFIRMED' ? 'CHECK-IN' : 'CHECK-OUT'}
        </span>
      )
    },
  ];

  const srColumns = [
    { key: 'room_number', label: 'Room' },
    { key: 'service_name', label: 'Service' },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${val === 'PENDING' ? 'bg-amber-100 text-amber-800' :
          val === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
            'bg-indigo-100 text-indigo-800'
          }`}>
          {val.replace('_', ' ')}
        </span>
      )
    },
    { key: 'created_at', label: 'Requested At', render: (val) => format(new Date(val), 'MMM dd, h:mm a') }
  ];

  const taskColumns = [
    { key: 'title', label: 'Task' },
    {
      key: 'priority',
      label: 'Priority',
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${val === 'HIGH' || val === 'URGENT' ? 'bg-red-100 text-red-800' :
          val === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-800'
          }`}>
          {val}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
          {val.replace('_', ' ')}
        </span>
      )
    },
    { key: 'due_date', label: 'Due Date', render: (val) => val ? format(new Date(val), 'MMM dd, h:mm a') : '—' },
  ];

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Loading dashboard...</div>;
  if (!hotelId) return <div>No hotel assigned</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Calendar className="w-8 h-8 text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today's Schedule</h1>
          <p className="text-gray-600">{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <LogOut className="w-16 h-16" style={{ transform: 'rotate(180deg)' }} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Check-ins Today</p>
          <p className="text-3xl font-black text-blue-600 mt-2">{bookingData.checkIns.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <LogOut className="w-16 h-16" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Check-outs Today</p>
          <p className="text-3xl font-black text-purple-600 mt-2">{bookingData.checkOuts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wrench className="w-16 h-16" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Pending SRs</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{serviceRequests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ClipboardList className="w-16 h-16" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">My Tasks</p>
          <p className="text-3xl font-black text-indigo-600 mt-2">{tasks.length}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mt-8 mb-4">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === 'bookings'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Front Desk ({bookingData.checkIns.length + bookingData.checkOuts.length})
          </button>
          <button
            onClick={() => setActiveTab('srs')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === 'srs'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Service Requests ({serviceRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === 'tasks'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            My Tasks ({tasks.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
        {activeTab === 'bookings' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Today's Check-ins & Check-outs</h2>
            {bookingData.checkIns.length === 0 && bookingData.checkOuts.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No check-ins or check-outs scheduled for today.</p>
            ) : (
              <DataTable columns={bookingColumns} data={[...bookingData.checkIns, ...bookingData.checkOuts]} />
            )}
          </div>
        )}

        {activeTab === 'srs' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Pending Service Requests</h2>
            {serviceRequests.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">You have no pending service requests.</p>
            ) : (
              <DataTable columns={srColumns} data={serviceRequests} />
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">My Pending Tasks</h2>
            {tasks.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">You have no assigned tasks right now.</p>
            ) : (
              <DataTable columns={taskColumns} data={tasks} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
