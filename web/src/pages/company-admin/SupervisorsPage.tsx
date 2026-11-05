import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { Toast } from '@/components/ui/Modal';
import { companyApi } from '@/services/api';
import { getApiErrorMessage, validateEmail, validatePhone, validateRequired } from '@/lib/company-validation';

interface Supervisor {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { fullName: '', email: '', phone: '' };

export function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({
    show: false,
    message: '',
    variant: 'success',
  });

  const fetchSupervisors = async () => {
    try {
      const response = await companyApi.getSupervisors();
      setSupervisors(response.data);
    } catch {
      setToast({ show: true, message: 'Error al cargar los supervisores', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const validate = () => ({
    fullName: validateRequired(form.fullName, 'Nombre completo'),
    email: validateEmail(form.email),
    phone: validatePhone(form.phone),
  });

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      await companyApi.createSupervisor({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      setToast({ show: true, message: 'Supervisor creado y acceso enviado por correo', variant: 'success' });
      await fetchSupervisors();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al crear el supervisor'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (supervisor: Supervisor) => {
    try {
      await companyApi.updateSupervisorStatus(supervisor.id, !supervisor.isActive);
      setSupervisors((prev) =>
        prev.map((item) => (item.id === supervisor.id ? { ...item, isActive: !supervisor.isActive } : item))
      );
      setToast({
        show: true,
        message: `Supervisor ${supervisor.isActive ? 'desactivado' : 'reactivado'}`,
        variant: 'success',
      });
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al cambiar el estado'), variant: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Supervisores</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Crea y administra los supervisores de logística de tu empresa (HU-25).
          </p>
        </div>
        <Button onClick={() => setShowForm((prev) => !prev)}>
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Nuevo supervisor
        </Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Crear supervisor</h2>
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
              Se enviará una invitación por correo para que el supervisor defina su contraseña.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">Cargando supervisores...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Correo electrónico</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-on-surface-variant">
                      Aún no hay supervisores registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  supervisors.map((supervisor) => (
                    <TableRow key={supervisor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={supervisor.fullName} size="md" />
                          <span className="font-label-lg text-label-lg text-on-surface">{supervisor.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-code-tracking text-code-tracking">{supervisor.email}</TableCell>
                      <TableCell className="text-on-surface-variant">{supervisor.phone || 'No registrado'}</TableCell>
                      <TableCell>
                        <Badge variant={supervisor.isActive ? 'success' : 'error'}>
                          {supervisor.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={supervisor.isActive ? 'secondary' : 'success'}
                          onClick={() => toggleStatus(supervisor)}
                        >
                          {supervisor.isActive ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </TableCell>
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
