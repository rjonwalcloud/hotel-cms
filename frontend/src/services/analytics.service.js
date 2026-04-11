import api from './api';

export const analyticsAPI = {
  getSummary: async (hotelId, filters = {}) => {
    const { year, month } = filters;
    const response = await api.get(`/analytics/${hotelId}/summary`, {
      params: { year, month }
    });
    return response;
  },
  
  getChartData: async (hotelId, filters = {}) => {
    const { period = 'monthly', year, month } = filters;
    const response = await api.get(`/analytics/${hotelId}/charts`, {
      params: { period, year, month }
    });
    return response;
  }
};
