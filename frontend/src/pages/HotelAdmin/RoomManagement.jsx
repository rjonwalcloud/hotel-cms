import { useState, useEffect } from 'react';
import { roomAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Edit2, Trash2 } from 'lucide-react';

export default function RoomManagement() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    room_number: '',
    floor: '',
    room_type_id: '',
    base_price: '',
  });
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const confirmAction = (title, message, onConfirm) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };

  useEffect(() => {
    if (hotelId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [hotelId]);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [roomsData, typesData] = await Promise.all([
        roomAPI.getByHotel(hotelId),
        roomAPI.getTypes(hotelId)
      ]);
      setRooms(roomsData.rooms || []);
      setRoomTypes(typesData.roomTypes || []);
    } catch (error) {
      toast.error(t('common.error_loading') || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRooms = async () => {
    try {
      const data = await roomAPI.getByHotel(hotelId);
      setRooms(data.rooms || []);
    } catch (error) {
      toast.error('Failed to load rooms');
    }
  };

  const handleSyncInventory = async () => {
    try {
      setSyncing(true);
      await roomAPI.syncInventory(hotelId, 365);
      toast.success(t('rooms.sync_success'));
    } catch (error) {
      toast.error(error.message || 'Failed to sync inventory');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await roomAPI.update(editingRoom.id, {
          ...formData,
          hotel_id: hotelId,
          floor: formData.floor ? parseInt(formData.floor, 10) : null
        });
        toast.success('Room updated!');
      } else {
        await roomAPI.create({
          ...formData,
          hotel_id: hotelId,
          floor: formData.floor ? parseInt(formData.floor, 10) : null
        });
        toast.success('Room created!');
      }
      setShowModal(false);
      setEditingRoom(null);
      loadRooms();
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    }
  };

  const handleStatusChange = async (room, newStatus) => {
    try {
      await roomAPI.updateStatus(room.id, newStatus, hotelId);
      toast.success(t('common.update_success') || 'Room status updated');
      loadRooms();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (room) => {
    confirmAction(t('rooms.delete_title'), t('rooms.delete_confirm', { number: room.room_number }), async () => {
      try {
        await roomAPI.delete(room.id, hotelId);
        toast.success('Room deleted');
        loadRooms();
      } catch (error) {
        toast.error('Failed to delete room');
      }
    });
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number || '',
      floor: room.floor !== null && room.floor !== undefined ? room.floor.toString() : '',
      room_type_id: room.room_type_id || '',
      base_price: room.base_price ? room.base_price.toString() : '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ room_number: '', floor: '', room_type_id: '', base_price: '' });
  };

  const statusStyles = {
    AVAILABLE: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400 shadow-[0_4px_0_0_rgba(167,243,208,0.5)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(167,243,208,0.5)]',
    OCCUPIED: 'bg-blue-50 border-blue-200 text-blue-800 hover:border-blue-400 shadow-[0_4px_0_0_rgba(191,219,254,0.5)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(191,219,254,0.5)]',
    MAINTENANCE: 'bg-amber-50 border-amber-200 text-amber-800 hover:border-amber-400 shadow-[0_4px_0_0_rgba(253,230,138,0.5)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(253,230,138,0.5)]',
    BLOCKED: 'bg-rose-50 border-rose-200 text-rose-800 hover:border-rose-400 shadow-[0_4px_0_0_rgba(254,205,211,0.5)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(254,205,211,0.5)]',
  };

  // Group rooms by floor
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = room.floor || 'Unassigned';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {});

  const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return parseInt(a) - parseInt(b);
  });

  sortedFloors.forEach(floor => {
    roomsByFloor[floor].sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
  });

  if (loading) return <div>{t('common.loading')}</div>;
  if (!hotelId) return <div>{t('dashboard.no_hotel')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('rooms.title')}</h1>
          <p className="text-gray-600">{t('rooms.subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || syncing}
            className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center transition-all active:scale-95"
            title={t('rooms.refresh_list')}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('common.refreshing') : t('rooms.refresh_list')}
          </button>
          <button
            onClick={handleSyncInventory}
            disabled={syncing}
            className="btn btn-secondary inline-flex items-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            title={t('common.sync_inventory')}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('common.syncing') : t('common.sync_inventory')}
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingRoom(null);
              setShowModal(true);
            }}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('rooms.add_room')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-sm font-bold">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div> {t('rooms.legend.available')}</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div> {t('rooms.legend.occupied')}</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></div> {t('rooms.legend.maintenance')}</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-rose-100 border border-rose-300"></div> {t('rooms.legend.blocked')}</div>
      </div>

      {/* Grid Layout by Floor */}
      <div className="space-y-8 pb-10">
        {sortedFloors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
            <p className="text-slate-500 font-medium">{t('rooms.no_rooms')}</p>
          </div>
        ) : (
          sortedFloors.map(floor => (
            <div key={floor} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
              <div className="bg-slate-800 px-6 py-3 border-b border-slate-700">
                <h2 className="text-lg font-black text-white uppercase tracking-widest">
                  {floor === 'Unassigned' ? t('rooms.unassigned_floor') : t('rooms.floor_label', { floor })}
                </h2>
              </div>
              <div className="p-8">
                {/* Cinema Screen effect curve at the top of the hall */}
                <div className="w-1/2 mx-auto h-2 bg-gradient-to-b from-slate-200 to-transparent rounded-t-[100%] opacity-50 mb-10"></div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 justify-center items-center">
                  {roomsByFloor[floor].map(room => (
                    <div
                      key={room.id}
                      className={`relative flex flex-col p-3 rounded-xl border-2 transition-all duration-200 group ${statusStyles[room.status]}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-xl tracking-tight">{room.room_number}</span>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 -top-3">
                          <button onClick={() => handleEdit(room)} className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm text-slate-700 hover:text-blue-600 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(room)} className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm text-slate-700 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        {room.room_type_short_code && (
                          <span className="px-1.5 py-0.5 bg-black/5 text-slate-800 rounded shadow-sm text-[10px] font-black uppercase tracking-wider">
                            {room.room_type_short_code}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 line-clamp-1">
                          {room.room_type_name}
                        </span>
                      </div>
                      <div className="text-sm font-black mb-3 flex items-baseline gap-2">
                        {formatCurrency(room.dynamic_price || room.base_price)}
                        {room.dynamic_price && room.dynamic_price !== room.base_price && (
                          <span className="text-xs text-gray-400 font-medium line-through">
                            {formatCurrency(room.base_price)}
                          </span>
                        )}
                      </div>
                      <select
                        value={room.status}
                        onChange={(e) => handleStatusChange(room, e.target.value)}
                        className="mt-auto text-[10px] font-bold uppercase tracking-wider bg-white/60 border-0 rounded-md px-2 py-1.5 w-full outline-none focus:ring-2 focus:ring-black/10 cursor-pointer text-center"
                      >
                        <option value="AVAILABLE">{t('rooms.status.available')}</option>
                        <option value="OCCUPIED">{t('rooms.status.occupied')}</option>
                        <option value="MAINTENANCE">{t('rooms.status.maintenance')}</option>
                        <option value="BLOCKED">{t('rooms.status.blocked')}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingRoom(null);
          resetForm();
        }}
        title={editingRoom ? t('rooms.edit_room') : t('rooms.add_room')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('rooms.room_number')} *
            </label>
            <input
              required
              placeholder="101"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              className="input"
            />
          </div>
 
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('rooms.floor')} *
              </label>
              <input
                required
                type="number"
                placeholder="1"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('rooms.room_type')} *
              </label>
              <select
                required
                value={formData.room_type_id}
                onChange={(e) => setFormData({ ...formData, room_type_id: e.target.value })}
                className="input"
              >
                <option value="">{t('common.select')} {t('rooms.room_type')}</option>
                {roomTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name} (${type.base_price})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex space-x-3">
            <button type="submit" className="btn btn-primary flex-1">
              {editingRoom ? t('common.update') : t('common.add')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingRoom(null);
                resetForm();
              }}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
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
