import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Modal';
import { platformApi } from '@/services/api';
import { getApiErrorMessage } from '@/lib/company-validation';

type Tab = 'plans' | 'modules' | 'packages';

interface ModuleOffering {
  id: string;
  code: string;
  name: string;
  price: number | null;
  isActive: boolean;
}

interface PlanOffering {
  id: string;
  name: string;
  modality: string;
  maxDrivers: number | null;
  maxBranches: number | null;
  supportType: string | null;
  trialDays: number | null;
  monthlyCredits: number | null;
  monthlyPrice: number | null;
  annualPrice: number | null;
  includedDrivers: number | null;
  pricePerOptimization: number | null;
  pricePerAdditionalDriver: number | null;
  earlyChargeThreshold: number | null;
  isActive: boolean;
  modules: ModuleOffering[];
}

interface PackageOffering {
  id: string;
  name: string;
  credits: number;
  price: number;
  isActive: boolean;
}

const emptyPlan = {
  name: '',
  modality: 'subscription',
  maxDrivers: '',
  maxBranches: '',
  supportType: '',
  trialDays: '',
  monthlyCredits: '',
  monthlyPrice: '',
  annualPrice: '',
  includedDrivers: '',
  pricePerOptimization: '',
  pricePerAdditionalDriver: '',
  earlyChargeThreshold: '',
  moduleIds: [] as string[],
};

const emptyModule = { code: '', name: '', price: '' };
const emptyPackage = { name: '', credits: '', price: '' };

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));
const currency = (value: number | null) =>
  value === null ? '—' : `$${value.toLocaleString('es-CO')}`;

export function PlansPage() {
  const [tab, setTab] = useState<Tab>('plans');
  const [plans, setPlans] = useState<PlanOffering[]>([]);
  const [modules, setModules] = useState<ModuleOffering[]>([]);
  const [packages, setPackages] = useState<PackageOffering[]>([]);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [moduleForm, setModuleForm] = useState(emptyModule);
  const [packageForm, setPackageForm] = useState(emptyPackage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'error' });

  const fetchData = async () => {
    try {
      const [plansRes, modulesRes, packagesRes] = await Promise.all([
        platformApi.getPlans(),
        platformApi.getModules(),
        platformApi.getCreditPackages(),
      ]);
      setPlans(plansRes.data);
      setModules(modulesRes.data);
      setPackages(packagesRes.data);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al cargar las ofertas'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string, variant: 'success' | 'error') =>
    setToast({ show: true, message, variant });

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setPlanForm(emptyPlan);
    setModuleForm(emptyModule);
    setPackageForm(emptyPackage);
  };

  const submitPlan = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = {
        name: planForm.name.trim(),
        modality: planForm.modality,
        maxDrivers: numberOrNull(planForm.maxDrivers),
        maxBranches: numberOrNull(planForm.maxBranches),
        supportType: planForm.supportType || null,
        trialDays: numberOrNull(planForm.trialDays),
        monthlyCredits: numberOrNull(planForm.monthlyCredits),
        monthlyPrice: numberOrNull(planForm.monthlyPrice),
        annualPrice: numberOrNull(planForm.annualPrice),
        includedDrivers: numberOrNull(planForm.includedDrivers),
        pricePerOptimization: numberOrNull(planForm.pricePerOptimization),
        pricePerAdditionalDriver: numberOrNull(planForm.pricePerAdditionalDriver),
        earlyChargeThreshold: numberOrNull(planForm.earlyChargeThreshold),
        isActive: true,
        moduleIds: planForm.moduleIds,
      };
      if (editingId) {
        await platformApi.updatePlan(editingId, data);
        showToast('Plan actualizado', 'success');
      } else {
        await platformApi.createPlan(data);
        showToast('Plan creado', 'success');
      }
      resetForm();
      await fetchData();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al guardar el plan'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitModule = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = {
        code: moduleForm.code.trim(),
        name: moduleForm.name.trim(),
        price: numberOrNull(moduleForm.price),
        isActive: true,
      };
      if (editingId) {
        await platformApi.updateModule(editingId, data);
        showToast('Módulo actualizado', 'success');
      } else {
        await platformApi.createModule(data);
        showToast('Módulo creado', 'success');
      }
      resetForm();
      await fetchData();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al guardar el módulo'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitPackage = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = {
        name: packageForm.name.trim(),
        credits: Number(packageForm.credits),
        price: Number(packageForm.price),
        isActive: true,
      };
      if (editingId) {
        await platformApi.updateCreditPackage(editingId, data);
        showToast('Paquete actualizado', 'success');
      } else {
        await platformApi.createCreditPackage(data);
        showToast('Paquete creado', 'success');
      }
      resetForm();
      await fetchData();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al guardar el paquete'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePlan = async (plan: PlanOffering) => {
    try {
      await platformApi.updatePlan(plan.id, { isActive: !plan.isActive });
      await fetchData();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al cambiar el estado'), 'error');
    }
  };

  const toggleModule = async (module: ModuleOffering) => {
    try {
      await platformApi.updateModule(module.id, { isActive: !module.isActive });
      await fetchData();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al cambiar el estado'), 'error');
    }
  };

  const togglePackage = async (pkg: PackageOffering) => {
    try {
      await platformApi.updateCreditPackage(pkg.id, { isActive: !pkg.isActive });
      await fetchData();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al cambiar el estado'), 'error');
    }
  };

  const startEditPlan = (plan: PlanOffering) => {
    setEditingId(plan.id);
    setShowForm(true);
    setPlanForm({
      name: plan.name,
      modality: plan.modality,
      maxDrivers: plan.maxDrivers?.toString() ?? '',
      maxBranches: plan.maxBranches?.toString() ?? '',
      supportType: plan.supportType ?? '',
      trialDays: plan.trialDays?.toString() ?? '',
      monthlyCredits: plan.monthlyCredits?.toString() ?? '',
      monthlyPrice: plan.monthlyPrice?.toString() ?? '',
      annualPrice: plan.annualPrice?.toString() ?? '',
      includedDrivers: plan.includedDrivers?.toString() ?? '',
      pricePerOptimization: plan.pricePerOptimization?.toString() ?? '',
      pricePerAdditionalDriver: plan.pricePerAdditionalDriver?.toString() ?? '',
      earlyChargeThreshold: plan.earlyChargeThreshold?.toString() ?? '',
      moduleIds: plan.modules.map((module) => module.id),
    });
  };

  const startEditModule = (module: ModuleOffering) => {
    setEditingId(module.id);
    setShowForm(true);
    setModuleForm({
      code: module.code,
      name: module.name,
      price: module.price?.toString() ?? '',
    });
  };

  const startEditPackage = (pkg: PackageOffering) => {
    setEditingId(pkg.id);
    setShowForm(true);
    setPackageForm({
      name: pkg.name,
      credits: pkg.credits.toString(),
      price: pkg.price.toString(),
    });
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'plans', label: 'Planes' },
    { id: 'modules', label: 'Módulos' },
    { id: 'packages', label: 'Paquetes de créditos' },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Planes y módulos</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Administra la oferta comercial disponible para las empresas.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <span className="material-symbols-outlined">add</span>
          Nueva {tab === 'plans' ? 'plan' : tab === 'modules' ? 'módulo' : 'paquete'}
        </Button>
      </div>

      <div className="flex gap-2 border-b border-outline/50">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => { setTab(item.id); resetForm(); }}
            className={`px-4 py-2 font-label-lg text-label-lg border-b-2 transition-colors ${
              tab === item.id
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {editingId ? 'Editar' : 'Crear'} {tab === 'plans' ? 'plan' : tab === 'modules' ? 'módulo' : 'paquete'}
            </h2>
          </CardHeader>
          <CardContent>
            {tab === 'plans' && (
              <form onSubmit={submitPlan} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Nombre" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
                <Select
                  label="Modalidad"
                  value={planForm.modality}
                  onChange={(e) => setPlanForm({ ...planForm, modality: e.target.value })}
                  options={[
                    { value: 'subscription', label: 'Suscripción' },
                    { value: 'pay_per_use', label: 'Pago por uso' },
                  ]}
                />
                <Input label="Tipo de soporte" value={planForm.supportType} onChange={(e) => setPlanForm({ ...planForm, supportType: e.target.value })} />
                <Input label="Máx. conductores" type="number" value={planForm.maxDrivers} onChange={(e) => setPlanForm({ ...planForm, maxDrivers: e.target.value })} />
                <Input label="Máx. sedes" type="number" value={planForm.maxBranches} onChange={(e) => setPlanForm({ ...planForm, maxBranches: e.target.value })} />
                <Input label="Días de prueba" type="number" value={planForm.trialDays} onChange={(e) => setPlanForm({ ...planForm, trialDays: e.target.value })} />
                <Input label="Créditos mensuales" type="number" value={planForm.monthlyCredits} onChange={(e) => setPlanForm({ ...planForm, monthlyCredits: e.target.value })} />
                <Input label="Precio mensual (COP)" type="number" value={planForm.monthlyPrice} onChange={(e) => setPlanForm({ ...planForm, monthlyPrice: e.target.value })} />
                <Input label="Precio anual (COP)" type="number" value={planForm.annualPrice} onChange={(e) => setPlanForm({ ...planForm, annualPrice: e.target.value })} />
                <Input label="Conductores incluidos" type="number" value={planForm.includedDrivers} onChange={(e) => setPlanForm({ ...planForm, includedDrivers: e.target.value })} />
                <Input label="Precio por optimización" type="number" value={planForm.pricePerOptimization} onChange={(e) => setPlanForm({ ...planForm, pricePerOptimization: e.target.value })} />
                <Input label="Precio por conductor adicional" type="number" value={planForm.pricePerAdditionalDriver} onChange={(e) => setPlanForm({ ...planForm, pricePerAdditionalDriver: e.target.value })} />
                <Input label="Umbral de cobro anticipado" type="number" value={planForm.earlyChargeThreshold} onChange={(e) => setPlanForm({ ...planForm, earlyChargeThreshold: e.target.value })} />
                <div className="md:col-span-3">
                  <p className="font-label-md text-label-md text-on-surface-variant mb-2">Módulos incluidos</p>
                  <div className="flex flex-wrap gap-4">
                    {modules.map((module) => (
                      <label key={module.id} className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                        <input
                          type="checkbox"
                          checked={planForm.moduleIds.includes(module.id)}
                          onChange={(e) =>
                            setPlanForm({
                              ...planForm,
                              moduleIds: e.target.checked
                                ? [...planForm.moduleIds, module.id]
                                : planForm.moduleIds.filter((id) => id !== module.id),
                            })
                          }
                        />
                        {module.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </form>
            )}

            {tab === 'modules' && (
              <form onSubmit={submitModule} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Código" value={moduleForm.code} onChange={(e) => setModuleForm({ ...moduleForm, code: e.target.value })} required />
                <Input label="Nombre" value={moduleForm.name} onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })} required />
                <Input label="Precio (COP)" type="number" value={moduleForm.price} onChange={(e) => setModuleForm({ ...moduleForm, price: e.target.value })} />
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </form>
            )}

            {tab === 'packages' && (
              <form onSubmit={submitPackage} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Nombre" value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} required />
                <Input label="Créditos" type="number" value={packageForm.credits} onChange={(e) => setPackageForm({ ...packageForm, credits: e.target.value })} required />
                <Input label="Precio (COP)" type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} required />
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="font-body-md text-body-md text-on-surface-variant">Cargando oferta comercial...</p>
      ) : tab === 'plans' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Precio mensual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-label-lg text-label-lg text-on-surface">{plan.name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {plan.modules.map((module) => module.name).join(', ') || 'Sin módulos'}
                    </p>
                  </TableCell>
                  <TableCell>{plan.modality === 'pay_per_use' ? 'Pago por uso' : 'Suscripción'}</TableCell>
                  <TableCell>{plan.monthlyCredits ?? '—'}</TableCell>
                  <TableCell>{currency(plan.monthlyPrice)}</TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? 'success' : 'neutral'}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEditPlan(plan)}>Editar</Button>
                      <Button size="sm" variant={plan.isActive ? 'destructive' : 'primary'} onClick={() => togglePlan(plan)}>
                        {plan.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : tab === 'modules' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell>{module.name}</TableCell>
                  <TableCell>{module.code}</TableCell>
                  <TableCell>{currency(module.price)}</TableCell>
                  <TableCell>
                    <Badge variant={module.isActive ? 'success' : 'neutral'}>
                      {module.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEditModule(module)}>Editar</Button>
                      <Button size="sm" variant={module.isActive ? 'destructive' : 'primary'} onClick={() => toggleModule(module)}>
                        {module.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paquete</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>{pkg.name}</TableCell>
                  <TableCell>{pkg.credits}</TableCell>
                  <TableCell>{currency(pkg.price)}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.isActive ? 'success' : 'neutral'}>
                      {pkg.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEditPackage(pkg)}>Editar</Button>
                      <Button size="sm" variant={pkg.isActive ? 'destructive' : 'primary'} onClick={() => togglePackage(pkg)}>
                        {pkg.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Toast show={toast.show} onClose={() => setToast({ ...toast, show: false })} title={toast.message} variant={toast.variant} />
    </div>
  );
}
