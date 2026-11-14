import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { studentApi } from '@/features/students/api';
import { getApiErrorMessage } from '@/lib/company-validation';

interface Student {
  id: string;
  fullName: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

interface Entitlement {
  enabled: boolean;
  reason: string | null;
}

export function StudentsPage() {
  const location = useLocation();
  const isCompanyAdmin = location.pathname.startsWith('/company');
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeFilter, setActiveFilter] = useState('true');
  const [form, setForm] = useState({ fullName: '', pickupAddress: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({ show: false, message: '', variant: 'error' });

  const loadStudents = useCallback(async () => {
    try {
      const response = await studentApi.list({
        active: activeFilter || undefined,
      });
      setStudents(response.data as Student[]);
    } catch {
      setToast({ show: true, message: 'No se pudieron cargar los estudiantes', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    studentApi
      .getEntitlement()
      .then((response) => {
        const data = response.data as Entitlement;
        setEntitlement(data);
        if (!data.enabled) setLoading(false);
      })
      .catch(() => {
        setEntitlement({ enabled: false, reason: 'No se pudo verificar el módulo escolar.' });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (entitlement?.enabled) loadStudents();
  }, [entitlement?.enabled, loadStudents]);

  const resetForm = () => {
    setForm({ fullName: '', pickupAddress: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (student: Student) => {
    setForm({ fullName: student.fullName, pickupAddress: student.pickupAddress });
    setEditingId(student.id);
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = editingId
        ? await studentApi.update(editingId, {
            fullName: form.fullName.trim(),
            pickupAddress: form.pickupAddress.trim(),
          })
        : await studentApi.create({
            fullName: form.fullName.trim(),
            pickupAddress: form.pickupAddress.trim(),
          });

      if (response.data?.warning) {
        setToast({ show: true, message: response.data.warning, variant: 'info' });
      } else {
        setToast({
          show: true,
          message: editingId ? 'Estudiante actualizado' : 'Estudiante registrado',
          variant: 'success',
        });
      }
      resetForm();
      await loadStudents();
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo guardar el estudiante'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (student: Student) => {
    try {
      await studentApi.updateStatus(student.id, !student.isActive);
      setToast({
        show: true,
        message: student.isActive ? 'Estudiante desactivado' : 'Estudiante activado',
        variant: 'success',
      });
      await loadStudents();
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo cambiar el estado'),
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Estudiantes</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Registra estudiantes y sus puntos de recogida para las rutas escolares.
          </p>
        </div>
        {entitlement?.enabled && (
          <Button
            onClick={() => {
              resetForm();
              setShowForm((value) => !value);
            }}
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Nuevo estudiante
          </Button>
        )}
      </header>

      {entitlement && !entitlement.enabled ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Badge variant="warning">Módulo no habilitado</Badge>
            <p className="font-body-md text-body-md text-on-surface">
              {entitlement.reason ?? 'El módulo de transporte escolar no está habilitado.'}
            </p>
            {isCompanyAdmin && (
              <Link to="/company/billing" className="font-label-lg text-label-lg text-primary hover:underline">
                Ir a Suscripción y créditos
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {showForm && (
            <Card>
              <CardHeader>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  {editingId ? 'Editar estudiante' : 'Registrar estudiante'}
                </h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nombre completo"
                      value={form.fullName}
                      maxLength={150}
                      onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    />
                    <Input
                      label="Dirección de recogida"
                      value={form.pickupAddress}
                      maxLength={255}
                      onChange={(event) =>
                        setForm({ ...form, pickupAddress: event.target.value })
                      }
                      icon="location_on"
                    />
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Las coordenadas del punto de recogida se obtienen automáticamente de la dirección.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      loading={saving}
                      disabled={
                        form.fullName.trim().length < 3 ||
                        form.pickupAddress.trim().length < 5
                      }
                    >
                      {editingId ? 'Guardar cambios' : 'Registrar estudiante'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Listado de estudiantes
              </h2>
              <div className="w-48">
                <Select
                  label="Estado"
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value)}
                  options={[
                    { value: 'true', label: 'Activos' },
                    { value: 'false', label: 'Inactivos' },
                    { value: '', label: 'Todos' },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="p-6 font-body-md text-body-md text-on-surface-variant">
                  Cargando estudiantes...
                </p>
              ) : students.length === 0 ? (
                <p className="p-6 font-body-md text-body-md text-on-surface-variant">
                  No hay estudiantes con el filtro seleccionado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Dirección de recogida</TableHead>
                      <TableHead>Coordenadas</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.fullName}</TableCell>
                        <TableCell>{student.pickupAddress}</TableCell>
                        <TableCell>
                          {student.latitude !== null && student.longitude !== null ? (
                            `${student.latitude.toFixed(5)}, ${student.longitude.toFixed(5)}`
                          ) : (
                            <span className="text-error">Sin coordenadas</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.isActive ? 'success' : 'neutral'}>
                            {student.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(student)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={student.isActive ? 'destructive' : 'success'}
                              onClick={() => toggleStatus(student)}
                            >
                              {student.isActive ? 'Desactivar' : 'Activar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
