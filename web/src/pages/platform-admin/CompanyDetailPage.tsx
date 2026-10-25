import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, Toast } from '@/components/ui/Modal';
import { platformApi } from '@/services/api';

interface Company {
  id: string;
  legalName: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  planName: string;
  isActive: boolean;
  subscriptionStatus: string;
  trialDaysRemaining?: number;
  createdAt: string;
  hasOwnFleet: boolean;
  admins: Admin[];
}

interface Admin {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  isPrimary: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  'free-trial': 'Free Trial',
  'basic': 'Básico',
  'pro': 'Pro',
  'premium': 'Premium',
  'pay-per-use': 'Pago por uso',
};

const STATUS_BADGE_VARIANTS: Record<string, 'success' | 'error'> = {
  'true': 'success',
  'false': 'error',
};

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ fullName: '', email: '', phone: '' });
  const [adminErrors, setAdminErrors] = useState<Record<string, string>>({});
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [companyActive, setCompanyActive] = useState(true);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    if (id) fetchCompany();
  }, [id]);

  const fetchCompany = async () => {
    setLoading(true);
    try {
      const response = await platformApi.getCompany(id!);
      const data = response.data;
      setCompany(data);
      setCompanyActive(data.isActive);
    } catch {
      console.error('Error fetching company:');
      setToast({ show: true, message: 'Error al cargar la empresa', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'bg-primary-container text-on-primary',
      'bg-secondary-fixed text-on-secondary-fixed',
      'bg-surface-container-high text-on-surface',
      'bg-primary-fixed-dim text-on-primary-fixed-variant',
      'bg-secondary-container text-on-secondary-container',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleStatusToggle = () => {
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    if (!company) return;
    try {
      await platformApi.updateCompanyStatus(company.id, !companyActive);
      setCompanyActive(!companyActive);
      setCompany((prev) => prev ? { ...prev, isActive: !companyActive } : null);
      setToast({ show: true, message: `Empresa ${companyActive ? 'desactivada' : 'reactivada'} correctamente`, variant: 'success' });
    } catch {
      setToast({ show: true, message: `Error al ${companyActive ? 'desactivar' : 'reactivar'} la empresa`, variant: 'error' });
    } finally {
      setShowStatusModal(false);
    }
  };

  const validateAdminField = (name: string, value: string): string => {
    switch (name) {
      case 'fullName':
        if (!value.trim()) return 'El nombre completo es obligatorio';
        if (value.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
        return '';
      case 'email':
        if (!value.trim()) return 'El correo electrónico es obligatorio';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Formato de correo inválido';
        return '';
      case 'phone':
        if (value.trim() && value.trim().length < 10) return 'Número de teléfono inválido';
        return '';
      default:
        return '';
    }
  };

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminForm((prev) => ({ ...prev, [name]: value }));
    const error = validateAdminField(name, value);
    setAdminErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    Object.keys(adminForm).forEach((key) => {
      const error = validateAdminField(key, adminForm[key as keyof typeof adminForm]);
      if (error) newErrors[key] = error;
    });

    setAdminErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setSavingAdmin(true);
    try {
      await platformApi.createCompanyAdmin(company!.id, adminForm);
      setToast({ show: true, message: 'Administrador creado y acceso enviado por correo', variant: 'success' });
      setShowAdminForm(false);
      setAdminForm({ fullName: '', email: '', phone: '' });
      fetchCompany();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || 'Error al crear el administrador';
      setToast({ show: true, message, variant: 'error' });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleAdminStatusChange = async (admin: Admin) => {
    try {
      await platformApi.updateAdminStatus(company!.id, admin.id, !admin.isActive);
      setCompany((prev) => prev ? {
        ...prev,
        admins: prev.admins.map(a => a.id === admin.id ? { ...a, isActive: !admin.isActive } : a)
      } : null);
      setToast({ show: true, message: `Administrador ${admin.isActive ? 'desactivado' : 'reactivado'}`, variant: 'success' });
    } catch {
      setToast({ show: true, message: 'Error al cambiar el estado del administrador', variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-body-md text-body-md text-on-surface-variant">Cargando empresa...</span>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-6xl text-outline-variant">error</span>
        <h2 className="font-headline-md text-headline-md text-on-surface mt-4">Empresa no encontrada</h2>
        <Link to="/platform/companies">
          <Button variant="secondary" className="mt-4">Volver al listado</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <nav aria-label="Ruta de navegación" className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
        <Link to="/platform/companies" className="hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">apartment</span>
          <span>Empresas</span>
        </Link>
        <span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
        <span className="text-on-surface font-label-lg text-label-lg truncate max-w-xs md:max-w-md">{company.legalName}</span>
      </nav>

      <div className="relative bg-surface-container-lowest rounded-xl p-6 shadow-sm overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-secondary-fixed/40 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 rounded-full bg-surface-container-high/60 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-[36px]">local_shipping</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{company.legalName}</h1>
                <Badge variant="success">Cuenta activa en red</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-on-surface-variant font-label-md text-label-md">
                <span className="flex items-center gap-1 text-on-surface font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-secondary">badge</span>
                  NIT: <span className="font-code-tracking text-code-tracking text-on-surface font-normal">{company.taxId}</span>
                </span>
                <span className="text-outline-variant">•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">pin_drop</span>
                  Sede {company.city || 'Sin ciudad'}
                </span>
                <span className="text-outline-variant">•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-tertiary">calendar_today</span>
                  Vinculada: {formatDate(company.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button 
              variant={companyActive ? 'secondary' : 'primary'} 
              onClick={handleStatusToggle}
              className="group"
            >
              <span className="material-symbols-outlined text-[20px] text-error group-hover:scale-110 transition-transform">{companyActive ? 'block' : 'check_circle'}</span>
              <span className="font-label-lg text-label-lg">{companyActive ? 'Desactivar empresa' : 'Reactivar empresa'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <Card className="lg:col-span-7 xl:col-span-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">domain</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Información general de la empresa</h2>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Registro mercantil y datos de despacho fiscal</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-x divide-surface-container">
              <div className="p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Razón Social</span>
                <span className="font-label-lg text-label-lg text-on-surface font-semibold block mt-1">{company.legalName}</span>
              </div>
              <div className="p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Número de Identificación Tributaria</span>
                <span className="font-code-tracking text-code-tracking text-primary font-semibold block mt-1">{company.taxId}</span>
              </div>
              <div className="p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Correo Electrónico Oficial</span>
                <a href={`mailto:${company.email}`} className="font-label-lg text-label-lg text-secondary hover:underline flex items-center gap-1.5 truncate block mt-1">
                  <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                  {company.email}
                </a>
              </div>
              <div className="p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Teléfonos de Despacho</span>
                <span className="font-code-tracking text-code-tracking text-on-surface flex items-center gap-1.5 block mt-1">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">call</span>
                  {company.phone || 'No registrado'}
                </span>
              </div>
              <div className="md:col-span-2 p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Dirección de Operación Central</span>
                <div className="flex items-center gap-1.5 text-on-surface font-body-md text-body-md mt-1">
                  <span className="material-symbols-outlined text-[18px] text-secondary">location_on</span>
                  <span>{company.address || 'No registrada'}, {company.city || 'Sin ciudad'}, Tolima</span>
                </div>
              </div>
              <div className="p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Estado en el Sistema</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-label-lg text-label-lg text-on-surface font-medium">Operatividad</span>
                  <Badge variant={STATUS_BADGE_VARIANTS[String(company.isActive)]}>
                    {company.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Conductores Propios</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-label-lg text-label-lg text-on-surface font-medium">{company.hasOwnFleet ? 'Habilitado y confirmado' : 'No habilitado'}</span>
                  <Avatar className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary" name="verified">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </Avatar>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 xl:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Plan y suscripción</h2>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Facturación recurrente Colombia</p>
                </div>
              </div>
              <Badge variant="success">Activa</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-surface-container-high to-surface-container relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-secondary-fixed/50 rounded-full blur-xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Nivel corporativo</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Renovación automática</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">Plan {PLAN_LABELS[company.planName] || company.planName}</span>
                  <span className="font-body-md text-body-md text-on-surface-variant">/ Hasta 10 conductores incluidos</span>
                </div>
                <div className="pt-2 mt-2 flex items-center justify-between border-t border-outline/50 text-on-surface">
                  <span className="font-label-md text-label-md text-on-surface-variant">Modalidad:</span>
                  <span className="font-label-lg text-label-lg font-semibold">Mensual</span>
                </div>
                <div className="flex items-center justify-between text-on-surface">
                  <span className="font-label-md text-label-md text-on-surface-variant">Tarifa comercial:</span>
                  <span className="font-code-tracking text-code-tracking text-primary font-bold">$280.000 COP <span className="font-label-sm text-label-sm text-on-surface-variant font-normal">/ mes</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mt-0.5">
              <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
            </div>
            <div className="flex flex-col">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Administradores de la empresa</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Usuarios con permisos completos para gestionar la cuenta corporativa, nómina de supervisores y rutas de despacho.</p>
            </div>
          </div>
          <Button onClick={() => setShowAdminForm(true)}>
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Crear administrador
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {showAdminForm && (
            <div className="p-6 border-b border-outline/50 animate-in">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">badge</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Crear nuevo administrador</h3>
                </div>
                <button onClick={() => setShowAdminForm(false)} className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Nombre completo"
                    placeholder="Ej. Carlos Alberto Gómez Pardo"
                    name="fullName"
                    value={adminForm.fullName}
                    onChange={handleAdminChange}
                    error={adminErrors.fullName}
                    required
                    icon="person"
                  />
                  <Input
                    label="Correo electrónico"
                    placeholder="cgomez@ibaguelogistica.com.co"
                    name="email"
                    type="email"
                    value={adminForm.email}
                    onChange={handleAdminChange}
                    error={adminErrors.email}
                    required
                    icon="mail"
                  />
                  <Input
                    label="Teléfono móvil"
                    placeholder="310 987 6543"
                    name="phone"
                    type="tel"
                    value={adminForm.phone}
                    onChange={handleAdminChange}
                    error={adminErrors.phone}
                    icon="smartphone"
                  />
                </div>
                <div className="p-3 px-4 rounded-lg bg-surface-container flex items-center gap-3 text-on-surface-variant font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">mark_email_read</span>
                  <p>Se enviará un correo electrónico con los datos de acceso para que el administrador inicie sesión por primera vez.</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowAdminForm(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" loading={savingAdmin}>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Guardar y enviar acceso
                  </Button>
                </div>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="rounded-l-lg">Nombre completo</TableHead>
                  <TableHead>Correo electrónico</TableHead>
                  <TableHead>Teléfono móvil</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right rounded-r-lg">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-on-surface-variant">
                      No hay administradores registrados para esta empresa
                    </TableCell>
                  </TableRow>
                ) : (
                  company.admins.map((admin) => (
                    <TableRow key={admin.id} className={!admin.isActive ? 'opacity-85' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={admin.fullName} size="md" className={getColorFromName(admin.fullName)} />
                          <div className="flex flex-col">
                            <span className="font-label-lg text-label-lg text-on-surface font-semibold">{admin.fullName}</span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">{admin.isPrimary ? 'Administrador principal' : 'Administrador'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-code-tracking text-code-tracking text-on-surface">{admin.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-code-tracking text-code-tracking text-on-surface-variant">{admin.phone || 'No registrado'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.isActive ? 'success' : 'error'}>
                          {admin.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={admin.isActive ? 'secondary' : 'success'}
                          size="sm"
                          onClick={() => handleAdminStatusChange(admin)}
                        >
                          <span className="material-symbols-outlined text-[16px]">{admin.isActive ? 'person_off' : 'how_to_reg'}</span>
                          {admin.isActive ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="pt-4 mt-4 flex flex-col sm:flex-row items-center justify-between text-on-surface-variant font-label-sm text-label-sm gap-2 border-t border-outline/50">
            <span>Mostrando {company.admins.length} de {company.admins.length} administradores registrados para esta sede</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled className="p-1.5">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </Button>
              <span className="px-3 font-semibold text-on-surface">Página 1</span>
              <Button variant="secondary" size="sm" disabled className="p-1.5">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Confirmar acción de estado"
        description={company.legalName}
        confirmLabel={companyActive ? 'Desactivar empresa' : 'Reactivar empresa'}
        confirmVariant={companyActive ? 'destructive' : 'primary'}
        onConfirm={confirmStatusChange}
      >
        <p className="font-body-md text-body-md text-on-surface-variant">
          {companyActive
            ? 'Al desactivar la empresa se suspenderán temporalmente los despachos activos, el acceso para los conductores en ruta y el inicio de sesión de todos sus administradores.'
            : 'Al reactivar la empresa se restablecerá de inmediato el acceso a la plataforma para administradores, supervisores y conductores registrados.'}
        </p>
      </Modal>

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