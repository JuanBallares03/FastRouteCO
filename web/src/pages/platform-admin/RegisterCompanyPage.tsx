import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { platformApi } from '@/services/api';
import { Toast } from '@/components/ui/Modal';

export function RegisterCompanyPage() {
  const [formData, setFormData] = useState({
    legal_name: '',
    nit: '',
    email: '',
    phone: '',
    address: '',
    has_own_drivers: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({ show: false, message: '', variant: 'success' });
  const navigate = useNavigate();

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'legal_name':
        if (!value.trim()) return 'La razón social es obligatoria';
        if (value.trim().length < 3) return 'La razón social debe tener al menos 3 caracteres';
        return '';
      case 'nit':
        if (!value.trim()) return 'El NIT es obligatorio';
        if (!/^\d{3}\.?\d{3}\.?\d{3}-?\d$/.test(value.replace(/\s/g, ''))) return 'Formato de NIT inválido (ej. 900.876.543-2)';
        return '';
      case 'email':
        if (!value.trim()) return 'El correo electrónico es obligatorio';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Formato de correo inválido';
        return '';
      case 'phone':
        if (!value.trim()) return 'El teléfono es obligatorio';
        if (value.trim().length < 10) return 'Número de teléfono inválido';
        return '';
      case 'address':
        if (!value.trim()) return 'La dirección es obligatoria';
        if (value.trim().length < 10) return 'La dirección debe ser más específica';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: fieldValue }));
    if (type !== 'checkbox') {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach((key) => {
      if (key !== 'has_own_drivers') {
        const value = formData[key as keyof typeof formData];
        if (typeof value === 'string') {
          const error = validateField(key, value);
          if (error) newErrors[key] = error;
        }
      }
    });
    
    if (!formData.has_own_drivers) {
      newErrors.has_own_drivers = 'La empresa debe tener conductores propios para usar FastRouteCO';
    }
    
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setLoading(true);
    try {
      await platformApi.createCompany({
        legal_name: formData.legal_name,
        nit: formData.nit.replace(/\s/g, ''),
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        has_own_drivers: formData.has_own_drivers,
      });
      setToast({ show: true, message: 'Empresa registrada exitosamente. Se envió el paquete de activación al correo indicado.', variant: 'success' });
      setTimeout(() => navigate('/platform/companies'), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || 'Error al registrar la empresa';
      setToast({ show: true, message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/platform/companies" className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all shadow-sm">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-code-tracking text-label-sm text-secondary uppercase tracking-wider">FastRouteCO • Módulo Maestro</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">Alta Corporativa</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Registrar nueva empresa</h1>
          </div>
        </div>
        <Link to="/platform/companies">
          <Button variant="secondary">
            <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
            Volver al listado
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-12 flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-xl bg-secondary-fixed/30 p-4 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0 text-secondary">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-label-lg text-label-lg text-on-surface">Periodo de prueba institucional</span>
                <Badge variant="warning" className="px-2 py-0.5 rounded font-code-tracking text-label-sm uppercase font-semibold">7 Días Activos</Badge>
              </div>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant leading-relaxed">
                La empresa iniciará un <strong className="text-on-surface font-semibold">Free Trial de 7 días</strong> y recibirá un correo de confirmación con las credenciales de acceso prioritario para su administrador principal.
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">domain</span>
                    <span className="font-label-lg text-label-lg text-on-surface">Datos de Constitución Jurídica</span>
                  </div>
                  <span className="font-code-tracking text-label-sm text-outline">DIAN / RUES</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-7">
                    <Input
                      label="Razón social de la empresa"
                      placeholder="ej. Distribuidora del Tolima S.A.S."
                      name="legal_name"
                      value={formData.legal_name}
                      onChange={handleChange}
                      error={errors.legal_name}
                      required
                    />
                  </div>
                  <div className="md:col-span-5">
                    <Input
                      label="NIT"
                      placeholder="ej. 900.876.543-2"
                      name="nit"
                      value={formData.nit}
                      onChange={handleChange}
                      error={errors.nit}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="h-[1px] w-full bg-surface-container" />

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">contact_mail</span>
                    <span className="font-label-lg text-label-lg text-on-surface">Canales de Enlace y Notificaciones</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-outline">Despachos & Operaciones</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Correo electrónico corporativo"
                    placeholder="contacto@distribuidoratolima.com"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    required
                    helperText="Recibirá la contraseña temporal y activación tokenizada."
                  />
                  <Input
                    label="Teléfono de contacto"
                    placeholder="ej. 315 789 4521 o (608) 271 2233"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    error={errors.phone}
                    required
                    helperText="Línea móvil para verificaciones SMS y soporte de tráfico."
                  />
                </div>
                <Input
                  label="Dirección principal"
                  placeholder="ej. Carrera 5 # 38-42, Zona Industrial El Papayo, Ibagué"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  error={errors.address}
                  required
                  icon="pin_drop"
                  helperText="Georreferenciada"
                />
              </div>

              <div className="h-[1px] w-full bg-surface-container" />

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">local_shipping</span>
                    <span className="font-label-lg text-label-lg text-on-surface">Capacidad Operativa y Plan de Despacho</span>
                  </div>
                  <span className="font-code-tracking text-label-sm text-tertiary-container">Modo Flota</span>
                </div>
                <Checkbox
                  label="La empresa tiene conductores propios"
                  name="has_own_drivers"
                  checked={formData.has_own_drivers}
                  onChange={handleCheckboxChange}
                  error={errors.has_own_drivers}
                  description="Requisito de habilitación para el uso de la aplicación móvil de reparto de FastRouteCO."
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-outline/50">
                <Link to="/platform/companies">
                  <Button variant="secondary" className="w-full sm:w-auto">Cancelar</Button>
                </Link>
                <Button type="submit" className="w-full sm:w-auto" loading={loading} onClick={handleSubmit}>
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  Guardar y registrar empresa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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