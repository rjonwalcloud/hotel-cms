import { useState, useEffect } from 'react';
import { hotelAPI } from '../../services/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function HotelsList() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    try {
      const data = await hotelAPI.getAll();
      setHotels(data.hotels);
    } catch (error) {
      toast.error('Failed to load hotels');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHotel) {
        await hotelAPI.update(editingHotel.id, formData);
        toast.success('Hotel updated successfully!');
      } else {
        await hotelAPI.create(formData);
        toast.success('Hotel created successfully!');
      }
      setShowModal(false);
      setEditingHotel(null);
      loadHotels();
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    }
  };

  const handleEdit = (hotel) => {
    setEditingHotel(hotel);
    setFormData({
      name: hotel.name,
      address: hotel.address || '',
      city: hotel.city || '',
      state: hotel.state || '',
      country: hotel.country || '',
      postal_code: hotel.postal_code || '',
      phone: hotel.phone || '',
      email: hotel.email || '',
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (hotel) => {
    try {
      await hotelAPI.toggleStatus(hotel.id, !hotel.is_active);
      toast.success(`Hotel ${hotel.is_active ? 'deactivated' : 'activated'}`);
      loadHotels();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      phone: '',
      email: '',
    });
  };

  const columns = [
    { key: 'hotel_id_code', label: 'Hotel ID' },
    { key: 'name', label: 'Hotel Name' },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading hotels...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hotels Management</h1>
          <p className="text-gray-600">Manage all hotels in the system</p>
        </div>
        <button
          onClick={() => {
            setEditingHotel(null);
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Hotel
        </button>
      </div>

      <DataTable
        columns={columns}
        data={hotels}
        onEdit={handleEdit}
        onDelete={(hotel) => handleToggleStatus(hotel)}
      />

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingHotel(null);
          resetForm();
        }}
        title={editingHotel ? 'Edit Hotel' : 'Create Hotel'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hotel Name *
            </label>
            <input
              required
              placeholder="Grand Hotel"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              placeholder="123 Main Street"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                required
                placeholder="New York"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                placeholder="NY"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country *
              </label>
              <input
                required
                placeholder="USA"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postal Code
              </label>
              <input
                placeholder="10001"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="contact@hotel.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn btn-primary flex-1">
              {editingHotel ? 'Update Hotel' : 'Create Hotel'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingHotel(null);
                resetForm();
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
