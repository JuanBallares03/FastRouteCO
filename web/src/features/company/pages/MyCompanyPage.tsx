import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Modal';
import { companyApi } from '@/features/company/api';
import { getApiErrorMessage, validateEmail, validatePhone } from '@/lib/company-validation';

interface CompanyProfile {
  id: string;
  legalName: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
  status: string;
  branchesCount?: number;
  usersCount?: number;
  activeSubscription?: {
    plan?: { name?: string; maxDrivers?: number | null; maxBranches?: number | null };
  } | null;
}

export function MyCompanyPage() {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [form, setForm] = useState({ email: '', phone: '', address: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({
    show: false,
    message: '',
    variant: 'success',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await companyApi.getProfile();
        const data = response.data as CompanyProfile;
        setCompany(data);
        setForm({ email: data.email ?? '', phone: data.phone ?? '', address: data.address ?? '' });
      } catch {
        setToast({ show: true, message: 'Error al cargar la empresa', variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({
      ...prev,
      [name]: name === 'email' ? validateEmail(value) : name === 'phone' ? validatePhone(value) : '',
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const nextErrors = { email: validateEmail(form.email), phone: validatePhone(form.phone) };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.phone) return;

    setSaving(true);
    try {
      const response = await companyApi.updateProfile({
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setCompany((prev) => (prev ? { ...prev, ...response.data } : prev));
      setToast({ show: true, message: 'Datos de la empresa actualizados', variant: 'success' });
    } catch (error) {
      setToast({ show: true, message: getApiErrorMessage(error, 'Error al guardar los datos'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-body-md text-body-md text-on-surface-variant">Cargando empresa...</span>
      </div>
    );
  }

  if (!company) {
    return <p className="font-body-md text-body-md text-error">Empresa no encontrada.</p>;
  }

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Mi empresa</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Consulta y actualiza los datos de contacto de tu empresa (HU-24).
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Datos de contacto</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Razón social" value={company.legalName} disabled />
                <Input label="NIT" value={company.taxId} disabled />
                <Input
                  label="Correo electrónico"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  error={errors.email}
                  icon="mail"
                />
                <Input
                  label="Teléfono"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  error={errors.phone}
                  icon="call"
                />
              </div>
              <Input
                label="Dirección"
                name="address"
                value={form.address}
                onChange={handleChange}
                icon="location_on"
              />
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Guardar cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Resumen</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant">Estado</span>
              <Badge variant={company.status === 'active' ? 'success' : 'error'}>
                {company.status === 'active' ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant">Plan</span>
              <span className="font-label-lg text-label-lg text-on-surface">
                {company.activeSubscription?.plan?.name ?? 'Sin plan'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant">Sedes</span>
              <span className="font-label-lg text-label-lg text-on-surface">{company.branchesCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant">Usuarios</span>
              <span className="font-label-lg text-label-lg text-on-surface">{company.usersCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

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
