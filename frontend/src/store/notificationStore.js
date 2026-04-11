import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) => {
        const { notifications } = get();
        // Prevent duplicates
        if (notifications.some(n => n.id === notification.id)) return;

        const newNotification = {
          ...notification,
          timestamp: new Date().toISOString(),
          isRead: false
        };

        set({
          notifications: [newNotification, ...notifications].slice(0, 20), // Keep last 20
          unreadCount: get().unreadCount + 1
        });
      },

      markAsRead: (id) => {
        const { notifications, unreadCount } = get();
        const notification = notifications.find(n => n.id === id);
        
        if (notification && !notification.isRead) {
          set({
            notifications: notifications.map(n => 
              n.id === id ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, unreadCount - 1)
          });
        }
      },

      markAllAsRead: () => {
        set({
          notifications: get().notifications.map(n => ({ ...n, isRead: true })),
          unreadCount: 0
        });
      },

      dismissNotification: (id) => {
        const { notifications, unreadCount } = get();
        const notification = notifications.find(n => n.id === id);
        const newUnreadCount = notification && !notification.isRead ? Math.max(0, unreadCount - 1) : unreadCount;
        
        set({
          notifications: notifications.filter(n => n.id !== id),
          unreadCount: newUnreadCount
        });
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0
        });
      }
    }),
    {
      name: 'hotel-notifications'
    }
  )
);
