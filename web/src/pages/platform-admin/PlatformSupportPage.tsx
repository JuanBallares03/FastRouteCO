import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Modal';
import { supportApi } from '@/services/api';
import { getApiErrorMessage } from '@/lib/company-validation';

interface SupportRequest {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'answered' | 'closed';
  response: string | null;
  sentDate: string;
  responseDate: string | null;
  company?: { id: string; legalName: string; email: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  answered: 'Respondida',
  closed: 'Cerrada',
};

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  open: 'warning',
  answered: 'success',
  closed: 'neutral',
};

export function PlatformSupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ show: false, message: '', variant: 'error' });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await supportApi.listPlatform({
        status: statusFilter || undefined,
        pageSize: 100,
      });
      setRequests(response.data.items as SupportRequest[]);
    } catch {
      setToast({ show: true, message: 'No se pudieron cargar las solicitudes', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const selected = requests.find((request) => request.id === selectedId) ?? null;

  const handleRespond = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.respond(selected.id, responseText.trim());
      setResponseText('');
      setToast({ show: true, message: 'Respuesta enviada a la empresa', variant: 'success' });
      await loadRequests();
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo enviar la respuesta'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.close(selected.id);
      setToast({ show: true, message: 'Solicitud cerrada', variant: 'success' });
      await loadRequests();
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo cerrar la solicitud'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Soporte técnico</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Atiende las solicitudes de las empresas y notifica la respuesta.
          </p>
        </div>
        <div className="w-56">
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { value: '', label: 'Todas' },
              { value: 'open', label: 'Abiertas' },
              { value: 'answered', label: 'Respondidas' },
              { value: 'closed', label: 'Cerradas' },
            ]}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Solicitudes</h2>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Cargando...</p>
            ) : requests.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                No hay solicitudes con el filtro seleccionado.
              </p>
            ) : (
              requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(request.id);
                    setResponseText(request.response ?? '');
                  }}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedId === request.id
                      ? 'border-primary bg-primary-fixed/40'
                      : 'border-outline/40 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {request.sentDate.slice(0, 10)}
                    </span>
                    <Badge variant={STATUS_VARIANTS[request.status] ?? 'neutral'}>
                      {STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                  </div>
                  <p className="font-label-lg text-label-lg text-on-surface mt-1 line-clamp-2">
                    {request.subject}
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                    {request.company?.legalName ?? 'Empresa'}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {selected ? selected.subject : 'Detalle de la solicitud'}
            </h2>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Selecciona una solicitud para verla y responderla.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-surface-container-low p-4">
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    {selected.company?.legalName} · {selected.company?.email}
                  </p>
                  <p className="font-body-md text-body-md text-on-surface mt-2 whitespace-pre-line">
                    {selected.description}
                  </p>
                </div>

                <div>
                  <label className="font-label-md text-label-md text-on-surface block mb-1.5">
                    Respuesta
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-32 disabled:opacity-60"
                    value={responseText}
                    maxLength={5000}
                    disabled={selected.status === 'closed'}
                    onChange={(event) => setResponseText(event.target.value)}
                    placeholder="Escribe la respuesta para la empresa..."
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleClose}
                    loading={saving}
                    disabled={selected.status === 'closed'}
                  >
                    Cerrar solicitud
                  </Button>
                  <Button
                    onClick={handleRespond}
                    loading={saving}
                    disabled={selected.status === 'closed' || responseText.trim().length < 5}
                  >
                    Enviar respuesta
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
