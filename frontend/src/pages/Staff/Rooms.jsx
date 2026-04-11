import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { roomAPI } from '../../services/api';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';

export default function StaffRooms() {
  const { getHotelId } = useAuthStore();
  const hotelId = getHotelId();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) loadRooms();
  }, [hotelId]);

  const loadRooms = async () => {
    try {
      const data = await roomAPI.getByHotel(hotelId);
      setRooms(data.rooms || []);
    } catch (error) {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (room, newStatus) => {
    try {
      await roomAPI.updateStatus(room.id, newStatus, hotelId);
      toast.success('Room status updated');
      loadRooms();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const columns = [
    { key: 'room_number', label: 'Room Number' },
    { key: 'floor', label: 'Floor' },
    { key: 'room_type_name', label: 'Type' },
    { 
      key: 'status', 
      label: 'Status',
      render: (value, room) => (
        <select
          value={value}
          onChange={(e) => handleStatusChange(room, e.target.value)}
          className={`text-sm border rounded px-3 py-1.5 ${
            value === 'AVAILABLE' ? 'bg-green-50 text-green-800' :
            value === 'OCCUPIED' ? 'bg-blue-50 text-blue-800' :
            value === 'MAINTENANCE' ? 'bg-yellow-50 text-yellow-800' :
            'bg-red-50 text-red-800'
          }`}
        >
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      )
    },
  ];

  if (loading) return <div>Loading...</div>;
  if (!hotelId) return <div>No hotel assigned</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Room Status</h1>
        <p className="text-gray-600">Update room availability</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Available</p>
          <p className="text-2xl font-bold text-green-600">
            {rooms.filter(r => r.status === 'AVAILABLE').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Occupied</p>
          <p className="text-2xl font-bold text-blue-600">
            {rooms.filter(r => r.status === 'OCCUPIED').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Maintenance</p>
          <p className="text-2xl font-bold text-yellow-600">
            {rooms.filter(r => r.status === 'MAINTENANCE').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Blocked</p>
          <p className="text-2xl font-bold text-red-600">
            {rooms.filter(r => r.status === 'BLOCKED').length}
          </p>
        </div>
      </div>

      <DataTable columns={columns} data={rooms} />
    </div>
  );
}
