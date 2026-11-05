import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Modal';
import { companyApi } from '@/services/api';
import { getApiErrorMessage, validateRequired } from '@/lib/company-validation';

interface Branch {
  id: string;
  name: string;
  address?: string | null;
}

interface CompanyProfile {
  activeSubscription?: { plan?: { maxBranches?: number | null } } | null;
}

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [maxBranches, setMaxBranches] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', address: '' });
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
      const [branchesResponse, profileResponse] = await Promise.all([
        companyApi.getBranches(),
        companyApi.getProfile(),
      ]);
      setBranches(branchesResponse.data);
      setMaxBranches((profileResponse.data as CompanyProfile).activeSubscription?.plan?.maxBranches ?? null);
    } catch {
      setToast({ show: true, message: 'Error al cargar las sedes', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const nameError = validateRequired(form.name, 'Nombre de la sede');
    setErrors({ name: nameError });
    if (nameError) return;

    setSaving(true);
    try {
      await companyApi.createBranch({ name: form.name.trim(), address: form.address || undefined });
      setForm({ name: '', address: '' });
      setShowForm(false);
      setToast({ show: true, message: 'Sede registrada correctamente', variant: 'success' });
      await fetchData();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al registrar la sede'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (branch: Branch) => {
    setEditingId(branch.id);
    setEditForm({ name: branch.name, address: branch.address ?? '' });
  };

  const handleUpdate = async (id: string) => {
    const nameError = validateRequired(editForm.name, 'Nombre de la sede');
    if (nameError) {
      setToast({ show: true, message: nameError, variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      await companyApi.updateBranch(id, { name: editForm.name.trim(), address: editForm.address || undefined });
      setEditingId(null);
      setToast({ show: true, message: 'Sede actualizada correctamente', variant: 'success' });
      await fetchData();
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al actualizar la sede'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const limitReached = maxBranches !== null && branches.length >= maxBranches;

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Sedes</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Registra y administra las sedes de tu empresa (HU-26, RF23).
          </p>
        </div>
        <Button onClick={() => setShowForm((prev) => !prev)} disabled={limitReached}>
          <span className="material-symbols-outlined text-[20px]">add_location</span>
          Nueva sede
        </Button>
      </header>

      <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]">info</span>
        {maxBranches === null
          ? 'Tu plan no limita el número de sedes.'
          : `${branches.length} de ${maxBranches} sedes permitidas por el plan activo.`}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Registrar sede</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <Input
                label="Nombre"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                error={errors.name}
                icon="location_city"
              />
              <Input
                label="Dirección"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                icon="location_on"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={saving}>Guardar</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">Cargando sedes...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-on-surface-variant">
                      Aún no hay sedes registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch) => (
                    <TableRow key={branch.id}>
                      {editingId === branch.id ? (
                        <>
                          <TableCell>
                            <Input
                              aria-label="Nombre de la sede"
                              value={editForm.name}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label="Dirección de la sede"
                              value={editForm.address}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
                            />
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" loading={saving} onClick={() => handleUpdate(branch.id)}>Guardar</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-label-lg text-label-lg text-on-surface">{branch.name}</TableCell>
                          <TableCell className="text-on-surface-variant">{branch.address || 'No registrada'}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="secondary" onClick={() => startEdit(branch)}>
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              Editar
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
