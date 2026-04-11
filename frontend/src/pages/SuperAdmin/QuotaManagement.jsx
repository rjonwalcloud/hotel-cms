import { useState, useEffect } from 'react';
import { policyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle, AlertTriangle, Edit } from 'lucide-react';
import Modal from '../../components/Modal';

export default function QuotaManagement() {
  const [quotaSummary, setQuotaSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState(null);
  const [newMaxValue, setNewMaxValue] = useState('');

  useEffect(() => {
    loadQuotaSummary();
  }, []);

  const loadQuotaSummary = async () => {
    try {
      const data = await policyAPI.getQuotaSummary();
      setQuotaSummary(data.hotels || []);
    } catch (error) {
      toast.error('Failed to load quota data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLimit = (hotelId, limit) => {
    setEditingLimit({ hotelId, limit });
    setNewMaxValue(limit.max_value.toString());
    setShowEditModal(true);
  };

  const handleUpdateLimit = async () => {
    try {
      await policyAPI.setHotelLimit(
        editingLimit.hotelId,
        editingLimit.limit.key,
        parseInt(newMaxValue)
      );
      toast.success('Limit updated successfully');
      setShowEditModal(false);
      loadQuotaSummary();
    } catch (error) {
      toast.error(error.message || 'Failed to update limit');
    }
  };

  const getStatusIcon = (percentage) => {
    if (percentage >= 100) return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (percentage >= 90) return <AlertTriangle className="w-5 h-5 text-red-600" />;
    if (percentage >= 75) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-600';
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading quota data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quota Management</h1>
        <p className="text-gray-600">Monitor and manage hotel quotas across the system</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total Hotels</p>
          <p className="text-2xl font-bold text-gray-900">{quotaSummary.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Healthy</p>
          <p className="text-2xl font-bold text-green-600">
            {quotaSummary.filter(h => h.limits.every(l => l.usage_percentage < 75)).length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Warning</p>
          <p className="text-2xl font-bold text-yellow-600">
            {quotaSummary.filter(h => h.limits.some(l => l.usage_percentage >= 75 && l.usage_percentage < 90)).length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Critical</p>
          <p className="text-2xl font-bold text-red-600">
            {quotaSummary.filter(h => h.limits.some(l => l.usage_percentage >= 90)).length}
          </p>
        </div>
      </div>

      {/* Hotels Quota Details */}
      <div className="space-y-4">
        {quotaSummary.map((hotel) => (
          <div key={hotel.hotel_id} className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{hotel.hotel_name}</h3>
                <p className="text-sm text-gray-500">Hotel ID: {hotel.hotel_id}</p>
              </div>
              <div className="flex items-center space-x-2">
                {hotel.limits.some(l => l.usage_percentage >= 90) && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    Critical
                  </span>
                )}
                {hotel.limits.some(l => l.usage_percentage >= 75 && l.usage_percentage < 90) && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    Warning
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotel.limits.map((limit) => (
                <div key={limit.key} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusIcon(limit.usage_percentage)}
                        <h4 className="font-medium text-gray-900 text-sm">
                          {limit.description || limit.key}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-500">
                        {limit.current_value} / {limit.max_value}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEditLimit(hotel.hotel_id, limit)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getStatusColor(Number(limit.usage_percentage))}`}
                        style={{ width: `${Math.min(Number(limit.usage_percentage), 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{Number(limit.usage_percentage).toFixed(1)}% used</span>
                      <span className={`font-medium ${Number(limit.usage_percentage) >= 90 ? 'text-red-600' :
                          Number(limit.usage_percentage) >= 75 ? 'text-yellow-600' :
                            'text-green-600'
                        }`}>
                        {limit.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {quotaSummary.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500">No quota data available</p>
          </div>
        )}
      </div>

      {/* Edit Limit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Update Quota Limit"
      >
        {editingLimit && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Limit Type</p>
              <p className="font-medium">{editingLimit.limit.description || editingLimit.limit.key}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Usage</p>
              <p className="font-medium">{editingLimit.limit.current_value}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Allowed
              </label>
              <input
                type="number"
                value={newMaxValue}
                onChange={(e) => setNewMaxValue(e.target.value)}
                className="input"
                min="1"
                required
              />
            </div>
            <div className="flex space-x-3">
              <button onClick={handleUpdateLimit} className="btn btn-primary flex-1">
                Update Limit
              </button>
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
