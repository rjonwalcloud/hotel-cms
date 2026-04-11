import { useState, useEffect } from 'react';
import { rateAPI, roomAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Star, Calendar, DollarSign, RefreshCw } from 'lucide-react';

export default function RateManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();

    const [activeTab, setActiveTab] = useState('plans');
    const [plans, setPlans] = useState([]);
    const [rules, setRules] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editingRule, setEditingRule] = useState(null);

    const [planForm, setPlanForm] = useState({ name: '', description: '', is_default: false, is_active: true, priority: 0 });
    const [ruleForm, setRuleForm] = useState({
        rate_plan_id: '', room_type_id: '', name: '', start_date: '', end_date: '',
        price_override: '', adjustment_type: 'FIXED', min_nights: 1, is_active: true
    });

    useEffect(() => { loadData(); }, [hotelId]);

    const loadData = async () => {
        if (!hotelId) return;
        setLoading(true);
        try {
            const [plansRes, rulesRes, rtRes] = await Promise.all([
                rateAPI.getPlans(hotelId),
                rateAPI.getRules(hotelId),
                roomAPI.getTypes(hotelId)
            ]);
            setPlans(plansRes.data || []);
            setRules(rulesRes.data || []);
            setRoomTypes(rtRes.roomTypes || []);
        } catch (err) {
            console.error('Rate data load error:', err);
            toast.error(t('rates.messages.load_error'));
        } finally {
            setLoading(false);
        }
    };

    // ==================== PLAN HANDLERS ====================
    const openPlanModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            setPlanForm({ name: plan.name, description: plan.description || '', is_default: plan.is_default, is_active: plan.is_active, priority: plan.priority || 0 });
        } else {
            setEditingPlan(null);
            setPlanForm({ name: '', description: '', is_default: false, is_active: true, priority: 0 });
        }
        setShowPlanModal(true);
    };

    const handleSavePlan = async () => {
        if (!planForm.name.trim()) return toast.error('Name is required');
        try {
            if (editingPlan) {
                await rateAPI.updatePlan(editingPlan.id, hotelId, planForm);
                toast.success(t('rates.messages.plan_updated'));
            } else {
                await rateAPI.createPlan(hotelId, planForm);
                toast.success(t('rates.messages.plan_created'));
            }
            setShowPlanModal(false);
            loadData();
        } catch (err) { toast.error(t('rates.messages.plan_save_error')); }
    };

    const handleDeletePlan = async (id) => {
        if (!confirm(t('rates.messages.plan_delete_confirm'))) return;
        try {
            await rateAPI.deletePlan(id, hotelId);
            toast.success(t('rates.messages.plan_delete_success'));
            loadData();
        } catch (err) { toast.error(t('rates.messages.plan_delete_error')); }
    };

    // ==================== RULE HANDLERS ====================
    const openRuleModal = (rule = null) => {
        if (rule) {
            setEditingRule(rule);
            setRuleForm({
                rate_plan_id: rule.rate_plan_id, room_type_id: rule.room_type_id,
                name: rule.name || '', start_date: rule.start_date?.split('T')[0] || '',
                end_date: rule.end_date?.split('T')[0] || '', price_override: rule.price_override,
                adjustment_type: rule.adjustment_type || 'FIXED', min_nights: rule.min_nights || 1,
                is_active: rule.is_active
            });
        } else {
            setEditingRule(null);
            setRuleForm({
                rate_plan_id: plans[0]?.id || '', room_type_id: roomTypes[0]?.id || '',
                name: '', start_date: '', end_date: '', price_override: '',
                adjustment_type: 'FIXED', min_nights: 1, is_active: true
            });
        }
        setShowRuleModal(true);
    };

    const handleSaveRule = async () => {
        if (!ruleForm.rate_plan_id || !ruleForm.room_type_id || !ruleForm.start_date || !ruleForm.end_date || !ruleForm.price_override) {
            return toast.error('All required fields must be filled');
        }
        try {
            if (editingRule) {
                await rateAPI.updateRule(editingRule.id, hotelId, ruleForm);
                toast.success(t('rates.messages.rule_updated'));
            } else {
                await rateAPI.createRule(hotelId, ruleForm);
                toast.success(t('rates.messages.rule_created'));
            }
            setShowRuleModal(false);
            loadData();
        } catch (err) { toast.error(t('rates.messages.rule_save_error')); }
    };

    const handleDeleteRule = async (id) => {
        if (!confirm(t('rates.messages.rule_delete_confirm'))) return;
        try {
            await rateAPI.deleteRule(id, hotelId);
            toast.success(t('rates.messages.rule_delete_success'));
            loadData();
        } catch (err) { toast.error(t('rates.messages.rule_delete_error')); }
    };

    // ==================== TABLE COLUMNS ====================
    const planColumns = [
        {
            key: 'name', label: t('rates.plans.table.name'), render: (_, row) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.name}</span>
                    {row.is_default && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-bold"><Star className="w-3 h-3 inline mr-1" />{t('rates.status.default')}</span>}
                </div>
            )
        },
        { key: 'description', label: t('rates.plans.table.description'), render: (_, row) => <span className="text-gray-500 text-sm">{row.description || '—'}</span> },
        { key: 'rules_count', label: t('rates.plans.table.rules'), render: (_, row) => <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{row.rules_count}</span> },
        { key: 'priority', label: t('rates.plans.table.priority'), render: (_, row) => <span className="font-mono">{row.priority}</span> },
        {
            key: 'is_active', label: t('rates.plans.table.status'), render: (_, row) => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.is_active ? t('rates.status.active') : t('rates.status.inactive')}
                </span>
            )
        },
        {
            key: 'actions', label: t('rates.plans.table.actions'), render: (_, row) => (
                <div className="flex gap-2">
                    <button onClick={() => openPlanModal(row)} className="btn btn-sm btn-secondary" title={t('common.edit')}><Edit className="w-3 h-3" /></button>
                    <button onClick={() => handleDeletePlan(row.id)} className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100" title={t('common.delete')}><Trash2 className="w-3 h-3" /></button>
                </div>
            )
        }
    ];

    const ruleColumns = [
        { key: 'name', label: t('rates.rules.table.name'), render: (_, row) => <span className="font-semibold">{row.name || '—'}</span> },
        { key: 'rate_plan_name', label: t('rates.rules.table.plan'), render: (_, row) => <span className="text-sm text-purple-600 font-medium">{row.rate_plan_name}</span> },
        { key: 'room_type_name', label: t('rates.rules.table.room_type'), render: (_, row) => <span className="text-sm">{row.room_type_name}</span> },
        {
            key: 'dates', label: t('rates.rules.table.dates'), render: (_, row) => (
                <span className="text-sm">
                    {new Date(row.start_date).toLocaleDateString()} — {new Date(row.end_date).toLocaleDateString()}
                </span>
            )
        },
        {
            key: 'price_override', label: t('rates.rules.table.price'), render: (_, row) => (
                <span className="font-bold text-green-600">{formatCurrency(row.price_override)}</span>
            )
        },
        {
            key: 'adjustment_type', label: t('rates.rules.table.type'), render: (_, row) => {
                const adjLabels = {
                    'FIXED': t('rates.adj_types.fixed'),
                    'PERCENTAGE_INCREASE': t('rates.adj_types.percent_inc'),
                    'PERCENTAGE_DECREASE': t('rates.adj_types.percent_dec')
                };
                return <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{adjLabels[row.adjustment_type] || row.adjustment_type}</span>
            }
        },
        {
            key: 'is_active', label: t('rates.rules.table.status'), render: (_, row) => {
                const isEffectivelyActive = row.is_active && row.plan_is_active;
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${isEffectivelyActive ? 'bg-green-100 text-green-700' :
                        (!row.is_active ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')
                        }`}>
                        {!row.is_active ? t('rates.status.inactive') : (!row.plan_is_active ? t('rates.status.inactive_plan_off') : t('rates.status.active'))}
                    </span>
                );
            }
        },
        {
            key: 'actions', label: t('rates.rules.table.actions'), render: (_, row) => (
                <div className="flex gap-2">
                    <button onClick={() => openRuleModal(row)} className="btn btn-sm btn-secondary"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteRule(row.id)} className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-3 h-3" /></button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('rates.title')}</h1>
                    <p className="text-slate-500 mt-1">{t('rates.subtitle')}</p>
                </div>
                <button onClick={loadData} className="btn btn-secondary flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> {t('rates.refresh')}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('plans')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'plans' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <DollarSign className="w-4 h-4 inline mr-1" /> {t('rates.tabs.plans')}
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'rules' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Calendar className="w-4 h-4 inline mr-1" /> {t('rates.tabs.rules')}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'plans' && (
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">{t('rates.plans.title')}</h2>
                        <button onClick={() => openPlanModal()} className="btn btn-primary flex items-center gap-2">
                            <Plus className="w-4 h-4" /> {t('rates.plans.new')}
                        </button>
                    </div>
                    <DataTable columns={planColumns} data={plans} loading={loading} emptyMessage={t('rates.plans.empty')} />
                </div>
            )}

            {activeTab === 'rules' && (
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">{t('rates.rules.title')}</h2>
                        <button onClick={() => openRuleModal()} className="btn btn-primary flex items-center gap-2" disabled={!plans.length}>
                            <Plus className="w-4 h-4" /> {t('rates.rules.new')}
                        </button>
                    </div>
                    {!plans.length && <p className="text-amber-600 text-sm mb-3">⚠️ {t('rates.rules.plan_required')}</p>}
                    <DataTable columns={ruleColumns} data={rules} loading={loading} emptyMessage={t('rates.rules.empty')} />
                </div>
            )}

            {/* Plan Modal */}
            <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} title={editingPlan ? t('rates.modals.plan.edit') : t('rates.modals.plan.create')}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.plan.name')}</label>
                        <input type="text" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                            className="input" placeholder={t('rates.modals.plan.name_placeholder')} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.plan.description')}</label>
                        <textarea value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                            className="input" rows="2" placeholder={t('rates.modals.plan.description_placeholder')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.plan.priority')}</label>
                            <input type="number" value={planForm.priority} onChange={e => setPlanForm({ ...planForm, priority: parseInt(e.target.value) || 0 })}
                                className="input" min="0" />
                            <p className="text-xs text-gray-400 mt-1">{t('rates.modals.plan.priority_help')}</p>
                        </div>
                        <div className="space-y-3 pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={planForm.is_default} onChange={e => setPlanForm({ ...planForm, is_default: e.target.checked })}
                                    className="w-4 h-4 rounded" />
                                <span className="text-sm font-medium">{t('rates.modals.plan.is_default')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={planForm.is_active} onChange={e => setPlanForm({ ...planForm, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded" />
                                <span className="text-sm font-medium">{t('rates.modals.plan.is_active')}</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t">
                        <button onClick={() => setShowPlanModal(false)} className="btn btn-secondary">{t('common.cancel')}</button>
                        <button onClick={handleSavePlan} className="btn btn-primary">{editingPlan ? t('rates.modals.plan.save_update') : t('rates.modals.plan.save_create')}</button>
                    </div>
                </div>
            </Modal>

            {/* Rule Modal */}
            <Modal isOpen={showRuleModal} onClose={() => setShowRuleModal(false)} title={editingRule ? t('rates.modals.rule.edit') : t('rates.modals.rule.create')} size="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.plan')}</label>
                            <select value={ruleForm.rate_plan_id} onChange={e => setRuleForm({ ...ruleForm, rate_plan_id: e.target.value })}
                                className="input">
                                <option value="">{t('rates.modals.rule.plan_placeholder')}</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} {p.is_active ? '' : `(${t('rates.status.inactive')})`}</option>
                                ))}
                            </select>
                            {ruleForm.rate_plan_id && plans.find(p => p.id === ruleForm.rate_plan_id)?.is_active === false && (
                                <p className="text-xs text-amber-600 font-medium mt-1">⚠️ {t('rates.modals.rule.plan_inactive_warning')}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.room_type')}</label>
                            <select value={ruleForm.room_type_id} onChange={e => setRuleForm({ ...ruleForm, room_type_id: e.target.value })} className="input">
                                <option value="">{t('rates.modals.rule.room_type_placeholder')}</option>
                                {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.name')}</label>
                        <input type="text" value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                            className="input" placeholder={t('rates.modals.rule.name_placeholder')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.start_date')}</label>
                            <input type="date" value={ruleForm.start_date} onChange={e => setRuleForm({ ...ruleForm, start_date: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.end_date')}</label>
                            <input type="date" value={ruleForm.end_date} onChange={e => setRuleForm({ ...ruleForm, end_date: e.target.value })} className="input" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.price')}</label>
                            <input type="number" value={ruleForm.price_override} onChange={e => setRuleForm({ ...ruleForm, price_override: e.target.value })}
                                className="input" step="0.01" min="0" placeholder={t('rates.modals.rule.price_placeholder')} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.adj_type')}</label>
                            <select value={ruleForm.adjustment_type} onChange={e => setRuleForm({ ...ruleForm, adjustment_type: e.target.value })} className="input">
                                <option value="FIXED">{t('rates.adj_types.fixed')}</option>
                                <option value="PERCENTAGE_INCREASE">{t('rates.adj_types.percent_inc')}</option>
                                <option value="PERCENTAGE_DECREASE">{t('rates.adj_types.percent_dec')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('rates.modals.rule.min_nights')}</label>
                            <input type="number" value={ruleForm.min_nights} onChange={e => setRuleForm({ ...ruleForm, min_nights: parseInt(e.target.value) || 1 })}
                                className="input" min="1" />
                        </div>
                        <div className="pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={ruleForm.is_active} onChange={e => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded" />
                                <span className="text-sm font-medium">{t('rates.modals.rule.is_active')}</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t">
                        <button onClick={() => setShowRuleModal(false)} className="btn btn-secondary">{t('common.cancel')}</button>
                        <button onClick={handleSaveRule} className="btn btn-primary">{editingRule ? t('rates.modals.rule.save_update') : t('rates.modals.rule.save_create')}</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
