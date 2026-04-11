import { useState, useEffect } from 'react';
import { bookingManagerAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import StatsCard from '../../components/StatsCard';
import toast from 'react-hot-toast';
import { Globe, Plus, TrendingUp, DollarSign, BarChart3, RefreshCw } from 'lucide-react';

const CHANNEL_TYPES = [
  { value: 'OYO', label: 'OYO' },
  { value: 'BOOKING_COM', label: 'Booking.com' },
  { value: 'MAKEMYTRIP', label: 'MakeMyTrip' },
  { value: 'GOIBIBO', label: 'Goibibo' },
  { value: 'AGODA', label: 'Agoda' },
  { value: 'EXPEDIA', label: 'Expedia' },
  { value: 'AIRBNB', label: 'Airbnb' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'OTHER', label: 'Other' },
];

export default function BookingManager() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();
  const [channels, setChannels] = useState([]);
  const [channelBookings, setChannelBookings] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('channels');
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelForm, setChannelForm] = useState({
    name: '', channel_type: '', api_key: '', api_secret: '',
    property_id: '', commission_rate: '0'
  });
  const [bookingForm, setBookingForm] = useState({
    channel_id: '', external_booking_id: '', channel_type: '',
    guest_name: '', guest_email: '', guest_phone: '',
    check_in_date: '', check_out_date: '', room_count: '1',
    total_amount: '', commission_amount: '0'
  });

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const confirmAction = (title, message, onConfirm) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };

  useEffect(() => {
    if (hotelId) loadData();
  }, [hotelId]);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [channelsData, bookingsData, statsData] = await Promise.all([
        bookingManagerAPI.getChannels(hotelId),
        bookingManagerAPI.getChannelBookings(hotelId),
        bookingManagerAPI.getStats(hotelId),
      ]);
      setChannels(channelsData.channels || []);
      setChannelBookings(bookingsData.bookings || []);
      setStats(statsData.stats || []);
    } catch (error) {
      toast.error(t('booking_manager.messages.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleChannelSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...channelForm, hotel_id: hotelId, commission_rate: parseFloat(channelForm.commission_rate) };
      if (editingChannel) {
        await bookingManagerAPI.updateChannel(editingChannel.id, data);
        toast.success(t('booking_manager.messages.channel_updated'));
      } else {
        await bookingManagerAPI.createChannel(data);
        toast.success(t('booking_manager.messages.channel_created'));
      }
      setShowChannelModal(false);
      setEditingChannel(null);
      resetChannelForm();
      loadData();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    try {
      const channel = channels.find(c => c.id === bookingForm.channel_id);
      const data = {
        ...bookingForm,
        hotel_id: hotelId,
        channel_type: channel?.channel_type || bookingForm.channel_type,
        room_count: parseInt(bookingForm.room_count),
        total_amount: parseFloat(bookingForm.total_amount),
        commission_amount: parseFloat(bookingForm.commission_amount || 0),
      };
      await bookingManagerAPI.createChannelBooking(data);
      toast.success(t('booking_manager.messages.booking_added'));
      setShowBookingModal(false);
      resetBookingForm();
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to add booking');
    }
  };

  const handleToggleChannel = async (channel) => {
    try {
      await bookingManagerAPI.toggleChannelStatus(channel.id, {
        is_active: !channel.is_active, hotel_id: hotelId
      });
      toast.success(`Channel ${channel.is_active ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update channel');
    }
  };

  const handleDeleteChannel = async (channelId) => {
    confirmAction('Delete Channel', 'Delete this channel?', async () => {
      try {
        await bookingManagerAPI.deleteChannel(channelId, hotelId);
        toast.success('Channel deleted');
        loadData();
      } catch (error) {
        toast.error(error.message || 'Failed to delete channel');
      }
    });
  };

  const handleBookingStatusChange = async (bookingId, status) => {
    try {
      await bookingManagerAPI.updateChannelBookingStatus(bookingId, {
        status, hotel_id: hotelId
      });
      toast.success(t('booking_manager.messages.status_updated'));
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setChannelForm({
      name: channel.name,
      channel_type: channel.channel_type,
      api_key: channel.api_key || '',
      api_secret: channel.api_secret || '',
      property_id: channel.property_id || '',
      commission_rate: channel.commission_rate?.toString() || '0',
    });
    setShowChannelModal(true);
  };

  const resetChannelForm = () => {
    setChannelForm({ name: '', channel_type: '', api_key: '', api_secret: '', property_id: '', commission_rate: '0' });
  };

  const resetBookingForm = () => {
    setBookingForm({
      channel_id: '', external_booking_id: '', channel_type: '',
      guest_name: '', guest_email: '', guest_phone: '',
      check_in_date: '', check_out_date: '', room_count: '1',
      total_amount: '', commission_amount: '0'
    });
  };

  const totalRevenue = stats.reduce((sum, s) => sum + parseFloat(s.total_revenue || 0), 0);
  const totalCommission = stats.reduce((sum, s) => sum + parseFloat(s.total_commission || 0), 0);
  const totalBookingsCount = stats.reduce((sum, s) => sum + parseInt(s.total_bookings || 0), 0);

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    NO_SHOW: 'bg-gray-100 text-gray-800',
  };

  const channelTypeLabel = (type) => CHANNEL_TYPES.find(c => c.value === type)?.label || type;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">{t('common.loading')}</div></div>;
  if (!hotelId) return <div>{t('common.no_hotel')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('booking_manager.title')}</h1>
          <p className="text-gray-600">{t('booking_manager.subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center transition-all active:scale-95"
            title={t('booking_manager.refresh')}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('common.refreshing') : t('booking_manager.refresh')}
          </button>
          <button
            onClick={() => { resetChannelForm(); setEditingChannel(null); setShowChannelModal(true); }}
            className="btn btn-secondary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('booking_manager.add_channel')}
          </button>
          <button
            onClick={() => { resetBookingForm(); setShowBookingModal(true); }}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('booking_manager.add_booking')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard title={t('booking_manager.stats.active_channels')} value={channels.filter(c => c.is_active).length} icon={Globe} color="primary" />
        <StatsCard title={t('booking_manager.stats.total_bookings')} value={totalBookingsCount} icon={BarChart3} color="blue" />
        <StatsCard title={t('booking_manager.stats.total_revenue')} value={formatCurrency(totalRevenue)} icon={TrendingUp} color="green" />
        <StatsCard title={t('booking_manager.stats.commission_paid')} value={formatCurrency(totalCommission)} icon={DollarSign} color="yellow" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {['channels', 'bookings', 'analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {t(`booking_manager.tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
              <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('booking_manager.channels.no_channels')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('booking_manager.channels.no_channels_help')}</p>
            </div>
          ) : (
            channels.map((channel) => (
              <div key={channel.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel.is_active ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                      <Globe className={`w-5 h-5 ${channel.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{channel.name}</h3>
                      <p className="text-xs text-gray-500">{channelTypeLabel(channel.channel_type)}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${channel.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                    {channel.is_active ? t('booking_manager.channels.active') : t('booking_manager.channels.inactive')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div><span className="text-gray-500">{t('booking_manager.channels.bookings')}:</span> <span className="font-medium">{channel.total_bookings || 0}</span></div>
                  <div><span className="text-gray-500">{t('booking_manager.channels.revenue')}:</span> <span className="font-medium">{formatCurrency(channel.total_revenue || 0)}</span></div>
                  <div><span className="text-gray-500">{t('booking_manager.channels.commission')}:</span> <span className="font-medium">{channel.commission_rate}%</span></div>
                  <div><span className="text-gray-500">{t('booking_manager.channels.active')}:</span> <span className="font-medium">{channel.active_bookings || 0}</span></div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEditChannel(channel)} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">{t('booking_manager.channels.edit')}</button>
                  <button onClick={() => handleToggleChannel(channel)} className={`text-xs px-3 py-1.5 rounded ${channel.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}>
                    {channel.is_active ? t('booking_manager.channels.disable') : t('booking_manager.channels.enable')}
                  </button>
                  <button onClick={() => handleDeleteChannel(channel.id)} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200">{t('booking_manager.channels.delete')}</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {channelBookings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No channel bookings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.channel')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.ext_id')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.guest')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.checkin')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.checkout')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.amount')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {channelBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium">{booking.channel_name}</div>
                        <div className="text-xs text-gray-500">{channelTypeLabel(booking.channel_type)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.external_booking_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>{booking.guest_name}</div>
                        <div className="text-xs text-gray-500">{booking.guest_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(booking.check_in_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(booking.check_out_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{formatCurrency(booking.total_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={booking.status}
                          onChange={(e) => handleBookingStatusChange(booking.id, e.target.value)}
                          className={`text-xs border rounded px-2 py-1 ${statusColors[booking.status] || ''}`}
                        >
                          <option value="PENDING">{t('booking_manager.bookings.status.pending')}</option>
                          <option value="CONFIRMED">{t('booking_manager.bookings.status.confirmed')}</option>
                          <option value="COMPLETED">{t('booking_manager.bookings.status.completed')}</option>
                          <option value="CANCELLED">{t('booking_manager.bookings.status.cancelled')}</option>
                          <option value="NO_SHOW">{t('booking_manager.bookings.status.noshow')}</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="text-xs text-gray-500">
                          {t('booking_manager.bookings.table.commission')}: {formatCurrency(booking.commission_amount || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{t('booking_manager.analytics.title')}</h2>
          {stats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.bookings.table.channel')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.analytics.table.total')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.analytics.table.confirmed')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.analytics.table.completed')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.analytics.table.cancelled')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.channels.revenue')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('booking_manager.channels.commission')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.map((stat, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {stat.channel_name}
                        <span className="text-xs text-gray-500 ml-2">({channelTypeLabel(stat.channel_type)})</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.total_bookings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{stat.confirmed_bookings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{stat.completed_bookings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{stat.cancelled_bookings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{formatCurrency(stat.total_revenue)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{formatCurrency(stat.total_commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Channel Modal */}
      <Modal
        isOpen={showChannelModal}
        onClose={() => { setShowChannelModal(false); setEditingChannel(null); resetChannelForm(); }}
        title={editingChannel ? t('booking_manager.channels.edit_title') : t('booking_manager.channels.add_title')}
      >
        <form onSubmit={handleChannelSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.channels.form.name')} *</label>
              <input required value={channelForm.name} onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })} className="input" placeholder="My OYO Channel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.channels.form.type')} *</label>
              <select
                required
                value={channelForm.channel_type}
                onChange={(e) => setChannelForm({ ...channelForm, channel_type: e.target.value })}
                className="input"
                disabled={!!editingChannel}
              >
                <option value="">{t('booking_manager.channels.form.select_type')}</option>
                {CHANNEL_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.channels.form.api_key')}</label>
              <input type="password" value={channelForm.api_key} onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.channels.form.api_secret')}</label>
              <input type="password" value={channelForm.api_secret} onChange={(e) => setChannelForm({ ...channelForm, api_secret: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.channels.form.property_id')}</label>
              <input value={channelForm.property_id} onChange={(e) => setChannelForm({ ...channelForm, property_id: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.channels.form.commission_rate')}</label>
              <input type="number" step="0.01" value={channelForm.commission_rate} onChange={(e) => setChannelForm({ ...channelForm, commission_rate: e.target.value })} className="input" />
            </div>
          </div>
          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">{editingChannel ? t('common.update') : t('common.add')} {t('booking_manager.tabs.channels')}</button>
            <button type="button" onClick={() => { setShowChannelModal(false); setEditingChannel(null); resetChannelForm(); }} className="btn btn-secondary">{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      {/* Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => { setShowBookingModal(false); resetBookingForm(); }}
        title={t('booking_manager.bookings.add_title')}
        size="lg"
      >
        <form onSubmit={handleBookingSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.table.channel')} *</label>
              <select
                required
                value={bookingForm.channel_id}
                onChange={(e) => setBookingForm({ ...bookingForm, channel_id: e.target.value })}
                className="input"
              >
                <option value="">{t('booking_manager.bookings.form.select_channel')}</option>
                {channels.filter(c => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({channelTypeLabel(c.channel_type)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.external_id')} *</label>
              <input required value={bookingForm.external_booking_id} onChange={(e) => setBookingForm({ ...bookingForm, external_booking_id: e.target.value })} className="input" placeholder="OYO-12345" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.guest_name')} *</label>
              <input required value={bookingForm.guest_name} onChange={(e) => setBookingForm({ ...bookingForm, guest_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.guest_email')}</label>
              <input type="email" value={bookingForm.guest_email} onChange={(e) => setBookingForm({ ...bookingForm, guest_email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.guest_phone')}</label>
              <input value={bookingForm.guest_phone} onChange={(e) => setBookingForm({ ...bookingForm, guest_phone: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.table.checkin')} *</label>
              <input required type="date" value={bookingForm.check_in_date} onChange={(e) => setBookingForm({ ...bookingForm, check_in_date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.table.checkout')} *</label>
              <input required type="date" value={bookingForm.check_out_date} onChange={(e) => setBookingForm({ ...bookingForm, check_out_date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.rooms')}</label>
              <input type="number" min="1" value={bookingForm.room_count} onChange={(e) => setBookingForm({ ...bookingForm, room_count: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.total_amount')} *</label>
              <input required type="number" step="0.01" value={bookingForm.total_amount} onChange={(e) => setBookingForm({ ...bookingForm, total_amount: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_manager.bookings.form.commission_amount')}</label>
              <input type="number" step="0.01" value={bookingForm.commission_amount} onChange={(e) => setBookingForm({ ...bookingForm, commission_amount: e.target.value })} className="input" />
            </div>
          </div>
          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">{t('common.add')} {t('booking_manager.tabs.bookings')}</button>
            <button type="button" onClick={() => { setShowBookingModal(false); resetBookingForm(); }} className="btn btn-secondary">{t('common.cancel')}</button>
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
