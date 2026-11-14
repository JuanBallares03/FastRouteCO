import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Modal';
import { companyApi } from '@/features/company/api';
import { orderApi } from '@/features/orders/api';
import { routeApi } from '@/features/routes/api';
import { studentApi } from '@/features/students/api';
import { getApiErrorMessage } from '@/lib/company-validation';
import {
  ORDER_PRIORITY_LABELS,
  ROUTE_STATUS_LABELS,
  formatDistance,
  formatDuration,
  routeStatusVariant,
  todayInBogota,
} from '@/lib/order-utils';

interface RouteOrder {
  id: string;
  address: string;
  customerName?: string | null;
  priority: string;
}

interface RouteStop {
  id: string;
  sequence: number;
  status: string;
  order?: RouteOrder | null;
}

interface Route {
  id: string;
  routeDate: string;
  status: string;
  driver?: {
    user?: { fullName?: string | null } | null;
  } | null;
  stops: RouteStop[];
  optimizations?: Array<{
    totalDistanceM: number | null;
    estimatedDurationS: number | null;
    isSuccessful: boolean;
  }>;
}

interface PendingOrder {
  id: string;
  address: string;
  customerName?: string | null;
  priority: string;
}

interface Student {
  id: string;
  fullName: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
}

interface Driver {
  id: string;
  fullName: string;
  status: string;
}

export function RoutesPage() {
  const location = useLocation();
  const basePath = location.pathname.replace(/\/$/, '');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolEnabled, setSchoolEnabled] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [date, setDate] = useState(todayInBogota());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ driverId: '', routeDate: todayInBogota() });
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({
    show: false,
    message: '',
    variant: 'success',
  });

  const fetchRoutes = useCallback(async () => {
    try {
      const response = await routeApi.getRoutes({
        date: date || undefined,
        pageSize: 100,
      });
      setRoutes(response.data.items);
    } catch {
      setToast({ show: true, message: 'Error al cargar las rutas', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const loadFormData = useCallback(async () => {
    try {
      const [ordersResponse, driversResponse] = await Promise.all([
        orderApi.getOrders({ status: 'pending', pageSize: 100 }),
        companyApi.getDrivers(),
      ]);
      setPendingOrders(ordersResponse.data.items);
      setDrivers(driversResponse.data);
    } catch {
      setToast({ show: true, message: 'Error al cargar pedidos y conductores', variant: 'error' });
    }

    try {
      const entitlement = await studentApi.getEntitlement();
      const enabled = Boolean(entitlement.data?.enabled);
      setSchoolEnabled(enabled);
      if (enabled) {
        const studentsResponse = await studentApi.list({ active: 'true' });
        setStudents(studentsResponse.data as Student[]);
      } else {
        setStudents([]);
      }
    } catch {
      setSchoolEnabled(false);
      setStudents([]);
    }
  }, []);

  const toggleForm = () => {
    setShowForm((value) => !value);
    if (!showForm) {
      setForm({ driverId: '', routeDate: todayInBogota() });
      setSelectedOrderIds([]);
      setSelectedStudentIds([]);
      loadFormData();
    }
  };

  const toggleOrder = (id: string) => {
    setSelectedOrderIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.driverId) {
      setToast({ show: true, message: 'Selecciona un conductor', variant: 'error' });
      return;
    }
    if (selectedOrderIds.length + selectedStudentIds.length === 0) {
      setToast({
        show: true,
        message: 'Selecciona al menos un pedido o estudiante',
        variant: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await routeApi.createRoute({
        driverId: form.driverId,
        routeDate: form.routeDate,
        orderIds: selectedOrderIds,
        studentIds: selectedStudentIds,
      });
      if (response.data?.driverAvailable === false) {
        setToast({ show: true, message: 'Ruta creada, pero el conductor no está disponible', variant: 'success' });
      } else {
        setToast({ show: true, message: 'Ruta creada correctamente', variant: 'success' });
      }
      setShowForm(false);
      setSelectedOrderIds([]);
      setSelectedStudentIds([]);
      await fetchRoutes();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al crear la ruta'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const driverOptions = [
    { value: '', label: 'Selecciona un conductor' },
    ...drivers.map((driver) => ({
      value: driver.id,
      label: `${driver.fullName} (${driver.status === 'available' ? 'Disponible' : driver.status === 'on_route' ? 'En ruta' : 'No disponible'})`,
    })),
  ];

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Rutas</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Crea rutas diarias y consulta su secuencia de paradas
          </p>
        </div>
        <Button onClick={toggleForm}>
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nueva ruta
        </Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Crear ruta</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Conductor"
                  options={driverOptions}
                  value={form.driverId}
                  onChange={(event) => setForm({ ...form, driverId: event.target.value })}
                />
                <Input
                  type="date"
                  label="Fecha de la ruta"
                  value={form.routeDate}
                  onChange={(event) => setForm({ ...form, routeDate: event.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-md text-label-md text-on-surface-variant">Pedidos pendientes</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {selectedOrderIds.length} seleccionados
                  </span>
                </div>
                {pendingOrders.length === 0 ? (
                  <p className="p-4 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface-variant">
                    No hay pedidos pendientes para asignar.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-outline/50 divide-y divide-surface-container">
                    {pendingOrders.map((order) => (
                      <label key={order.id} className="flex items-center justify-between gap-4 p-3 cursor-pointer hover:bg-surface-container-low">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={() => toggleOrder(order.id)}
                          />
                          <div>
                            <span className="font-label-lg text-label-lg block">{order.address}</span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              {order.customerName || 'Sin nombre'}
                            </span>
                          </div>
                        </div>
                        <Badge variant={order.priority === 'urgent' ? 'error' : 'neutral'}>
                          {ORDER_PRIORITY_LABELS[order.priority] ?? order.priority}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {schoolEnabled && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      Estudiantes de transporte escolar
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {selectedStudentIds.length} seleccionados
                    </span>
                  </div>
                  {students.length === 0 ? (
                    <p className="p-4 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface-variant">
                      No hay estudiantes activos para asignar.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-outline/50 divide-y divide-surface-container">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center justify-between gap-4 p-3 cursor-pointer hover:bg-surface-container-low"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                            />
                            <div>
                              <span className="font-label-lg text-label-lg block">
                                {student.fullName}
                              </span>
                              <span className="font-label-sm text-label-sm text-on-surface-variant">
                                {student.pickupAddress}
                              </span>
                            </div>
                          </div>
                          <Badge variant={student.latitude === null ? 'error' : 'neutral'}>
                            {student.latitude === null ? 'Sin coordenadas' : 'Geolocalizado'}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" loading={saving}>Crear ruta</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs">
            <Input
              type="date"
              label="Fecha"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <Button variant="ghost" onClick={() => setDate('')}>Ver todas</Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">Cargando rutas...</p>
          ) : routes.length === 0 ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">
              No hay rutas para los filtros seleccionados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Paradas</TableHead>
                  <TableHead>Distancia</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => {
                  const optimization = route.optimizations?.[0];
                  const completedStops = route.stops.filter((stop) => stop.status === 'completed').length;
                  return (
                    <TableRow key={route.id}>
                      <TableCell>
                        {route.driver?.user?.fullName ?? 'Sin conductor'}
                      </TableCell>
                      <TableCell>{route.routeDate.slice(0, 10)}</TableCell>
                      <TableCell>{completedStops} de {route.stops.length}</TableCell>
                      <TableCell>{formatDistance(optimization?.totalDistanceM)}</TableCell>
                      <TableCell>{formatDuration(optimization?.estimatedDurationS)}</TableCell>
                      <TableCell>
                        <Badge variant={routeStatusVariant(route.status)}>
                          {ROUTE_STATUS_LABELS[route.status] ?? route.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`${basePath}/${route.id}`}
                          className="font-label-lg text-label-lg text-primary hover:underline"
                        >
                          Ver detalle
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
