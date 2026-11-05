import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal, Toast } from '@/components/ui/Modal';
import { companyApi, orderApi } from '@/services/api';
import {
  getApiErrorMessage,
  validatePhone,
  validateRequired,
} from '@/lib/company-validation';
import {
  ORDER_CHANNEL_LABELS,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  formatDistance,
  orderStatusVariant,
} from '@/lib/order-utils';

interface Order {
  id: string;
  type: string;
  address: string;
  priority: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  description?: string | null;
  channel: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
}

interface Branch {
  id: string;
  name: string;
}

interface DriverSuggestion {
  driverId: string;
  fullName: string;
  phone?: string | null;
  distanceMeters: number | null;
  pendingStops: number;
}

const emptyForm = {
  type: 'delivery',
  address: '',
  customerName: '',
  customerPhone: '',
  channel: 'phone_call',
  priority: 'normal',
  branchId: '',
  description: '',
};

const typeOptions = [
  { value: 'delivery', label: 'Entrega' },
  { value: 'pickup', label: 'Recogida' },
];

const channelOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone_call', label: 'Llamada telefónica' },
  { value: 'in_person', label: 'Presencial' },
];

const priorityOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgente' },
];

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'assigned', label: 'Asignado' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const priorityFilterOptions = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'normal', label: 'Normal' },
];

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ address: '', customerName: '', priority: 'normal' });
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    variant: 'success',
  });

  const fetchOrders = useCallback(async () => {
    try {
      const response = await orderApi.getOrders({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: search.trim() || undefined,
        pageSize: 100,
      });
      setOrders(response.data.items);
    } catch {
      setToast({ show: true, message: 'Error al cargar los pedidos', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, search, statusFilter]);

  useEffect(() => {
    companyApi.getBranches().then((response) => setBranches(response.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 250);
    return () => clearTimeout(timeout);
  }, [fetchOrders]);

  const validate = (values: typeof emptyForm) => ({
    address: validateRequired(values.address, 'La dirección'),
    customerPhone: validatePhone(values.customerPhone),
  });

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      const response = await orderApi.createOrder({
        type: form.type as 'delivery' | 'pickup',
        address: form.address.trim(),
        customerName: form.customerName.trim() || undefined,
        customerPhone: form.customerPhone.trim() || undefined,
        channel: form.channel as 'whatsapp' | 'phone_call' | 'in_person',
        priority: form.priority as 'normal' | 'urgent',
        branchId: form.branchId || undefined,
        description: form.description.trim() || undefined,
      });
      const warning = response.data?.warning as string | undefined;
      setToast({
        show: true,
        message: warning
          ? 'Pedido creado, pero la dirección no se pudo geocodificar'
          : 'Pedido creado correctamente',
        variant: warning ? 'info' : 'success',
      });
      setForm(emptyForm);
      setShowForm(false);
      await fetchOrders();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al crear el pedido'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (order: Order) => {
    setEditingId(order.id);
    setEditForm({
      address: order.address,
      customerName: order.customerName ?? '',
      priority: order.priority,
    });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.address.trim() || editForm.address.trim().length < 5) {
      setToast({ show: true, message: 'La dirección debe tener al menos 5 caracteres', variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      await orderApi.updateOrder(id, {
        address: editForm.address.trim(),
        customerName: editForm.customerName.trim() || undefined,
        priority: editForm.priority as 'normal' | 'urgent',
      });
      setEditingId(null);
      setToast({ show: true, message: 'Pedido actualizado', variant: 'success' });
      await fetchOrders();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al actualizar el pedido'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      await orderApi.cancelOrder(cancelTarget.id);
      setToast({ show: true, message: 'Pedido cancelado', variant: 'success' });
      window.setTimeout(fetchOrders, 0);
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al cancelar el pedido'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startAssign = async (order: Order) => {
    setAssigningOrder(order);
    setSuggestions([]);
    setSelectedDriverId('');
    setAssignDate('');
    setLoadingSuggestions(true);
    try {
      const response = await orderApi.suggestDrivers(order.id);
      setSuggestions(response.data);
      if (response.data.length > 0) {
        setSelectedDriverId(response.data[0].driverId);
      }
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'No se pudieron sugerir conductores'), variant: 'error' });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAssign = async () => {
    if (!assigningOrder || !selectedDriverId) return;
    setSaving(true);
    try {
      await orderApi.assignOrder(assigningOrder.id, {
        driverId: selectedDriverId,
        routeDate: assignDate || undefined,
      });
      setToast({ show: true, message: 'Pedido asignado al conductor', variant: 'success' });
      setAssigningOrder(null);
      await fetchOrders();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al asignar el pedido'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = (order: Order) => order.status === 'pending' || order.status === 'assigned';

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Pedidos</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Registra, asigna y cancela los pedidos de la empresa
          </p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nuevo pedido
        </Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Registrar pedido</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Tipo"
                options={typeOptions}
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              />
              <Select
                label="Canal de ingreso"
                options={channelOptions}
                value={form.channel}
                onChange={(event) => setForm({ ...form, channel: event.target.value })}
              />
              <div className="md:col-span-2">
                <Input
                  label="Dirección"
                  icon="location_on"
                  placeholder="Calle 10 # 5-20, Ibagué"
                  value={form.address}
                  error={errors.address}
                  helperText="La dirección se geocodifica automáticamente"
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </div>
              <Input
                label="Cliente"
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
              />
              <Input
                label="Teléfono del cliente"
                icon="call"
                value={form.customerPhone}
                error={errors.customerPhone}
                onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
              />
              <Select
                label="Prioridad"
                options={priorityOptions}
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              />
              <Select
                label="Sede"
                options={[{ value: '', label: 'Sin sede' }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]}
                value={form.branchId}
                onChange={(event) => setForm({ ...form, branchId: event.target.value })}
              />
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label htmlFor="order-description" className="font-label-md text-label-md text-on-surface-variant">
                  Descripción
                </label>
                <textarea
                  id="order-description"
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg border-0 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                  placeholder="Detalles de la entrega"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={saving}>Guardar pedido</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {assigningOrder && (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Asignar pedido</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">{assigningOrder.address}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAssigningOrder(null)}>Cerrar</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSuggestions ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Buscando conductores...</p>
            ) : suggestions.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                No hay conductores disponibles en este momento.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <label
                      key={suggestion.driverId}
                      className={`flex items-center justify-between gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedDriverId === suggestion.driverId
                          ? 'bg-primary-fixed text-on-primary-fixed'
                          : 'bg-surface-container-low hover:bg-surface-container'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="suggested-driver"
                          className="accent-primary"
                          checked={selectedDriverId === suggestion.driverId}
                          onChange={() => setSelectedDriverId(suggestion.driverId)}
                        />
                        <div>
                          <span className="font-label-lg text-label-lg block">{suggestion.fullName}</span>
                          <span className="font-label-sm text-label-sm opacity-80">
                            {suggestion.phone || 'Sin teléfono'} · {suggestion.pendingStops} paradas pendientes
                          </span>
                        </div>
                      </div>
                      <span className="font-label-sm text-label-sm">
                        {formatDistance(suggestion.distanceMeters)}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Input
                    type="date"
                    label="Fecha de ruta"
                    value={assignDate}
                    onChange={(event) => setAssignDate(event.target.value)}
                  />
                  <Button onClick={handleAssign} loading={saving} disabled={!selectedDriverId}>
                    Asignar conductor
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            label="Buscar"
            icon="search"
            placeholder="Dirección o cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select label="Estado" options={statusOptions} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
          <Select
            label="Prioridad"
            options={priorityFilterOptions}
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">Cargando pedidos...</p>
          ) : orders.length === 0 ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">
              No hay pedidos que coincidan con los filtros.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {editingId === order.id ? (
                        <div className="min-w-[240px] space-y-2">
                          <Input
                            value={editForm.address}
                            onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
                          />
                          <Input
                            value={editForm.customerName}
                            placeholder="Cliente"
                            onChange={(event) => setEditForm({ ...editForm, customerName: event.target.value })}
                          />
                          <Select
                            label="Prioridad"
                            options={priorityOptions}
                            value={editForm.priority}
                            onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}
                          />
                        </div>
                      ) : (
                        <div>
                          <span className="font-label-lg text-label-lg block">{order.address}</span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {ORDER_TYPE_LABELS[order.type] ?? order.type} · {ORDER_CHANNEL_LABELS[order.channel] ?? order.channel}
                            {order.latitude === null && ' · Sin coordenadas'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="block">{order.customerName || 'Sin nombre'}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">{order.customerPhone || 'Sin teléfono'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.priority === 'urgent' ? 'error' : 'neutral'}>
                        {ORDER_PRIORITY_LABELS[order.priority] ?? order.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={orderStatusVariant(order.status)}>
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.branch?.name ?? 'Sin sede'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editingId === order.id ? (
                          <>
                            <Button size="sm" onClick={() => handleUpdate(order.id)} loading={saving}>Guardar</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            {canEdit(order) && (
                              <Button size="sm" variant="ghost" onClick={() => startEdit(order)}>Editar</Button>
                            )}
                            {order.status === 'pending' && (
                              <Button size="sm" variant="ghost" onClick={() => startAssign(order)}>Asignar</Button>
                            )}
                            {canEdit(order) && (
                              <Button size="sm" variant="ghost" onClick={() => setCancelTarget(order)}>Cancelar</Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancelar pedido"
        description={cancelTarget?.address}
        confirmLabel="Sí, cancelar"
        confirmVariant="destructive"
        onConfirm={handleCancel}
      >
        <p className="font-body-md text-body-md text-on-surface-variant">
          El pedido quedará cancelado y se retirará de la ruta asignada.
        </p>
      </Modal>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
