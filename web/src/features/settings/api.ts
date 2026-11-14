import { api } from '@/services/http';

export const settingsApi = {
  list: () => api.get('/platform/settings'),
  update: (data: Record<string, number>) => api.patch('/platform/settings', data),
};
