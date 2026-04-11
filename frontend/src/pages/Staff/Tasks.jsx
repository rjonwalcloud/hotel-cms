import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { taskAPI } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { RefreshCw, Clock, CheckCircle, PlayCircle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
    COMPLETED: 'bg-green-100 text-green-800 border-green-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};

const priorityColors = {
    LOW: 'border-l-gray-300',
    MEDIUM: 'border-l-blue-400',
    HIGH: 'border-l-orange-400',
    URGENT: 'border-l-red-500',
};

const NEXT_STATUS = {
    PENDING: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED',
};

export default function StaffTasks() {
    const { getHotelId } = useAuthStore();
    const hotelId = getHotelId();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [comments, setComments] = useState('');
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        if (hotelId) loadTasks();
    }, [hotelId]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await taskAPI.getMyTasks(hotelId);
            setTasks(data.tasks || []);
        } catch (error) {
            toast.error(error.message || 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const openStatusUpdate = (task) => {
        setSelectedTask(task);
        setComments(task.comments || '');
        setShowStatusModal(true);
    };

    const handleUpdateStatus = async (newStatus) => {
        if (!selectedTask) return;
        try {
            await taskAPI.updateStatus(selectedTask.id, { status: newStatus, comments });
            toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
            setShowStatusModal(false);
            setSelectedTask(null);
            setComments('');
            loadTasks();
        } catch (error) {
            toast.error(error.message || 'Failed to update task');
        }
    };

    const filteredTasks = filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter);

    if (loading) return <div className="flex items-center justify-center h-40"><div className="text-gray-500">Loading tasks...</div></div>;
    if (!hotelId) return <div className="text-center text-gray-500 py-10">No hotel assigned to your account.</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
                    <p className="text-gray-600">Tasks assigned to you</p>
                </div>
                <button onClick={loadTasks} className="btn btn-secondary inline-flex items-center">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-2 overflow-x-auto">
                {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === s
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {s.replace('_', ' ')} ({s === 'ALL' ? tasks.length : tasks.filter((t) => t.status === s).length})
                    </button>
                ))}
            </div>

            {/* Task Cards */}
            {filteredTasks.length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-white rounded-xl border border-gray-200">
                    No tasks found.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`bg-white rounded-xl border border-gray-200 p-5 border-l-4 ${priorityColors[task.priority]} hover:shadow-md transition-shadow`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1 mr-2">{task.title}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[task.status]}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>

                            {task.description && (
                                <p className="text-gray-600 text-xs mb-3 line-clamp-2">{task.description}</p>
                            )}

                            <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                                {task.due_date && (
                                    <div className="flex items-center">
                                        <Clock className="w-3 h-3 mr-1.5" />
                                        Due: {format(new Date(task.due_date), 'MMM dd, yyyy HH:mm')}
                                    </div>
                                )}
                                {task.created_by_name && (
                                    <div className="text-gray-400">Assigned by: {task.created_by_name}</div>
                                )}
                                {task.booking_ref && (
                                    <div className="text-gray-400">Booking: {task.booking_ref}</div>
                                )}
                                {task.comments && (
                                    <div className="flex items-start mt-2 bg-gray-50 rounded-lg p-2">
                                        <MessageSquare className="w-3 h-3 mr-1.5 mt-0.5 text-gray-400 shrink-0" />
                                        <span className="text-gray-600 line-clamp-2">{task.comments}</span>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex space-x-2">
                                {task.status === 'PENDING' && (
                                    <button
                                        onClick={() => openStatusUpdate(task)}
                                        className="flex-1 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center justify-center font-medium"
                                    >
                                        <PlayCircle className="w-3 h-3 mr-1.5" /> Start Task
                                    </button>
                                )}
                                {task.status === 'IN_PROGRESS' && (
                                    <button
                                        onClick={() => openStatusUpdate(task)}
                                        className="flex-1 text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 inline-flex items-center justify-center font-medium"
                                    >
                                        <CheckCircle className="w-3 h-3 mr-1.5" /> Complete Task
                                    </button>
                                )}
                                {(task.status === 'COMPLETED' || task.status === 'CANCELLED') && (
                                    <div className="flex-1 text-xs text-gray-400 text-center py-2 italic">
                                        {task.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
                                        {task.completed_at && ` on ${format(new Date(task.completed_at), 'MMM dd')}`}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Status Update Modal */}
            <Modal
                isOpen={showStatusModal}
                onClose={() => { setShowStatusModal(false); setSelectedTask(null); setComments(''); }}
                title={`Update Task: ${selectedTask?.title || ''}`}
            >
                {selectedTask && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-600 mb-1"><strong>Current Status:</strong> {selectedTask.status.replace('_', ' ')}</div>
                            <div className="text-sm text-gray-600"><strong>Priority:</strong> {selectedTask.priority}</div>
                            {selectedTask.description && (
                                <div className="text-sm text-gray-600 mt-2">{selectedTask.description}</div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Add Comments</label>
                            <textarea
                                rows={3}
                                placeholder="Add your notes or update..."
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                className="input"
                            />
                        </div>

                        <div className="flex space-x-3 pt-4 border-t border-gray-200">
                            {NEXT_STATUS[selectedTask.status] && (
                                <button
                                    onClick={() => handleUpdateStatus(NEXT_STATUS[selectedTask.status])}
                                    className="btn btn-primary flex-1"
                                >
                                    {selectedTask.status === 'PENDING' ? 'Start Task' : 'Mark Complete'}
                                </button>
                            )}
                            {selectedTask.status !== 'COMPLETED' && selectedTask.status !== 'CANCELLED' && (
                                <button
                                    onClick={() => handleUpdateStatus('CANCELLED')}
                                    className="btn bg-red-600 text-white hover:bg-red-700"
                                >
                                    Cancel Task
                                </button>
                            )}
                            <button
                                onClick={() => { setShowStatusModal(false); setSelectedTask(null); setComments(''); }}
                                className="btn btn-secondary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
