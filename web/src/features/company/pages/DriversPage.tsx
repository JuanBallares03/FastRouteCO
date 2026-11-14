import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { Toast } from '@/components/ui/Modal';
import { companyApi } from '@/features/company/api';
import {
  DRIVER_STATUS_LABELS,
  getApiErrorMessage,
  validateEmail,
  validatePhone,
  validateRequired,
  type DriverStatus,
} from '@/lib/company-validation';

interface Driver {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  status: DriverStatus;
}

interface CompanyProfile {
  activeSubscription?: { plan?: { maxDrivers?: number | null } } | null;
}

const emptyForm = { fullName: '', email: '', phone: '' };

const statusBadgeVariant: Record<DriverStatus, 'success' | 'warning' | 'neutral'> = {
  available: 'success',
  on_route: 'warning',
  unavailable: 'neutral',
};

export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maxDrivers, setMaxDrivers] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({
    show: false,
    message: '',
    variant: 'success',
  });

  const fetchData = async () => {
    try {
      const [driversResponse, profileResponse] = await Promise.all([
        companyApi.getDrivers(),
        companyApi.getProfile(),
      ]);
      setDrivers(driversResponse.data);
      setMaxDrivers((profileResponse.data as CompanyProfile).activeSubscription?.plan?.maxDrivers ?? null);
    } catch {
      setToast({ show: true, message: 'Error al cargar los conductores', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const validate = (values: typeof emptyForm) => ({
    fullName: validateRequired(values.fullName, 'Nombre completo'),
    email: validateEmail(values.email),
    phone: validatePhone(values.phone),
  });

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      await companyApi.createDriver({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      setToast({ show: true, message: 'Conductor creado y acceso enviado por correo', variant: 'success' });
      await fetchData();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al crear el conductor'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setEditForm({ fullName: driver.fullName, email: driver.email, phone: driver.phone ?? '' });
  };

  const handleUpdate = async (id: string) => {
    const nextErrors = validate(editForm);
    if (Object.values(nextErrors).some(Boolean)) {
      setToast({ show: true, message: 'Revisa los datos del conductor', variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      await companyApi.updateDriver(id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone || undefined,
      });
      setEditingId(null);
      setToast({ show: true, message: 'Conductor actualizado', variant: 'success' });
      await fetchData();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al actualizar el conductor'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (driver: Driver) => {
    try {
      await companyApi.updateDriverStatus(driver.id, !driver.isActive);
      setDrivers((prev) =>
        prev.map((item) => (item.id === driver.id ? { ...item, isActive: !driver.isActive } : item))
      );
      setToast({ show: true, message: `Conductor ${driver.isActive ? 'desactivado' : 'reactivado'}`, variant: 'success' });
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al cambiar el estado'), variant: 'error' });
    }
  };

  const changeAvailability = async (driver: Driver, status: DriverStatus) => {
    try {
      await companyApi.updateDriverAvailability(driver.id, status);
      setDrivers((prev) => prev.map((item) => (item.id === driver.id ? { ...item, status } : item)));
      setToast({ show: true, message: 'Disponibilidad actualizada', variant: 'success' });
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al actualizar la disponibilidad'), variant: 'error' });
    }
  };

  const limitReached = maxDrivers !== null && drivers.length >= maxDrivers;

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Conductores</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Registra y administra la flota de conductores de tu empresa (HU-27, RF03).
          </p>
        </div>
        <Button onClick={() => setShowForm((prev) => !prev)} disabled={limitReached}>
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Nuevo conductor
        </Button>
      </header>

      <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]">info</span>
        {maxDrivers === null
          ? 'Tu plan no limita el número de conductores.'
          : `${drivers.length} de ${maxDrivers} conductores permitidos por el plan activo.`}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Registrar conductor</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <Input
                label="Nombre completo"
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                error={errors.fullName}
                icon="person"
              />
              <Input
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                error={errors.email}
                icon="mail"
              />
              <Input
                label="Teléfono"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                error={errors.phone}
                icon="call"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={saving}>Guardar</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
              Se enviará una invitación por correo para que el conductor acceda a la app móvil.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">Cargando conductores...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Correo electrónico</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Disponibilidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-on-surface-variant">
                      Aún no hay conductores registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      {editingId === driver.id ? (
                        <>
                          <TableCell>
                            <Input
                              aria-label="Nombre del conductor"
                              value={editForm.fullName}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label="Correo del conductor"
                              value={editForm.email}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label="Teléfono del conductor"
                              value={editForm.phone}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                            />
                          </TableCell>
                          <TableCell colSpan={3} className="text-right space-x-2">
                            <Button size="sm" loading={saving} onClick={() => handleUpdate(driver.id)}>Guardar</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar name={driver.fullName} size="md" />
                              <span className="font-label-lg text-label-lg text-on-surface">{driver.fullName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-code-tracking text-code-tracking">{driver.email}</TableCell>
                          <TableCell className="text-on-surface-variant">{driver.phone || 'No registrado'}</TableCell>
                          <TableCell>
                            <Select
                              label=""
                              aria-label={`Disponibilidad de ${driver.fullName}`}
                              value={driver.status}
                              options={Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                              onChange={(event) => changeAvailability(driver, event.target.value as DriverStatus)}
                              className="h-9"
                            />
                            <Badge variant={statusBadgeVariant[driver.status]} className="mt-1">
                              {DRIVER_STATUS_LABELS[driver.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={driver.isActive ? 'success' : 'error'}>
                              {driver.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="secondary" onClick={() => startEdit(driver)}>
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={driver.isActive ? 'secondary' : 'success'}
                              onClick={() => toggleStatus(driver)}
                            >
                              {driver.isActive ? 'Desactivar' : 'Reactivar'}
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.variant === 'success' ? 'Éxito' : 'Error'}
        description={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
