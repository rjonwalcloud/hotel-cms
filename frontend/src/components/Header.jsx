import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Bell, User, LogOut, Check, Trash2, ExternalLink, Inbox } from 'lucide-react';
import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import { formatDistanceToNow } from 'date-fns';

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, clearAll } = useNotificationStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const displayNotifications = notifications.slice(0, 5);
  const role = user?.roles?.[0]?.role || 'HOTEL_ADMIN';
  const srLink = role === 'HOTEL_ADMIN' ? '/hotel/service-requests' : '/staff/service-requests';

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-40">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {document.title.split(' - ')[1] || 'Overview'}
        </h1>
      </div>

      {/* Right Side */}
      <div className="flex items-center space-x-4">
        {/* Language Selector */}
        <LanguageSelector />

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className={`relative p-2.5 rounded-xl transition-all duration-200 ${
              showNotifications ? 'bg-primary-100 text-primary-600 shadow-inner' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'
            }`}
          >
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse-slow' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-secondary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-sm transition-transform scale-100 group-hover:scale-110">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-premium border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in duration-200 origin-top-right">
                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">{t('common.notifications')}</h3>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <button 
                        onClick={() => markAllAsRead()}
                        className="text-[10px] font-bold text-primary-600 hover:underline px-2 py-1"
                      >
                        {t('common.mark_all_read')}
                      </button>
                    )}
                    <button 
                      onClick={() => clearAll()}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                      title={t('common.clear_all')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Inbox className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-xs font-medium text-slate-400">{t('common.no_notifications')}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {displayNotifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`p-4 hover:bg-slate-50 transition-colors group relative ${!notification.isRead ? 'bg-primary-50/30' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notification.isRead ? 'bg-primary-500 shadow-sm' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate pr-6">
                                {notification.room_number ? `${t('rooms.room_number') || 'Room'} ${notification.room_number}` : notification.title}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                {notification.service_name || notification.message}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="absolute top-4 right-4 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.isRead && (
                                <button 
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg text-primary-600 hover:bg-primary-50"
                                  title={t('common.mark_read') || 'Mark as read'}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                              <button 
                                onClick={() => dismissNotification(notification.id)}
                                className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                title={t('common.dismiss') || 'Dismiss'}
                              >
                                <Trash2 className="w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="p-2 bg-slate-50/50 border-t border-slate-100">
                    <Link
                      to={srLink}
                      onClick={() => setShowNotifications(false)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 text-[11px] font-bold text-primary-600 bg-white border border-slate-100 rounded-xl hover:bg-primary-50 transition-all shadow-sm"
                    >
                      <span>{t('common.view_all_sr')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 p-1.5 pr-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
          >
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-material-1">
              <span className="text-white text-sm font-bold">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">{user?.full_name}</p>
              <p className="text-[10px] font-medium text-slate-400 leading-tight">{user?.email}</p>
            </div>
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <User className="w-4 h-4" />
                  <span>{t('common.profile')}</span>
                </Link>

                <hr className="my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
