import { useState, useEffect } from 'react';
import { hotelAPI, adminUserAPI } from '../../services/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, User, Mail, Phone, Shield, Building } from 'lucide-react';

// Mandatory permissions for Staff role — always included, cannot be removed
const MANDATORY_STAFF_PERMS = [
    'TASK_VIEW', 'TASK_UPDATE',
    'SERVICE_REQUEST_VIEW', 'SERVICE_REQUEST_UPDATE',
];

export default function UserManagement() {
    const [hotels, setHotels] = useState([]);
    const [selectedHotel, setSelectedHotel] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [availablePermissions, setAvailablePermissions] = useState([]);
    const [activeTab, setActiveTab] = useState('details'); // details or permissions
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role_name: 'STAFF',
        is_active: true,
        custom_permissions: null
    });

    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, id: null, hotelId: null });

    useEffect(() => {
        loadHotels();
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            const data = await adminUserAPI.getAllPermissions();
            setAvailablePermissions(data.permissions || []);
        } catch (error) {
            console.error('Failed to load permissions:', error);
            // Don't toast here as it's not a critical blocking failure for the main view
        }
    };

    const loadHotels = async () => {
        try {
            const data = await hotelAPI.getAll();
            setHotels(data.hotels || []);
            if (data.hotels?.length > 0) {
                setSelectedHotel(data.hotels[0].id);
                loadUsers(data.hotels[0].id);
            }
        } catch (error) {
            toast.error('Failed to load hotels');
        }
    };

    const loadUsers = async (hotelId) => {
        if (!hotelId) return;
        setLoading(true);
        try {
            const data = await adminUserAPI.getUsersByHotel(hotelId);
            setUsers(data.users || []);
        } catch (error) {
            console.error('Failed to load users:', error);
            toast.error(error.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleHotelChange = (e) => {
        const hotelId = e.target.value;
        setSelectedHotel(hotelId);
        loadUsers(hotelId);
    };

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            full_name: '',
            phone: '',
            role_name: 'STAFF',
            is_active: true,
            custom_permissions: null
        });
        setActiveTab('details');
    };

    const handlePermissionToggle = (permissionKey) => {
        // Prevent removing mandatory perms for staff
        if (formData.role_name === 'STAFF' && MANDATORY_STAFF_PERMS.includes(permissionKey)) return;
        setFormData(prev => {
            const currentPerms = prev.custom_permissions || [];
            if (currentPerms.includes(permissionKey)) {
                return { ...prev, custom_permissions: currentPerms.filter(p => p !== permissionKey) };
            } else {
                return { ...prev, custom_permissions: [...currentPerms, permissionKey] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await adminUserAPI.update(editingUser.id, { ...formData, hotel_id: selectedHotel });
                toast.success('User updated successfully');
            } else {
                await adminUserAPI.create({ ...formData, hotel_id: selectedHotel });
                toast.success('User created successfully');
            }
            setShowModal(false);
            setEditingUser(null);
            resetForm();
            loadUsers(selectedHotel);
        } catch (error) {
            console.error('User operation failed:', error);
            toast.error(error.message || 'Operation failed');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            full_name: user.full_name,
            phone: user.phone || '',
            email: user.email,
            role_name: user.role_name,
            is_active: user.is_active,
            password: '', // Keep empty unless changing
            custom_permissions: user.custom_permissions || null // Keep null if unassigned
        });
        setActiveTab('details');
        setShowModal(true);
    };

    const handleDelete = (user) => {
        setConfirmConfig({ isOpen: true, id: user.id, hotelId: selectedHotel });
    };

    const confirmDelete = async () => {
        try {
            await adminUserAPI.delete(confirmConfig.id, confirmConfig.hotelId);
            toast.success('User deleted successfully');
            loadUsers(selectedHotel);
        } catch (error) {
            toast.error('Failed to delete user');
        } finally {
            setConfirmConfig({ isOpen: false, id: null, hotelId: null });
        }
    };

    const columns = [
        { key: 'full_name', label: 'Full Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        {
            key: 'role_name',
            label: 'Role',
            render: (role) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${role === 'HOTEL_ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                    {role.replace('_', ' ')}
                </span>
            )
        },
        {
            key: 'is_active',
            label: 'Status',
            render: (active) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {active ? 'Active' : 'Inactive'}
                </span>
            )
        }
    ];

    // Group permissions by module
    const groupedPermissions = availablePermissions.reduce((acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = [];
        acc[perm.module].push(perm);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-600">Manage hotel administrators and staff</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm">
                        <Building className="w-5 h-5 text-gray-400 mr-2" />
                        <select
                            value={selectedHotel}
                            onChange={handleHotelChange}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700"
                        >
                            {hotels.map(hotel => (
                                <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            resetForm();
                            setShowModal(true);
                        }}
                        disabled={!selectedHotel}
                        className="btn btn-primary inline-flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={users}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            {/* User Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    resetForm();
                }}
                title={editingUser ? 'Edit User' : 'Add New User'}
            >
                <div className="mb-4 border-b border-gray-200">
                    <ul className="flex flex-wrap -mb-px text-sm font-medium text-center" role="tablist">
                        <li className="mr-2" role="presentation">
                            <button
                                className={`inline-block p-4 border-b-2 rounded-t-lg ${activeTab === 'details' ? 'border-primary-600 text-primary-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'} `}
                                onClick={() => setActiveTab('details')}
                                type="button"
                            >
                                Details
                            </button>
                        </li>
                        <li className="mr-2" role="presentation">
                            <button
                                className={`inline-block p-4 border-b-2 rounded-t-lg ${activeTab === 'permissions' ? 'border-primary-600 text-primary-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'} `}
                                onClick={() => setActiveTab('permissions')}
                                type="button"
                            >
                                Permissions (Overrides)
                            </button>
                        </li>
                    </ul>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className={activeTab === 'details' ? 'block' : 'hidden'}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        required={activeTab === 'details'}
                                        placeholder="John Doe"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className="input pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        required={activeTab === 'details'}
                                        type="email"
                                        disabled={!!editingUser}
                                        placeholder="john@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="input pl-10 disabled:bg-gray-50 disabled:text-gray-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        placeholder="+1 234 567 890"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="input pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {editingUser ? 'New Password (Leave blank to keep current)' : 'Password *'}
                                </label>
                                <Shield className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 invisible" /> {/* Placeholder for layout */}
                                <input
                                    required={!editingUser && activeTab === 'details'}
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                                <select
                                    required={activeTab === 'details'}
                                    value={formData.role_name}
                                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                                    className="input"
                                >
                                    <option value="HOTEL_ADMIN">Hotel Admin</option>
                                    <option value="STAFF">Staff</option>
                                </select>
                            </div>
                            <div className="flex items-center pt-6">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                                    Active Account
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={activeTab === 'permissions' ? 'block' : 'hidden'}>
                        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-900 mb-1">Custom Permissions Overview</h3>
                            <p className="text-xs text-gray-600 mb-4">
                                By default, users inherit permissions securely from their selected role (e.g. Hotel Admin or Staff).
                                Checking boxes below assigns rigid custom permissions to this user that completely override their role array. Note: If no checkboxes are checked and permissions are saved, all permissions are revoked!
                            </p>

                            <div className="flex items-center mb-4">
                                <input
                                    type="checkbox"
                                    id="enable_overrides"
                                    checked={formData.custom_permissions !== null}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            // Auto-include mandatory perms for staff
                                            const initial = formData.role_name === 'STAFF' ? [...MANDATORY_STAFF_PERMS] : [];
                                            setFormData({ ...formData, custom_permissions: initial });
                                        } else {
                                            setFormData({ ...formData, custom_permissions: null });
                                        }
                                    }}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <label htmlFor="enable_overrides" className="ml-2 block text-sm font-medium text-gray-900">
                                    Enable Custom Permissions Override
                                </label>
                            </div>
                        </div>

                        {formData.custom_permissions !== null && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[50vh] overflow-y-auto p-2">
                                {Object.entries(groupedPermissions).map(([module, perms]) => (
                                    <div key={module} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                        <h4 className="font-semibold text-gray-800 border-b border-gray-100 pb-2 mb-3 tracking-wide text-xs uppercase">{module}</h4>
                                        <div className="space-y-2">
                                            {perms.map(p => {
                                                const isMandatory = formData.role_name === 'STAFF' && MANDATORY_STAFF_PERMS.includes(p.key);
                                                return (
                                                    <div key={p.key} className={`flex items-start ${isMandatory ? 'opacity-80' : ''}`}>
                                                        <div className="flex items-center h-5">
                                                            <input
                                                                id={p.key}
                                                                type="checkbox"
                                                                checked={(formData.custom_permissions || []).includes(p.key)}
                                                                onChange={() => handlePermissionToggle(p.key)}
                                                                disabled={isMandatory}
                                                                className={`w-4 h-4 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 ${isMandatory ? 'text-green-600 cursor-not-allowed' : 'text-blue-600'}`}
                                                            />
                                                        </div>
                                                        <div className="ml-2 text-sm">
                                                            <label htmlFor={p.key} className="font-medium text-gray-900 text-xs">
                                                                {p.key.replace(`${module}_`, '')}
                                                                {isMandatory && <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold">REQUIRED</span>}
                                                            </label>
                                                            <p className="text-gray-500 text-[10px] uppercase leading-tight mt-0.5">{p.description}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex space-x-3 pt-4 border-t border-gray-200 mt-6">
                        <button type="submit" className="btn btn-primary flex-1">
                            {editingUser ? 'Update User' : 'Create User'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(false);
                                setEditingUser(null);
                                resetForm();
                            }}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig({ isOpen: false, id: null, hotelId: null })}
                onConfirm={confirmDelete}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone."
                confirmColor="bg-red-600 hover:bg-red-700"
            />
        </div>
    );
}
