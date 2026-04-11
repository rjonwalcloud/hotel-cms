import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { taskAPI, settingsAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import {
    Plus, ClipboardList, RefreshCw, User, Calendar, AlertTriangle, Eye, Clock,
    Zap, Trash2, Edit3, ToggleLeft, ToggleRight, Hotel, ShoppingBag, UtensilsCrossed, BellRing,
    Filter, Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const priorityColors = {
    LOW: 'bg-gray-100 text-gray-800',
    MEDIUM: 'bg-blue-100 text-blue-800',
    HIGH: 'bg-orange-100 text-orange-800',
    URGENT: 'bg-red-100 text-red-800',
};

const EVENT_TYPES = [
    { value: 'BOOKING_CREATED', label: 'New Booking Created', icon: Hotel, group: 'Booking' },
    { value: 'BOOKING_CHECKIN', label: 'Guest Check-in', icon: Hotel, group: 'Booking' },
    { value: 'BOOKING_CHECKOUT', label: 'Guest Check-out', icon: Hotel, group: 'Booking' },
    { value: 'SR_CREATED', label: 'Service Request Created', icon: BellRing, group: 'Service Request' },
    { value: 'SR_COMPLETED', label: 'Service Request Completed', icon: BellRing, group: 'Service Request' },
];

const SR_FILTERS = [
    { value: '', label: 'All Types' },
    { value: 'SERVICE', label: 'Room Service / QR' },
    { value: 'POS', label: 'POS / Restaurant' },
];

const PLACEHOLDERS = [
    { tag: '{guest_name}', desc: 'Guest name' },
    { tag: '{room_number}', desc: 'Room number' },
    { tag: '{booking_ref}', desc: 'Booking reference' },
    { tag: '{service_name}', desc: 'Service item name' },
    { tag: '{service_category}', desc: 'Service category' },
];

export default function TaskManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const hotelId = getHotelId();

    // Data
    const [tasks, setTasks] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoRules, setAutoRules] = useState([]);
    const [autoLoading, setAutoLoading] = useState(false);

    // Settings
    const [automationEnabled, setAutomationEnabled] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // UI state
    const [managerTab, setManagerTab] = useState('manual'); // 'manual' | 'auto'
    const [showModal, setShowModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [taskDetails, setTaskDetails] = useState(null);
    const [taskHistory, setTaskHistory] = useState([]);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, id: null, type: 'task' });
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        status: '', priority: '', source: '', search: ''
    });

    // Forms
    const [formData, setFormData] = useState({
        title: '', description: '', assigned_to: '', priority: 'MEDIUM', status: 'PENDING', due_date: '',
    });
    const [ruleForm, setRuleForm] = useState({
        event_type: 'BOOKING_CHECKIN', event_filter: '', title: '', description: '',
        priority: 'MEDIUM', assign_to: '', is_active: true,
    });

    useEffect(() => {
        if (hotelId) {
            loadTasks();
            loadStaff();
            loadSettings();
            loadAutoRules();
        }
    }, [hotelId]);

    const loadSettings = async () => {
        try {
            const data = await settingsAPI.getSettings(hotelId);
            if (data) setAutomationEnabled(data.task_automation_enabled !== false);
        } catch (error) {
            console.error('Failed to load task automation settings:', error);
        }
    };

    const handleToggleAutomation = async () => {
        const newValue = !automationEnabled;
        setLoadingSettings(true);
        try {
            await settingsAPI.updateSettings({ task_automation_enabled: newValue }, hotelId);
            setAutomationEnabled(newValue);
            toast.success(newValue ? 'Automation enabled' : 'Automation disabled');
        } catch (error) {
            toast.error(t('common.error'));
        } finally {
            setLoadingSettings(false);
        }
    };

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await taskAPI.getByHotel(hotelId);
            setTasks(data.tasks || []);
        } catch (error) {
            toast.error(error.message || t('tasks.messages.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const loadStaff = async () => {
        try {
            const data = await taskAPI.getStaff(hotelId);
            setStaffMembers(data.staff || []);
        } catch (error) {
            console.error('Failed to load staff:', error);
        }
    };

    const loadAutoRules = async () => {
        setAutoLoading(true);
        try {
            const data = await taskAPI.getAutoRules(hotelId);
            setAutoRules(data.rules || []);
        } catch (error) {
            console.error('Failed to load auto rules:', error);
        } finally {
            setAutoLoading(false);
        }
    };

    // ============================================
    // MANUAL TASK HANDLERS
    // ============================================

    const resetForm = () => {
        setFormData({ title: '', description: '', assigned_to: '', priority: 'MEDIUM', status: 'PENDING', due_date: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData, hotel_id: hotelId,
                assigned_to: formData.assigned_to || null, due_date: formData.due_date || null,
            };
            if (editingTask) {
                await taskAPI.update(editingTask.id, payload);
                toast.success(t('tasks.messages.update_success'));
            } else {
                await taskAPI.create(payload);
                toast.success(t('tasks.messages.create_success'));
            }
            setShowModal(false); setEditingTask(null); resetForm(); loadTasks();
        } catch (error) {
            toast.error(error.message || t('common.error'));
        }
    };

    const handleEdit = (task) => {
        setEditingTask(task);
        setFormData({
            title: task.title, description: task.description || '', assigned_to: task.assigned_to || '',
            priority: task.priority, status: task.status,
            due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : '',
        });
        setShowModal(true);
    };

    const handleViewDetails = async (task) => {
        try {
            const data = await taskAPI.getDetails(task.id);
            setTaskDetails(data.task); setTaskHistory(data.history || []); setShowDetailsModal(true);
        } catch (error) {
            toast.error(t('tasks.messages.details_error'));
        }
    };

    const handleDelete = (task) => {
        setConfirmConfig({ isOpen: true, id: task.id, type: 'task' });
    };

    const confirmDelete = async () => {
        try {
            if (confirmConfig.type === 'rule') {
                await taskAPI.deleteAutoRule(confirmConfig.id);
                toast.success('Rule deleted');
                loadAutoRules();
            } else {
                await taskAPI.delete(confirmConfig.id);
                toast.success(t('tasks.messages.delete_success'));
                loadTasks();
            }
        } catch (error) {
            toast.error(error.message || 'Failed to delete');
        } finally {
            setConfirmConfig({ isOpen: false, id: null, type: 'task' });
        }
    };

    // ============================================
    // AUTO-RULE HANDLERS
    // ============================================

    const resetRuleForm = () => {
        setRuleForm({
            event_type: 'BOOKING_CHECKIN', event_filter: '', title: '', description: '',
            priority: 'MEDIUM', assign_to: '', is_active: true,
        });
    };

    const handleRuleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...ruleForm, hotel_id: hotelId, assign_to: ruleForm.assign_to || null };
            if (editingRule) {
                await taskAPI.updateAutoRule(editingRule.id, payload);
                toast.success('Rule updated');
            } else {
                await taskAPI.createAutoRule(payload);
                toast.success('Auto-task rule created');
            }
            setShowRuleModal(false); setEditingRule(null); resetRuleForm(); loadAutoRules();
        } catch (error) {
            toast.error(error.message || 'Failed to save rule');
        }
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setRuleForm({
            event_type: rule.event_type, event_filter: rule.event_filter || '',
            title: rule.title, description: rule.description || '',
            priority: rule.priority, assign_to: rule.assign_to || '', is_active: rule.is_active,
        });
        setShowRuleModal(true);
    };

    const handleToggleRule = async (rule) => {
        try {
            await taskAPI.toggleAutoRule(rule.id);
            loadAutoRules();
        } catch (error) {
            toast.error('Failed to toggle rule');
        }
    };

    const handleDeleteRule = (rule) => {
        setConfirmConfig({ isOpen: true, id: rule.id, type: 'rule' });
    };

    const isSREvent = ruleForm.event_type.startsWith('SR_');
    const getEventLabel = (eventType) => EVENT_TYPES.find(e => e.value === eventType)?.label || eventType;
    const getEventIcon = (eventType) => EVENT_TYPES.find(e => e.value === eventType)?.icon || BellRing;

    // ============================================
    // FILTERED TASKS
    // ============================================

    const filteredTasks = tasks.filter(task => {
        if (filters.status && task.status !== filters.status) return false;
        if (filters.priority && task.priority !== filters.priority) return false;
        if (filters.source === 'MANUAL' && task.source === 'AUTO') return false;
        if (filters.source === 'AUTO' && task.source !== 'AUTO') return false;
        if (filters.search) {
            const s = filters.search.toLowerCase();
            return (task.title || '').toLowerCase().includes(s) ||
                (task.assigned_to_name || '').toLowerCase().includes(s) ||
                (task.booking_ref || '').toLowerCase().includes(s);
        }
        return true;
    });

    // Stats
    const taskStats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'PENDING').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        auto: tasks.filter(t => t.source === 'AUTO').length,
        manual: tasks.filter(t => t.source !== 'AUTO').length,
    };

    // ============================================
    // TABLE COLUMNS
    // ============================================

    const columns = [
        {
            key: 'source', label: 'Type',
            render: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v === 'AUTO' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                    {v === 'AUTO' ? 'Auto' : 'Manual'}
                </span>
            ),
        },
        { key: 'title', label: t('tasks.table.title'), render: (v) => <span className="font-medium text-slate-900">{v}</span> },
        {
            key: 'assigned_to_name', label: t('tasks.table.assigned_to'),
            render: (v) => v || <span className="text-gray-400 italic text-xs">Unassigned</span>,
        },
        {
            key: 'priority', label: t('tasks.table.priority'),
            render: (v) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${priorityColors[v]}`}>{v}</span>,
        },
        {
            key: 'status', label: t('tasks.table.status'),
            render: (v) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[v]}`}>{v.replace('_', ' ')}</span>,
        },
        {
            key: 'created_at', label: 'Created',
            render: (v) => v ? <span className="text-xs text-slate-500">{format(new Date(v), 'MMM dd, HH:mm')}</span> : '-',
        },
        {
            key: 'actions_custom', label: '',
            render: (_, task) => (
                <button onClick={() => handleViewDetails(task)}
                    className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-200 inline-flex items-center font-medium">
                    <Eye className="w-3 h-3 mr-1" /> View
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* ============================================ */}
            {/* HEADER */}
            {/* ============================================ */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('tasks.title')}</h1>
                    <p className="text-gray-500 text-sm">{t('tasks.subtitle')}</p>
                </div>
                <button onClick={loadTasks} className="btn btn-secondary inline-flex items-center text-sm">
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
                </button>
            </div>

            {/* ============================================ */}
            {/* TOP SECTION: TASK MANAGEMENT */}
            {/* ============================================ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {/* Manager tabs header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl">
                        <button onClick={() => setManagerTab('manual')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all ${managerTab === 'manual' ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
                            <ClipboardList className="w-3.5 h-3.5" /> Manual Tasks
                        </button>
                        <button onClick={() => setManagerTab('auto')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all ${managerTab === 'auto' ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Zap className="w-3.5 h-3.5" /> Auto Tasks
                            {autoRules.filter(r => r.is_active).length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                                    {autoRules.filter(r => r.is_active).length}
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Global Automation Toggle */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Auto-create</span>
                            <button onClick={handleToggleAutomation} disabled={loadingSettings}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${automationEnabled ? 'bg-emerald-500' : 'bg-slate-300'} ${loadingSettings ? 'opacity-50' : ''}`}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${automationEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
                        </div>
                        {managerTab === 'manual' && (
                            <button onClick={() => { setEditingTask(null); resetForm(); setShowModal(true); }}
                                className="btn btn-primary inline-flex items-center text-sm">
                                <Plus className="w-4 h-4 mr-1" /> New Task
                            </button>
                        )}
                        {managerTab === 'auto' && (
                            <button onClick={() => { setEditingRule(null); resetRuleForm(); setShowRuleModal(true); }}
                                className="btn btn-primary inline-flex items-center text-sm">
                                <Plus className="w-4 h-4 mr-1" /> New Rule
                            </button>
                        )}
                    </div>
                </div>

                {/* Manual task creation hint */}
                {managerTab === 'manual' && (
                    <div className="px-5 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Create tasks manually and assign them to staff members.</p>
                                <p className="text-xs text-slate-400 mt-0.5">Manual tasks appear in the task list below with "Manual" badge.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-900">{taskStats.manual}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Manual</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-900">{taskStats.pending}</div>
                                    <div className="text-[10px] text-yellow-500 uppercase font-semibold">Pending</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-900">{taskStats.inProgress}</div>
                                    <div className="text-[10px] text-blue-500 uppercase font-semibold">In Progress</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Auto-task rules */}
                {managerTab === 'auto' && (
                    <div className="px-5 py-4 space-y-3">
                        {!automationEnabled && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                <p className="text-xs text-amber-700"><strong>Automation is disabled.</strong> Turn on the toggle above to enable auto-task creation.</p>
                            </div>
                        )}

                        {/* Placeholder info */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Available Placeholders</p>
                            <div className="flex flex-wrap gap-1.5">
                                {PLACEHOLDERS.map(p => (
                                    <span key={p.tag} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">
                                        {p.tag} <span className="text-slate-400">= {p.desc}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {autoLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                            </div>
                        ) : autoRules.length === 0 ? (
                            <div className="text-center py-8">
                                <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">No auto-task rules yet.</p>
                                <p className="text-xs text-slate-400">Create a rule to auto-generate tasks on events.</p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {autoRules.map(rule => {
                                    const EventIcon = getEventIcon(rule.event_type);
                                    return (
                                        <div key={rule.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${rule.is_active ? 'bg-white border-slate-150' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${rule.is_active ? 'bg-primary-50' : 'bg-slate-100'}`}>
                                                <EventIcon className={`w-4 h-4 ${rule.is_active ? 'text-primary-600' : 'text-slate-400'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-slate-900 text-sm truncate">{rule.title}</h3>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${priorityColors[rule.priority]}`}>{rule.priority}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                                        <Zap className="w-2.5 h-2.5" /> {getEventLabel(rule.event_type)}
                                                    </span>
                                                    {rule.event_filter && (
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${rule.event_filter === 'POS' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                                                            {rule.event_filter === 'POS' ? <UtensilsCrossed className="w-2.5 h-2.5" /> : <ShoppingBag className="w-2.5 h-2.5" />}
                                                            {rule.event_filter === 'POS' ? 'POS' : 'Room Service'}
                                                        </span>
                                                    )}
                                                    {rule.assign_to_name && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px]">
                                                            <User className="w-2.5 h-2.5" /> {rule.assign_to_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => handleToggleRule(rule)}
                                                    className={`p-1 rounded-lg transition-colors ${rule.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    title={rule.is_active ? 'Disable' : 'Enable'}>
                                                    {rule.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                                </button>
                                                <button onClick={() => handleEditRule(rule)}
                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteRule(rule)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ============================================ */}
            {/* BOTTOM SECTION: ALL TASKS LIST */}
            {/* ============================================ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-slate-900">All Tasks ({filteredTasks.length})</h2>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-lg font-semibold">{taskStats.auto} Auto</span>
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold">{taskStats.manual} Manual</span>
                        </div>
                    </div>
                    {/* Filters row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                            <input placeholder="Search tasks..." value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300" />
                        </div>
                        <select value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none">
                            <option value="">All Status</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                        <select value={filters.priority}
                            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none">
                            <option value="">All Priority</option>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={filters.source}
                            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none">
                            <option value="">All Types</option>
                            <option value="MANUAL">Manual</option>
                            <option value="AUTO">Auto</option>
                        </select>
                        {(filters.status || filters.priority || filters.source || filters.search) && (
                            <button onClick={() => setFilters({ status: '', priority: '', source: '', search: '' })}
                                className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
                        )}
                    </div>
                </div>

                <div className="p-0">
                    <DataTable columns={columns} data={filteredTasks} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
                </div>
            </div>

            {/* ============================================ */}
            {/* CREATE/EDIT MANUAL TASK MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingTask(null); resetForm(); }}
                title={editingTask ? t('tasks.modals.edit_title') : t('tasks.modals.create_title')}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.title')} *</label>
                        <div className="relative">
                            <ClipboardList className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input required placeholder={t('tasks.form.title_placeholder')} value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input pl-10" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.description')}</label>
                        <textarea rows={3} placeholder={t('tasks.form.description_placeholder')} value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.assign_to')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <select value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} className="input pl-10">
                                    <option value="">{t('tasks.table.unassigned')}</option>
                                    {staffMembers.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role_name})</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.priority')}</label>
                            <div className="relative">
                                <AlertTriangle className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="input pl-10">
                                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.due_date')}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input type="datetime-local" value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className="input pl-10" />
                            </div>
                        </div>
                        {editingTask && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.status')}</label>
                                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input">
                                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex space-x-3 pt-4 border-t border-gray-200 mt-6">
                        <button type="submit" className="btn btn-primary flex-1">
                            {editingTask ? t('common.update') : t('common.create')}
                        </button>
                        <button type="button" onClick={() => { setShowModal(false); setEditingTask(null); resetForm(); }} className="btn btn-secondary">
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ============================================ */}
            {/* AUTO-RULE MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showRuleModal} onClose={() => { setShowRuleModal(false); setEditingRule(null); resetRuleForm(); }}
                title={editingRule ? 'Edit Auto-Task Rule' : 'Create Auto-Task Rule'}>
                <form onSubmit={handleRuleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Trigger Event *</label>
                        <select value={ruleForm.event_type}
                            onChange={(e) => setRuleForm({ ...ruleForm, event_type: e.target.value, event_filter: '' })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                            <optgroup label="Booking Events">
                                {EVENT_TYPES.filter(e => e.group === 'Booking').map(e => (
                                    <option key={e.value} value={e.value}>{e.label}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Service Request Events">
                                {EVENT_TYPES.filter(e => e.group === 'Service Request').map(e => (
                                    <option key={e.value} value={e.value}>{e.label}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {isSREvent && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">SR Type Filter</label>
                            <select value={ruleForm.event_filter}
                                onChange={(e) => setRuleForm({ ...ruleForm, event_filter: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                                {SR_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Task Title *</label>
                        <input required value={ruleForm.title}
                            onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                            placeholder="e.g. Prepare welcome amenities for {guest_name}" />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                        <textarea rows={2} value={ruleForm.description}
                            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none resize-none"
                            placeholder="e.g. Room {room_number} - Guest: {guest_name}" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Priority</label>
                            <select value={ruleForm.priority}
                                onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Auto-assign to</label>
                            <select value={ruleForm.assign_to}
                                onChange={(e) => setRuleForm({ ...ruleForm, assign_to: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none">
                                <option value="">Unassigned</option>
                                {staffMembers.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role_name})</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Placeholder hints */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Click to insert placeholder</p>
                        <div className="flex flex-wrap gap-1.5">
                            {PLACEHOLDERS.filter(p => {
                                if (!isSREvent) return !['service_name', 'service_category'].includes(p.tag.replace(/[{}]/g, ''));
                                return true;
                            }).map(p => (
                                <button key={p.tag} type="button"
                                    onClick={() => setRuleForm({ ...ruleForm, title: ruleForm.title + ' ' + p.tag })}
                                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 transition-colors">
                                    {p.tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex space-x-3 pt-4 border-t border-slate-200">
                        <button type="submit" className="btn btn-primary flex-1">
                            {editingRule ? 'Update Rule' : 'Create Rule'}
                        </button>
                        <button type="button" onClick={() => { setShowRuleModal(false); setEditingRule(null); resetRuleForm(); }}
                            className="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ============================================ */}
            {/* TASK DETAILS MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showDetailsModal}
                onClose={() => { setShowDetailsModal(false); setTaskDetails(null); setTaskHistory([]); }}
                title={t('tasks.modals.details_title')}>
                {taskDetails && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-900">{taskDetails.title}</h3>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${taskDetails.source === 'AUTO' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {taskDetails.source === 'AUTO' ? 'Auto' : 'Manual'}
                                    </span>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[taskDetails.status]}`}>
                                    {taskDetails.status.replace('_', ' ')}
                                </span>
                            </div>
                            {taskDetails.description && <p className="text-sm text-gray-600">{taskDetails.description}</p>}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">{t('tasks.details.assigned_to')}:</span>{' '}
                                    <span className="font-medium text-gray-900">{taskDetails.assigned_to_name || t('tasks.table.unassigned')}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">{t('tasks.details.priority')}:</span>{' '}
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[taskDetails.priority]}`}>{taskDetails.priority}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">{t('tasks.details.created_by')}:</span>{' '}
                                    <span className="font-medium text-gray-900">{taskDetails.created_by_name || (taskDetails.source === 'AUTO' ? 'System (Auto)' : '-')}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">{t('tasks.details.due')}:</span>{' '}
                                    <span className="font-medium text-gray-900">
                                        {taskDetails.due_date ? format(new Date(taskDetails.due_date), 'MMM dd, yyyy HH:mm') : '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">{t('tasks.details.created')}:</span>{' '}
                                    <span className="font-medium text-gray-900">{format(new Date(taskDetails.created_at), 'MMM dd, yyyy HH:mm')}</span>
                                </div>
                                {taskDetails.completed_at && (
                                    <div>
                                        <span className="text-gray-500">{t('tasks.details.completed')}:</span>{' '}
                                        <span className="font-medium text-green-700">{format(new Date(taskDetails.completed_at), 'MMM dd, yyyy HH:mm')}</span>
                                    </div>
                                )}
                            </div>
                            {taskDetails.comments && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200 mt-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">{t('tasks.details.latest_comment')}</span>
                                    <p className="text-sm text-gray-700 mt-1">{taskDetails.comments}</p>
                                </div>
                            )}
                        </div>

                        {/* History Timeline */}
                        <div>
                            <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-blue-500" />
                                {t('tasks.modals.history_title')}
                            </h4>
                            {taskHistory.length === 0 ? (
                                <p className="text-sm text-gray-500 italic text-center py-4">{t('tasks.modals.no_history')}</p>
                            ) : (
                                <div className="relative ml-4">
                                    <div className="absolute left-3.5 top-6 bottom-6 w-0.5 bg-gray-100" />
                                    <div className="space-y-0">
                                        {taskHistory.map((entry) => {
                                            const dotColor = entry.to_status === 'COMPLETED' ? 'text-green-500' :
                                                entry.to_status === 'CANCELLED' ? 'text-red-500' :
                                                    entry.to_status === 'IN_PROGRESS' ? 'text-blue-500' : 'text-amber-500';
                                            const statusLabel = entry.to_status.replace('_', ' ');
                                            let description = '';
                                            if (!entry.from_status) {
                                                description = entry.comments && entry.comments.startsWith('Auto-created')
                                                    ? entry.comments
                                                    : `Task created by ${entry.changed_by_name || 'System'}`;
                                            } else {
                                                description = `${statusLabel.charAt(0) + statusLabel.slice(1).toLowerCase()} by ${entry.changed_by_name || 'System'}`;
                                            }
                                            if (entry.comments && entry.from_status) description += ` - "${entry.comments}"`;
                                            return (
                                                <div key={entry.id} className="relative flex items-start pl-10 py-3">
                                                    <div className={`absolute left-0 top-3.5 ${dotColor}`}>
                                                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
                                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="white" />
                                                            <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-xl p-4 flex-1 border border-gray-100">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="font-bold text-gray-900 text-sm">{statusLabel}</p>
                                                                <p className="text-sm text-blue-600 mt-0.5">{description}</p>
                                                            </div>
                                                            <span className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap font-medium">
                                                                {format(new Date(entry.changed_at), 'MMM dd, yyyy, h:mm a')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-gray-200">
                            <button onClick={() => { setShowDetailsModal(false); setTaskDetails(null); setTaskHistory([]); }}
                                className="btn btn-secondary w-full">{t('common.close')}</button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig({ isOpen: false, id: null, type: 'task' })}
                onConfirm={confirmDelete}
                title={confirmConfig.type === 'rule' ? 'Delete Rule' : t('tasks.modals.delete_title')}
                message={confirmConfig.type === 'rule' ? 'Are you sure you want to delete this auto-task rule?' : t('tasks.modals.delete_confirm')}
                confirmColor="bg-red-600 hover:bg-red-700" />
        </div>
    );
}
