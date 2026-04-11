import { useState, useEffect } from 'react';
import { qrcodeAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { QrCode, Download, Trash2, Eye, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';

export default function QRCodeManagement() {
  const { getHotelId } = useAuthStore();
  const hotelId = getHotelId();
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (hotelId) {
      loadQRCodes();
    } else {
      setLoading(false);
    }
  }, [hotelId]);

  const loadQRCodes = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await qrcodeAPI.getByHotel(hotelId);
      setQrCodes(data.qrCodes || []);
    } catch (error) {
      toast.error('Failed to load QR codes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBulkGenerate = async () => {
    setGenerating(true);
    try {
      const data = await qrcodeAPI.bulkGenerate({
        hotel_id: hotelId,
        frontend_url: window.location.origin
      });
      toast.success(`${data.count} QR codes generated!`);
      loadQRCodes();
    } catch (error) {
      toast.error(error.message || 'Failed to generate QR codes');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleStatus = async (qrId, currentStatus) => {
    try {
      await qrcodeAPI.toggleStatus(qrId, { is_active: !currentStatus, hotel_id: hotelId });
      toast.success(`QR code ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadQRCodes();
    } catch (error) {
      toast.error('Failed to update QR code status');
    }
  };

  const handleDownload = (qrCode) => {
    const link = document.createElement('a');
    link.href = qrCode.qr_data;
    link.download = `room-${qrCode.room_number}-qr.png`;
    link.click();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 font-medium">Loading QR codes...</p>
    </div>
  );

  if (!hotelId) return <div className="p-8 text-center text-slate-500">No hotel context found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">QR Code Management</h1>
          <p className="text-slate-500 font-medium">Generate codes for room-specific service ordering</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => loadQRCodes(true)}
            disabled={refreshing || generating}
            className="btn bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh List'}
          </button>
          <button
            onClick={handleBulkGenerate}
            disabled={generating}
            className="btn btn-primary px-6 py-3 flex items-center gap-2 shadow-lg shadow-primary-200 transition-all active:scale-95"
          >
            <QrCode className="w-5 h-5" />
            {generating ? 'Generating...' : 'Generate All QR Codes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {qrCodes.length === 0 ? (
          <div className="col-span-full card p-16 text-center border-2 border-dashed border-slate-200 bg-slate-50/50">
            <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No QR codes yet</h3>
            <p className="text-slate-500 max-w-xs mx-auto mb-8">
              Click the button above to automatically generate QR codes for all your rooms.
            </p>
          </div>
        ) : (
          qrCodes.map((qr) => (
            <div key={qr.id} className={`card group hover:shadow-2xl hover:shadow-slate-200 transition-all duration-300 border-slate-100 overflow-hidden ${!qr.is_active ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <div className="p-6 text-center space-y-4">
                <div className="relative inline-block group">
                  <div className="absolute inset-0 bg-primary-600/5 rounded-3xl blur-2xl group-hover:bg-primary-600/10 transition-colors" />
                  <img
                    src={qr.qr_data}
                    alt={`QR for Room ${qr.room_number}`}
                    className="w-40 h-40 mx-auto relative z-10 p-2 bg-white rounded-2xl border border-slate-50 shadow-sm"
                  />
                  {!qr.is_active && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-2xl">
                      <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Inactive</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-900">Room {qr.room_number}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Floor {qr.floor} • {qr.room_type_name || 'Standard'}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${qr.room_status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {qr.room_status}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${qr.is_active ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {qr.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  {qr.scan_count || 0} Total Scans
                </p>
              </div>

              <div className="flex border-t border-slate-50">
                <button
                  onClick={() => setShowPreview(qr)}
                  className="flex-1 p-4 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors border-r border-slate-50"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(qr)}
                  className="flex-1 p-4 text-primary-600 hover:bg-primary-50 flex items-center justify-center transition-colors border-r border-slate-50"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleStatus(qr.id, qr.is_active)}
                  className={`flex-1 p-4 flex items-center justify-center transition-colors ${qr.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                  title={qr.is_active ? 'Deactivate' : 'Activate'}
                >
                  {qr.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QR Preview Modal */}
      <Modal
        isOpen={!!showPreview}
        onClose={() => setShowPreview(null)}
        title={showPreview ? `Room ${showPreview.room_number} Service Access` : ''}
      >
        {showPreview && (
          <div className="text-center space-y-6 py-4">
            <div className="w-64 h-64 mx-auto p-4 bg-white rounded-[2rem] shadow-2xl shadow-slate-200 border border-slate-50">
              <img
                src={showPreview.qr_data}
                alt={`QR Code for Room ${showPreview.room_number}`}
                className="w-full h-full"
              />
            </div>

            <div className="space-y-2">
              <p className="text-2xl font-black text-slate-900 tracking-tight">Suite {showPreview.room_number}</p>
              <p className="text-slate-500 font-medium">Scan this code to access the room's service menu</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl flex flex-col gap-2 text-left">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase">QR Token</span>
                <span className="text-slate-900 font-mono font-bold truncate ml-4">{showPreview.qr_token}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase">Last Scanned</span>
                <span className="text-slate-900 font-bold">
                  {showPreview.last_scanned_at ? new Date(showPreview.last_scanned_at).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleDownload(showPreview)}
              className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all active:scale-[0.98]"
            >
              <Download className="w-5 h-5" />
              Download High Res Image
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
