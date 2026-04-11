import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import { User, Mail, Shield, Key } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      await authAPI.changePassword({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully');
      setShowPasswordChange(false);
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      {/* User Information */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">User Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-primary-50 rounded-lg">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Full Name</label>
              <p className="font-medium text-gray-900">{user?.full_name || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Email Address</label>
              <p className="font-medium text-gray-900">{user?.email || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Role</label>
              <p className="font-medium text-gray-900">
                {user?.roles?.map(r => r.name).join(', ') || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <label className="text-sm text-gray-600">User ID</label>
              <p className="font-medium text-gray-900 font-mono text-sm">{user?.id || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Key className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          </div>
          {!showPasswordChange && (
            <button
              onClick={() => setShowPasswordChange(true)}
              className="btn btn-primary"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordChange && (
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.oldPassword}
                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="input"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="input"
                required
                minLength={6}
              />
            </div>

            <div className="flex space-x-3">
              <button type="submit" className="btn btn-primary">
                Update Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(false);
                  setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Permissions */}
      {user?.permissions && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Permissions</h2>
          <div className="flex flex-wrap gap-2">
            {user.permissions.map((permission) => (
              <span
                key={permission}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {permission}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
