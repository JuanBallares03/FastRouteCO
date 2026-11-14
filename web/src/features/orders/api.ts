import { api } from '@/services/http';

export interface OrderPayload {
  type: 'delivery' | 'pickup';
  address?: string;
  priority?: 'normal' | 'urgent';
  customerName?: string;
  customerPhone?: string;
  description?: string;
  channel?: 'whatsapp' | 'phone_call' | 'in_person';
  branchId?: string;
}

export const orderApi = {
  getOrders: (params?: {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/orders', { params }),

  createOrder: (data: OrderPayload) => api.post('/orders', data),

  updateOrder: (id: string, data: Partial<OrderPayload>) =>
    api.patch(`/orders/${id}`, data),

  cancelOrder: (id: string) => api.post(`/orders/${id}/cancel`),

  suggestDrivers: (id: string) => api.get(`/orders/${id}/driver-suggestions`),

  assignOrder: (id: string, data: { driverId: string; routeDate?: string }) =>
    api.post(`/orders/${id}/assign`, data),
};
