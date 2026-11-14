import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Modal';
import { billingApi } from '@/features/billing/api';
import { API_URL } from '@/services/http';
import { getApiErrorMessage } from '@/lib/company-validation';

interface OfferingPlan {
  id: string;
  name: string;
  modality: string;
  trialDays: number | null;
  monthlyCredits: number | null;
  monthlyPrice: number | null;
  annualPrice: number | null;
  pricePerOptimization: number | null;
  modules: Array<{ id: string; name: string }>;
}

interface OfferingModule {
  id: string;
  code: string;
  name: string;
  price: number | null;
}

interface OfferingPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
}

interface Offerings {
  plans: OfferingPlan[];
  modules: OfferingModule[];
  creditPackages: OfferingPackage[];
}

interface Billing {
  cardRegistered: boolean;
  spendingLimit: number | null;
  subscription: {
    status: string;
    billingCycle: string;
    renewalDate: string;
    plan: OfferingPlan & { monthlyCredits: number | null };
  } | null;
  credits: {
    planCredits: number;
    extraCredits: number;
    total: number;
    lowThreshold: number;
    nextResetDate: string | null;
  };
  usage: {
    optimizationCount: number;
    additionalDrivers: number;
    amount: number;
    nextChargeDate: string;
    earlyChargeAmount: number | null;
  } | null;
  modules: Array<{ id: string; name: string; price: number | null; purchasedAt?: string }>;
}

interface Transaction {
  id: string;
  type: string;
  quantity: number;
  resultingBalance: number;
  transactionDate: string;
  description?: string | null;
}

interface Payment {
  id: string;
  purpose: string;
  amount: number;
  status: string;
  createdAt: string;
  paymentMethod: string | null;
}

interface UsageCharge {
  id: string;
  periodStartDate: string;
  optimizationCount: number;
  amount: number;
  status: string;
}

const currency = (value: number | null) =>
  value === null ? '—' : `$${value.toLocaleString('es-CO')}`;

const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-CO', { dateStyle: 'medium' }) : '—';

const statusLabel: Record<string, string> = {
  active: 'Activo',
  expired: 'Vencido',
  inactive: 'Inactivo',
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  open: 'Abierto',
  charged: 'Cobrado',
};

const purposeLabel: Record<string, string> = {
  subscription: 'Suscripción',
  credit_package: 'Paquete de créditos',
  module: 'Módulo',
  usage: 'Consumo',
};

const transactionLabel: Record<string, string> = {
  consumption: 'Consumo',
  purchase: 'Compra',
  renewal: 'Renovación',
  adjustment: 'Ajuste',
};

export function BillingPage() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [usageCharges, setUsageCharges] = useState<UsageCharge[]>([]);
  const [historyTab, setHistoryTab] = useState<'transactions' | 'payments' | 'usage'>('transactions');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [spendingLimit, setSpendingLimit] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'error' });
  const widgetRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, variant: 'success' | 'error' = 'success') =>
    setToast({ show: true, message, variant });

  const fetchBilling = async () => {
    const [billingRes, offeringsRes] = await Promise.all([
      billingApi.getBilling(),
      billingApi.getOfferings(),
    ]);
    setBilling(billingRes.data);
    setOfferings(offeringsRes.data);
    setSpendingLimit(billingRes.data.spendingLimit?.toString() ?? '');
  };

  const fetchHistory = async (tab = historyTab) => {
    if (tab === 'transactions') {
      setTransactions((await billingApi.getTransactions()).data.items);
    } else if (tab === 'payments') {
      setPayments((await billingApi.getPayments()).data.items);
    } else {
      setUsageCharges((await billingApi.getUsageCharges()).data.items);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const card = params.get('card');
    const payment = params.get('payment');
    const load = async () => {
      try {
        await fetchBilling();
        if (card === 'approved') showToast('Tarjeta registrada y pago por uso activado');
        if (card === 'pending') showToast('El pago quedó pendiente de confirmación', 'error');
        if (card === 'error') showToast('No se pudo registrar la tarjeta', 'error');
        if (payment && !card) showToast('Pago recibido. La confirmación puede tardar unos segundos.');
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Error al cargar la facturación'), 'error');
      } finally {
        setLoading(false);
        if (card || payment) window.history.replaceState({}, '', window.location.pathname);
      }
    };
    load();
  }, []);

  useEffect(() => {
    fetchHistory(historyTab).catch(() =>
      showToast('Error al cargar el historial', 'error')
    );
  }, [historyTab]);

  useEffect(() => {
    if (!setupToken || !widgetRef.current) return;
    const publicKey = import.meta.env.VITE_WOMPI_PUBLIC_KEY;
    if (!publicKey) {
      showToast('La pasarela de pagos no está configurada', 'error');
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.setAttribute('data-widget-operation', 'tokenize');
    script.setAttribute('data-public-key', publicKey);
    widgetRef.current.appendChild(script);
    return () => {
      if (widgetRef.current) widgetRef.current.innerHTML = '';
    };
  }, [setupToken]);

  const startCheckout = async (
    action: () => Promise<{ data: { checkoutUrl?: string } }>,
    fallbackError: string
  ) => {
    setSaving(true);
    try {
      const response = await action();
      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, fallbackError), 'error');
    } finally {
      setSaving(false);
    }
  };

  const subscribe = (planId: string) =>
    startCheckout(() => billingApi.subscribe(planId, billingCycle), 'Error al iniciar la suscripción');

  const buyPackage = (packageId: string) =>
    startCheckout(() => billingApi.purchaseCredits(packageId), 'Error al comprar el paquete');

  const buyModule = (moduleId: string) =>
    startCheckout(() => billingApi.purchaseModule(moduleId), 'Error al comprar el módulo');

  const startCardSetup = async () => {
    setSaving(true);
    try {
      const response = await billingApi.createCardSetup();
      setSetupToken(response.data.setupToken);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al iniciar el registro de la tarjeta'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSpendingLimit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await billingApi.updateSpendingLimit(spendingLimit.trim() === '' ? null : Number(spendingLimit));
      await fetchBilling();
      showToast('Límite mensual actualizado');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Error al actualizar el límite'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !billing || !offerings) {
    return <p className="font-body-md text-body-md text-on-surface-variant">Cargando facturación...</p>;
  }

  const subscription = billing.subscription;
  const plan = subscription?.plan ?? null;
  const payPerUse = plan?.modality === 'pay_per_use';
  const activeModuleIds = new Set(billing.modules.map((module) => module.id));
  const availableModules = offerings.modules.filter(
    (module) => !activeModuleIds.has(module.id) && !plan?.modules.some((item) => item.id === module.id)
  );

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Suscripción y créditos</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Administra tu plan, créditos, consumos y pagos.
          </p>
        </div>
        <Badge variant={subscription ? 'success' : 'error'}>
          {subscription ? statusLabel[subscription.status] ?? subscription.status : 'Sin suscripción activa'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><h2 className="font-headline-sm text-headline-sm">Plan actual</h2></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-headline-md text-headline-md text-on-surface">{plan?.name ?? 'Sin plan'}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {plan?.modality === 'pay_per_use'
                ? 'Pago por uso'
                : `Facturación ${subscription?.billingCycle === 'annual' ? 'anual' : 'mensual'}`}
            </p>
            {plan?.modality === 'pay_per_use' ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Valor por optimización: {currency(plan.pricePerOptimization)}
              </p>
            ) : (
              <>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Créditos mensuales: {plan?.monthlyCredits ?? 0}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Próxima renovación: {dateLabel(subscription?.renewalDate ?? null)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-headline-sm text-headline-sm">Créditos</h2></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-display-sm text-display-sm text-primary">{billing.credits.total}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {billing.credits.planCredits} del plan · {billing.credits.extraCredits} adicionales
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Próximo reinicio: {dateLabel(billing.credits.nextResetDate)}
            </p>
            {billing.credits.total <= billing.credits.lowThreshold && billing.credits.lowThreshold > 0 && (
              <p className="font-body-sm text-body-sm text-error">Tus créditos están bajos.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-headline-sm text-headline-sm">Pago por uso</h2></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Consumo del mes: {currency(billing.usage?.amount ?? 0)}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Optimizaciones: {billing.usage?.optimizationCount ?? 0}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Tarjeta: {billing.cardRegistered ? 'Registrada' : 'Sin registrar'}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Límite mensual: {currency(billing.spendingLimit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {payPerUse && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm">Tarjeta y límite de gasto</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {!billing.cardRegistered && (
              <div className="space-y-3">
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Registra una tarjeta para activar el pago por uso. Solo guardamos la referencia de Wompi.
                </p>
                {!setupToken ? (
                  <Button onClick={startCardSetup} disabled={saving}>Registrar tarjeta</Button>
                ) : (
                  <form method="POST" action={`${API_URL}/payments/wompi/card?setup=${encodeURIComponent(setupToken)}`}>
                    <div ref={widgetRef} />
                  </form>
                )}
              </div>
            )}
            <form onSubmit={saveSpendingLimit} className="flex flex-wrap items-end gap-3">
              <Input
                label="Límite mensual (COP)"
                type="number"
                value={spendingLimit}
                onChange={(event) => setSpendingLimit(event.target.value)}
                placeholder="Sin límite"
              />
              <Button type="submit" disabled={saving}>Guardar límite</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!payPerUse && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-headline-sm text-headline-sm">Cambiar de plan</h2>
              <Select
                label="Ciclo"
                value={billingCycle}
                onChange={(event) => setBillingCycle(event.target.value as 'monthly' | 'annual')}
                options={[
                  { value: 'monthly', label: 'Mensual' },
                  { value: 'annual', label: 'Anual' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {offerings.plans
              .filter((offering) => offering.modality === 'subscription' && (offering.trialDays ?? 0) <= 0)
              .map((offering) => (
                <div key={offering.id} className="rounded-lg border border-outline/50 p-4 space-y-2">
                  <p className="font-label-lg text-label-lg text-on-surface">{offering.name}</p>
                  <p className="font-headline-sm text-headline-sm text-primary">
                    {currency(billingCycle === 'annual' ? offering.annualPrice : offering.monthlyPrice)}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {offering.monthlyCredits ?? 0} créditos mensuales
                  </p>
                  <Button
                    size="sm"
                    disabled={saving || offering.id === plan?.id}
                    onClick={() => subscribe(offering.id)}
                  >
                    {offering.id === plan?.id ? 'Plan actual' : 'Elegir plan'}
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-headline-sm text-headline-sm">Paquetes de créditos</h2></CardHeader>
          <CardContent className="space-y-3">
            {payPerUse ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                En pago por uso no aplican paquetes de créditos.
              </p>
            ) : (
              offerings.creditPackages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline/50 p-3">
                  <div>
                    <p className="font-label-lg text-label-lg text-on-surface">{pkg.name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {pkg.credits} créditos · {currency(pkg.price)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => buyPackage(pkg.id)} disabled={saving}>Comprar</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-headline-sm text-headline-sm">Módulos</h2></CardHeader>
          <CardContent className="space-y-3">
            {billing.modules.length === 0 && availableModules.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No hay módulos disponibles.</p>
            )}
            {billing.modules.map((module) => (
              <div key={module.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline/50 p-3">
                <p className="font-label-lg text-label-lg text-on-surface">{module.name}</p>
                <Badge variant="success">Activo</Badge>
              </div>
            ))}
            {availableModules.map((module) => (
              <div key={module.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline/50 p-3">
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface">{module.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{currency(module.price)}</p>
                </div>
                <Button size="sm" onClick={() => buyModule(module.id)} disabled={saving}>Comprar</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'transactions', label: 'Movimientos de créditos' },
              { id: 'payments', label: 'Pagos' },
              { id: 'usage', label: 'Consumos' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setHistoryTab(item.id as typeof historyTab)}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm ${
                  historyTab === item.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {historyTab === 'transactions' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{dateLabel(item.transactionDate)}</TableCell>
                    <TableCell>{transactionLabel[item.type] ?? item.type}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.resultingBalance}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {historyTab === 'payments' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{dateLabel(item.createdAt)}</TableCell>
                    <TableCell>{purposeLabel[item.purpose] ?? item.purpose}</TableCell>
                    <TableCell>{currency(item.amount)}</TableCell>
                    <TableCell>{statusLabel[item.status] ?? item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {historyTab === 'usage' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Optimizaciones</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageCharges.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{dateLabel(item.periodStartDate)}</TableCell>
                    <TableCell>{item.optimizationCount}</TableCell>
                    <TableCell>{currency(item.amount)}</TableCell>
                    <TableCell>{statusLabel[item.status] ?? item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Toast show={toast.show} onClose={() => setToast({ ...toast, show: false })} title={toast.message} variant={toast.variant} />
    </div>
  );
}
