import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      activeHotelId: null,

      login: async (credentials) => {
        try {
          set({ isLoading: true });
          const response = await authAPI.login(credentials);

          const { token, user } = response;

          // Store token
          localStorage.setItem('token', token);

          // Determine initial hotel
          const initialHotelId = user.hotel_id || user.roles?.find(r => r.hotel_id)?.hotel_id;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            activeHotelId: initialHotelId,
          });

          toast.success('Login successful!');
          return true;
        } catch (error) {
          set({ isLoading: false });
          toast.error(error.message || 'Login failed');
          return false;
        }
      },

      register: async (userData) => {
        try {
          set({ isLoading: true });
          await authAPI.register(userData);

          set({ isLoading: false });
          toast.success('Registration successful! Please login.');
          return true;
        } catch (error) {
          set({ isLoading: false });
          toast.error(error.message || 'Registration failed');
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          activeHotelId: null,
        });
        toast.success('Logged out successfully');
      },

      switchHotel: (hotelId) => {
        set({ activeHotelId: hotelId });
        toast.success('Switched hotel workspace');
      },

      updateUser: async () => {
        try {
          const user = await authAPI.getCurrentUser();
          set({ user });
        } catch (error) {
          console.error('Failed to update user:', error);
        }
      },

      hasRole: (roleName) => {
        const { user } = get();
        if (!user || !user.roles) return false;
        return user.roles.some(role => {
          const r = typeof role === 'string' ? role : role.role;
          if (!r) return false;
          const upperR = r.toUpperCase();
          if (roleName === 'HOTEL_ADMIN') {
            return upperR === 'HOTEL_ADMIN' || upperR === 'ADMIN';
          }
          return upperR === roleName.toUpperCase();
        });
      },

      hasPermission: (permissionName) => {
        const { user } = get();
        const perms = user?.roles?.flatMap(role => role.permissions || []).filter(Boolean) || [];
        return perms.includes(permissionName);
      },

      getPermissions: () => {
        const { user } = get();
        return user?.roles?.flatMap(role => role.permissions || []).filter(Boolean) || [];
      },

      getHotelId: () => {
        const { user, activeHotelId } = get();

        // Return active hotel if selected
        if (activeHotelId) return activeHotelId;

        // Fallback logic
        if (user?.hotel_id) return user.hotel_id;

        // Extract from roles if nested
        const hotelRole = user?.roles?.find(r => r.hotel_id);
        return hotelRole?.hotel_id;
      },

      getHiddenMenus: () => {
        const { user, activeHotelId } = get();
        if (!user || !user.roles) return [];
        
        const activeRole = user.roles.find(r => r.hotel_id === activeHotelId) || user.roles[0];
        return activeRole?.hidden_menu_items || [];
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        activeHotelId: state.activeHotelId,
      }),
    }
  )
);
