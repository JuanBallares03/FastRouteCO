import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { DropdownMenu } from '@/components/ui/Dropdown';
import { Modal, Toast } from '@/components/ui/Modal';
import { platformApi } from '@/services/api';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  legal_name: string;
  nit: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  plan: string;
  status: 'active' | 'inactive';
  subscription_status: 'active' | 'expired' | 'free_trial';
  trial_days_remaining?: number;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  'free-trial': 'Free Trial',
  'basic': 'Básico',
  'pro': 'Pro',
  'premium': 'Premium',
  'pay-per-use': 'Pago por uso',
};

const PLAN_BADGE_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  'free-trial': 'info',
  'basic': 'neutral',
  'pro': 'warning',
  'premium': 'success',
  'pay-per-use': 'warning',
};

const STATUS_BADGE_VARIANTS: Record<'active' | 'inactive', 'success' | 'error'> = {
  active: 'success',
  inactive: 'error',
};

const SUBSCRIPTION_BADGE_VARIANTS: Record<'active' | 'expired' | 'free_trial', 'success' | 'error' | 'warning'> = {
  active: 'success',
  expired: 'error',
  free_trial: 'warning',
};

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filters, setFilters] = useState({
    search: '',
    company_status: 'todas',
    subscription_status: 'todas',
    plan: 'todos',
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [modalAction, setModalAction] = useState<'activate' | 'deactivate' | 'extend' | 'convert'>('deactivate');
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({ show: false, message: '', variant: 'success' });

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.company_status !== 'todas' && { status: filters.company_status }),
        ...(filters.subscription_status !== 'todas' && { subscription_status: filters.subscription_status }),
        ...(filters.plan !== 'todos' && { plan: filters.plan }),
      };
      const response = await platformApi.getCompanies(params);
      setCompanies(response.data.data || response.data);
      setTotal(response.data.total || response.data.length);
    } catch {
      console.error('Error fetching companies:');
      setToast({ show: true, message: 'Error al cargar las empresas', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [page, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleStatusChange = (company: Company, action: 'activate' | 'deactivate') => {
    setSelectedCompany(company);
    setModalAction(action);
    setShowModal(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedCompany) return;
    try {
      await platformApi.updateCompanyStatus(selectedCompany.id, modalAction === 'activate' ? 'active' : 'inactive');
      setToast({ show: true, message: `Empresa ${modalAction === 'activate' ? 'activada' : 'desactivada'} correctamente`, variant: 'success' });
      fetchCompanies();
    } catch {
      setToast({ show: true, message: `Error al ${modalAction === 'activate' ? 'activar' : 'desactivar'} la empresa`, variant: 'error' });
    } finally {
      setShowModal(false);
      setSelectedCompany(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'bg-primary-fixed text-primary',
      'bg-secondary-fixed text-secondary',
      'bg-surface-container-highest text-on-surface',
      'bg-primary-fixed-dim text-on-primary-fixed-variant',
      'bg-secondary-container text-on-secondary-container',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm mb-1 uppercase tracking-wider">
            <span>FastRouteCO</span>
            <span>/</span>
            <span className="text-primary font-semibold">Administración Global</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Empresas vinculadas</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Control y administración de clientes corporativos en la plataforma FastRouteCO</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary">
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            Exportar reporte
          </Button>
          <Link to="/platform/companies/new">
            <Button>
              <span className="material-symbols-outlined text-[20px]">add_business</span>
              Registrar empresa
            </Button>
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Empresas Totales</span>
              <span className="w-8 h-8 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
              </span>
            </div>
            <div className="mt-2">
              <span className="font-headline-lg text-headline-lg text-on-surface">{total}</span>
              <div className="flex items-center gap-1 mt-1 font-label-sm text-label-sm text-tertiary-container">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                <span>+3 este mes</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Operación Activa</span>
              <span className="w-8 h-8 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
              </span>
            </div>
            <div className="mt-2">
              <span className="font-headline-lg text-headline-lg text-on-surface">
                {companies.filter(c => c.status === 'active').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">En Prueba Activa</span>
              <span className="w-8 h-8 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
              </span>
            </div>
            <div className="mt-2">
              <span className="font-headline-lg text-headline-lg text-on-surface">
                {companies.filter(c => c.subscription_status === 'free_trial').length}
              </span>
              <div className="flex items-center gap-1 mt-1 font-label-sm text-label-sm text-secondary">
                <span>2 por vencer esta semana</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Suscripciones Vencidas</span>
              <span className="w-8 h-8 rounded-lg bg-error-container text-on-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </span>
            </div>
            <div className="mt-2">
              <span className="font-headline-lg text-headline-lg text-error">
                {companies.filter(c => c.subscription_status === 'expired').length}
              </span>
              <div className="flex items-center gap-1 mt-1 font-label-sm text-label-sm text-error">
                <span>Atención de cobro requerida</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4">
            <Input
              label="Búsqueda rápida"
              placeholder="Buscar por razón social o NIT..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              icon="search"
            />
          </div>
          <div className="lg:col-span-3">
            <Select
              label="Estado de la empresa"
              value={filters.company_status}
              onChange={(e) => handleFilterChange('company_status', e.target.value)}
              options={[
                { value: 'todas', label: 'Todas las empresas' },
                { value: 'active', label: 'Activa' },
                { value: 'inactive', label: 'Inactiva' },
              ]}
            />
          </div>
          <div className="lg:col-span-3">
            <Select
              label="Estado suscripción"
              value={filters.subscription_status}
              onChange={(e) => handleFilterChange('subscription_status', e.target.value)}
              options={[
                { value: 'todas', label: 'Todos los estados' },
                { value: 'active', label: 'Activa' },
                { value: 'expired', label: 'Vencida' },
                { value: 'free_trial', label: 'Free Trial' },
              ]}
            />
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Plan contratado"
              value={filters.plan}
              onChange={(e) => handleFilterChange('plan', e.target.value)}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'free-trial', label: 'Free Trial' },
                { value: 'basic', label: 'Básico' },
                { value: 'pro', label: 'Pro' },
                { value: 'premium', label: 'Premium' },
                { value: 'pay-per-use', label: 'Pago por uso' },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="rounded-l-lg">Razón Social y Ciudad</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado Empresa</TableHead>
                <TableHead>Estado Suscripción</TableHead>
                <TableHead className="text-right rounded-r-lg">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Cargando empresas...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-on-surface-variant">
                    No se encontraron empresas con los filtros actuales
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-lg font-headline-sm text-headline-sm flex items-center justify-center shrink-0', getColorFromName(company.legal_name))}>
                          {getInitials(company.legal_name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-label-lg text-label-lg text-on-surface truncate">{company.legal_name}</span>
                          <div className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-secondary">location_on</span>
                            <span>{company.city}, Tolima</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-code-tracking text-code-tracking px-2 py-1 rounded bg-surface-container text-on-surface">{company.nit}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={PLAN_BADGE_VARIANTS[company.plan] || 'neutral'}>
                        {PLAN_LABELS[company.plan] || company.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={STATUS_BADGE_VARIANTS[company.status]}>
                        {company.status === 'active' ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {company.subscription_status === 'free_trial' && company.trial_days_remaining !== undefined ? (
                        <Badge variant="warning">
                          Free Trial ({company.trial_days_remaining} días restantes)
                        </Badge>
                      ) : (
                        <Badge variant={SUBSCRIPTION_BADGE_VARIANTS[company.subscription_status]}>
                          {company.subscription_status === 'active' ? 'Activa' : company.subscription_status === 'expired' ? 'Vencida' : 'Free Trial'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Link to={`/platform/companies/${company.id}`}>
                          <Button variant="secondary" size="sm">Ver detalle</Button>
                        </Link>
                        <DropdownMenu
                          open={false}
                          onClose={() => {}}
                          items={[
                            { 
                              label: 'Editar información', 
                              onClick: () => {}, 
                              icon: 'edit',
                              variant: 'default' 
                            },
                            { 
                              label: company.status === 'active' ? 'Desactivar empresa' : 'Activar empresa', 
                              onClick: () => handleStatusChange(company, company.status === 'active' ? 'deactivate' : 'activate'),
                              icon: company.status === 'active' ? 'block' : 'check_circle',
                              variant: company.status === 'active' ? 'destructive' : 'success'
                            },
                          ]}
                        >
                          <Button variant="secondary" size="sm" className="p-2">
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </Button>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-4 py-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-outline/50">
          <div className="font-body-sm text-body-sm text-on-surface-variant">
            Mostrando <span className="font-semibold text-on-surface">{(page - 1) * limit + 1}</span> a <span className="font-semibold text-on-surface">{Math.min(page * limit, total)}</span> de <span className="font-semibold text-on-surface">{total}</span> empresas
          </div>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              Anterior
            </Button>
            {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.min(Math.ceil(total / limit), page + 2)).map((p) => (
              <Button
                key={p}
                variant={p === page ? 'primary' : 'secondary'}
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button variant="secondary" size="sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>
              Siguiente
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </Button>
          </div>
        </div>
      </section>

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setSelectedCompany(null); }}
        title="Confirmar acción de estado"
        description={selectedCompany?.legal_name || ''}
        confirmLabel={modalAction === 'activate' ? 'Reactivar empresa' : 'Desactivar empresa'}
        confirmVariant={modalAction === 'activate' ? 'primary' : 'destructive'}
        onConfirm={confirmStatusChange}
      >
        <p className="font-body-md text-body-md text-on-surface-variant">
          {modalAction === 'activate'
            ? 'Al reactivar la empresa se restablecerá de inmediato el acceso a la plataforma para administradores, supervisores y conductores registrados.'
            : 'Al desactivar la empresa se suspenderán temporalmente los despachos activos, el acceso para los conductores en ruta y el inicio de sesión de todos sus administradores.'}
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