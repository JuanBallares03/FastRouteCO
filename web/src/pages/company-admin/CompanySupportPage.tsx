import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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

export function CompanySupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [form, setForm] = useState({ subject: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<SupportRequest | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ show: false, message: '', variant: 'error' });

  const loadRequests = useCallback(async () => {
    try {
      const response = await supportApi.listCompany({ pageSize: 50 });
      setRequests(response.data.items as SupportRequest[]);
    } catch {
      setToast({ show: true, message: 'No se pudieron cargar las solicitudes', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await supportApi.create({
        subject: form.subject.trim(),
        description: form.description.trim(),
      });
      setForm({ subject: '', description: '' });
      setShowForm(false);
      setToast({ show: true, message: 'Solicitud de soporte enviada', variant: 'success' });
      await loadRequests();
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo enviar la solicitud'),
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
            Envía solicitudes y consulta las respuestas del equipo de la plataforma.
          </p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          <span className="material-symbols-outlined text-[20px]">support_agent</span>
          Nueva solicitud
        </Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Nueva solicitud</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Asunto"
                value={form.subject}
                maxLength={200}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Describe brevemente el problema"
              />
              <div>
                <label className="font-label-md text-label-md text-on-surface block mb-1.5">
                  Descripción
                </label>
                <textarea
                  className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-28"
                  value={form.description}
                  maxLength={5000}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Cuéntanos qué está ocurriendo y qué esperabas que sucediera."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={form.subject.trim().length < 5 || form.description.trim().length < 10}
                >
                  Enviar solicitud
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mis solicitudes</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Cargando solicitudes...</p>
          ) : requests.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              Todavía no has enviado solicitudes de soporte.
            </p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-xl border border-outline/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-label-lg text-label-lg text-on-surface">{request.subject}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Enviada el {request.sentDate.slice(0, 10)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[request.status] ?? 'neutral'}>
                    {STATUS_LABELS[request.status] ?? request.status}
                  </Badge>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2 whitespace-pre-line">
                  {request.description}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setSelected(request)}
                >
                  Ver detalle
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {selected.subject}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-body-md text-body-md text-on-surface whitespace-pre-line">
              {selected.description}
            </p>
            <div className="rounded-lg bg-surface-container-low p-4">
              <p className="font-label-md text-label-md text-on-surface-variant">Respuesta</p>
              <p className="font-body-md text-body-md text-on-surface mt-1 whitespace-pre-line">
                {selected.response || 'Aún sin respuesta.'}
              </p>
              {selected.responseDate && (
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-2">
                  Respondida el {selected.responseDate.slice(0, 10)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
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
