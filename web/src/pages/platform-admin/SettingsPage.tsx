import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Modal';
import { settingsApi } from '@/services/api';
import { getApiErrorMessage } from '@/lib/company-validation';

interface Setting {
  key: string;
  value: number;
  label: string;
  description: string;
  min: number;
  max: number;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ show: false, message: '', variant: 'error' });

  useEffect(() => {
    settingsApi
      .list()
      .then((response) => {
        const items = response.data as Setting[];
        setSettings(items);
        setValues(
          Object.fromEntries(items.map((item) => [item.key, String(item.value)]))
        );
      })
      .catch(() => {
        setToast({ show: true, message: 'No se pudo cargar la configuración', variant: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, number> = {};
    for (const setting of settings) {
      const parsed = Number(values[setting.key]);
      if (
        !Number.isInteger(parsed) ||
        parsed < setting.min ||
        parsed > setting.max
      ) {
        setToast({
          show: true,
          message: `${setting.label} debe ser un entero entre ${setting.min} y ${setting.max}`,
          variant: 'error',
        });
        return;
      }
      payload[setting.key] = parsed;
    }

    setSaving(true);
    try {
      const response = await settingsApi.update(payload);
      const items = response.data as Setting[];
      setSettings(items);
      setValues(Object.fromEntries(items.map((item) => [item.key, String(item.value)])));
      setToast({ show: true, message: 'Configuración guardada', variant: 'success' });
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo guardar la configuración'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Configuración global</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Parámetros generales de la plataforma. Los cambios se aplican sin reiniciar el servicio.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Parámetros</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              Cargando configuración...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {settings.map((setting) => (
                <div key={setting.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                  <div className="md:col-span-2">
                    <p className="font-label-lg text-label-lg text-on-surface">{setting.label}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {setting.description} Rango permitido: {setting.min} a {setting.max}.
                    </p>
                  </div>
                  <Input
                    type="number"
                    label="Valor"
                    min={setting.min}
                    max={setting.max}
                    step={1}
                    value={values[setting.key] ?? ''}
                    onChange={(event) => updateValue(setting.key, event.target.value)}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={saving}>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Guardar configuración
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
