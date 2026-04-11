import { useState, useEffect } from 'react';
import { subscriptionAPI, hotelAPI } from '../../services/api';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import StatsCard from '../../components/StatsCard';
import toast from 'react-hot-toast';
import { CreditCard, Plus, CheckCircle, AlertCircle, XCircle, RefreshCw } from 'lucide-react';

export default function SubscriptionManagement() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '', description: '', price: '', duration_days: '30',
    max_hotels: '1', max_rooms_per_hotel: '50',
    max_bookings_per_month: '100', max_staff_per_hotel: '20', features: ''
  });
  const [activateForm, setActivateForm] = useState({ hotel_id: '', plan_id: '', auto_renew: false });

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const confirmAction = (title, message, onConfirm) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansData, subsData, hotelsData] = await Promise.all([
        subscriptionAPI.getPlans({ include_inactive: 'true' }),
        subscriptionAPI.getAll(),
        hotelAPI.getAll(),
      ]);
      setPlans(plansData.plans || []);
      setSubscriptions(subsData.subscriptions || []);
      setHotels(hotelsData.hotels || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...planForm,
        price: parseFloat(planForm.price),
        duration_days: parseInt(planForm.duration_days),
        max_hotels: parseInt(planForm.max_hotels),
        max_rooms_per_hotel: parseInt(planForm.max_rooms_per_hotel),
        max_bookings_per_month: parseInt(planForm.max_bookings_per_month),
        max_staff_per_hotel: parseInt(planForm.max_staff_per_hotel),
        features: planForm.features ? planForm.features.split(',').map(f => f.trim()) : [],
      };

      if (editingPlan) {
        await subscriptionAPI.updatePlan(editingPlan.id, data);
        toast.success('Plan updated');
      } else {
        await subscriptionAPI.createPlan(data);
        toast.success('Plan created');
      }

      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanForm();
      loadData();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    try {
      await subscriptionAPI.activate(activateForm);
      toast.success('Subscription activated');
      setShowActivateModal(false);
      setActivateForm({ hotel_id: '', plan_id: '', auto_renew: false });
      loadData();
    } catch (error) {
      toast.error(error.message || 'Activation failed');
    }
  };

  const handleRenew = async (subscriptionId) => {
    try {
      await subscriptionAPI.renew(subscriptionId);
      toast.success('Subscription renewed');
      loadData();
    } catch (error) {
      toast.error('Renewal failed');
    }
  };

  const handleCancel = async (subscriptionId) => {
    confirmAction('Cancel Subscription', 'Cancel this subscription?', async () => {
      try {
        await subscriptionAPI.cancel(subscriptionId, 'Cancelled by admin');
        toast.success('Subscription cancelled');
        loadData();
      } catch (error) {
        toast.error('Cancellation failed');
      }
    });
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      price: plan.price.toString(),
      duration_days: plan.duration_days.toString(),
      max_hotels: plan.max_hotels.toString(),
      max_rooms_per_hotel: plan.max_rooms_per_hotel.toString(),
      max_bookings_per_month: plan.max_bookings_per_month.toString(),
      max_staff_per_hotel: plan.max_staff_per_hotel.toString(),
      features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
    });
    setShowPlanModal(true);
  };

  const resetPlanForm = () => {
    setPlanForm({
      name: '', description: '', price: '', duration_days: '30',
      max_hotels: '1', max_rooms_per_hotel: '50',
      max_bookings_per_month: '100', max_staff_per_hotel: '20', features: ''
    });
  };

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    SUSPENDED: 'bg-yellow-100 text-yellow-800',
    PENDING: 'bg-blue-100 text-blue-800',
  };

  const activeCount = subscriptions.filter(s => s.status === 'ACTIVE').length;
  const expiredCount = subscriptions.filter(s => s.status === 'EXPIRED').length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Subscription Management</h1>
          <p className="text-gray-600">Manage plans and hotel subscriptions</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => { resetPlanForm(); setEditingPlan(null); setShowPlanModal(true); }}
            className="btn btn-secondary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Plan
          </button>
          <button
            onClick={() => setShowActivateModal(true)}
            className="btn btn-primary inline-flex items-center"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Activate Subscription
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard title="Total Plans" value={plans.length} icon={CreditCard} color="primary" />
        <StatsCard title="Active Subscriptions" value={activeCount} icon={CheckCircle} color="green" />
        <StatsCard title="Expired" value={expiredCount} icon={AlertCircle} color="red" />
        <StatsCard title="Total Hotels" value={hotels.length} icon={CheckCircle} color="blue" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'subscriptions' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Subscriptions ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'plans' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Plans ({plans.length})
          </button>
        </nav>
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {subscriptions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No subscriptions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hotel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{sub.hotel_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{sub.plan_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${sub.plan_price}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[sub.status]}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(sub.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(sub.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          {(sub.status === 'ACTIVE' || sub.status === 'EXPIRED') && (
                            <button
                              onClick={() => handleRenew(sub.id)}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 inline-flex items-center"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Renew
                            </button>
                          )}
                          {sub.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleCancel(sub.id)}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 inline-flex items-center"
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className={`bg-white rounded-lg shadow-sm border-2 p-6 ${plan.name === 'Professional' ? 'border-primary-500' : 'border-gray-200'
              }`}>
              {plan.name === 'Professional' && (
                <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-full mb-3 inline-block">
                  Popular
                </span>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-gray-500">/{plan.duration_days} days</span>
              </div>
              <ul className="mt-4 space-y-2">
                <li className="text-sm text-gray-600">Up to {plan.max_hotels} hotel(s)</li>
                <li className="text-sm text-gray-600">Up to {plan.max_rooms_per_hotel} rooms/hotel</li>
                <li className="text-sm text-gray-600">Up to {plan.max_bookings_per_month} bookings/month</li>
                <li className="text-sm text-gray-600">Up to {plan.max_staff_per_hotel} staff/hotel</li>
                {Array.isArray(plan.features) && plan.features.map((f, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleEditPlan(plan)}
                className="mt-4 w-full btn btn-secondary text-sm"
              >
                Edit Plan
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Plan Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => { setShowPlanModal(false); setEditingPlan(null); resetPlanForm(); }}
        title={editingPlan ? 'Edit Plan' : 'Create Plan'}
      >
        <form onSubmit={handlePlanSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
              <input required type="number" step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} className="input" rows="2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <input type="number" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Hotels</label>
              <input type="number" value={planForm.max_hotels} onChange={(e) => setPlanForm({ ...planForm, max_hotels: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Rooms/Hotel</label>
              <input type="number" value={planForm.max_rooms_per_hotel} onChange={(e) => setPlanForm({ ...planForm, max_rooms_per_hotel: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings/Mo</label>
              <input type="number" value={planForm.max_bookings_per_month} onChange={(e) => setPlanForm({ ...planForm, max_bookings_per_month: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Staff/Hotel</label>
              <input type="number" value={planForm.max_staff_per_hotel} onChange={(e) => setPlanForm({ ...planForm, max_staff_per_hotel: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
            <input value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} className="input" placeholder="Feature 1, Feature 2, Feature 3" />
          </div>
          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">{editingPlan ? 'Update' : 'Create'} Plan</button>
            <button type="button" onClick={() => { setShowPlanModal(false); setEditingPlan(null); resetPlanForm(); }} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Activate Modal */}
      <Modal
        isOpen={showActivateModal}
        onClose={() => setShowActivateModal(false)}
        title="Activate Subscription"
      >
        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotel *</label>
            <select
              required
              value={activateForm.hotel_id}
              onChange={(e) => setActivateForm({ ...activateForm, hotel_id: e.target.value })}
              className="input"
            >
              <option value="">Select Hotel</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
            <select
              required
              value={activateForm.plan_id}
              onChange={(e) => setActivateForm({ ...activateForm, plan_id: e.target.value })}
              className="input"
            >
              <option value="">Select Plan</option>
              {plans.filter(p => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>{p.name} - ${p.price}/{p.duration_days}d</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto_renew"
              checked={activateForm.auto_renew}
              onChange={(e) => setActivateForm({ ...activateForm, auto_renew: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="auto_renew" className="text-sm text-gray-700">Auto-renew subscription</label>
          </div>
          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">Activate</button>
            <button type="button" onClick={() => setShowActivateModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
