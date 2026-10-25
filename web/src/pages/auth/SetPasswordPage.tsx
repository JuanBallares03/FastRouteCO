import { useState, type FormEvent, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { Toast } from '@/components/ui/Modal';

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({ show: false, message: '', variant: 'success' });
  const { acceptInvitation } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError('Token de invitación inválido o faltante.');
      setToast({ show: true, message: 'Token de invitación inválido o faltante.', variant: 'error' });
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setToast({ show: false, message: '', variant: 'success' });

    if (!token) {
      setError('Token de invitación inválido.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await acceptInvitation(token, password);
      setSuccess(true);
      setToast({ show: true, message: 'Contraseña definida correctamente. Redirigiendo al inicio de sesión...', variant: 'success' });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || 'Error al definir la contraseña. El enlace puede haber expirado.';
      setError(message);
      setToast({ show: true, message, variant: 'error' });
      setTimeout(() => setToast({ ...toast, show: false }), 4000);
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = () => setShowPassword(!showPassword);

  if (!token || success) {
    return (
      <AuthLayout>
        <div className="relative bg-surface-container-lowest shadow-xl rounded-xl p-6 sm:p-8 overflow-hidden animate-in text-center">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />

          <header className="flex flex-col items-center text-center mb-6">
            <div className="w-full max-w-[220px] mb-4 flex items-center justify-center">
              <svg className="w-full h-auto object-contain" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logo FastRouteCO">
                <rect width="200" height="60" rx="12" fill="#1E40AF"/>
                <text x="100" y="38" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="-0.02em">FastRouteCO</text>
              </svg>
            </div>
            <div className="inline-flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full mb-4">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="font-label-sm text-label-sm text-secondary font-medium tracking-wide">
                Lanzamiento Ibagué, Tolima
              </span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-1">
              {success ? 'Contraseña definida' : 'Enlace inválido'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
              {success 
                ? 'Tu contraseña ha sido configurada correctamente. Serás redirigido al inicio de sesión.'
                : 'El enlace de invitación es inválido o ha expirado.'}
            </p>
          </header>

          {success && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-tertiary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px] text-tertiary">done_all</span>
              </div>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Ir al inicio de sesión
              </Button>
            </div>
          )}
        </div>
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          title={toast.variant === 'success' ? 'Éxito' : 'Error'}
          description={toast.message}
          variant={toast.variant}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="relative bg-surface-container-lowest shadow-xl rounded-xl p-6 sm:p-8 overflow-hidden animate-in">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />

        <header className="flex flex-col items-center text-center mb-6">
          <div className="w-full max-w-[220px] mb-4 flex items-center justify-center">
            <svg className="w-full h-auto object-contain" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logo FastRouteCO">
              <rect width="200" height="60" rx="12" fill="#1E40AF"/>
              <text x="100" y="38" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="-0.02em">FastRouteCO</text>
            </svg>
          </div>
          <div className="inline-flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-sm text-label-sm text-secondary font-medium tracking-wide">
              Lanzamiento Ibagué, Tolima
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-1">
            Definir contraseña de acceso
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            Has sido invitado a FastRouteCO. Define tu contraseña para activar tu cuenta.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col">
            <label className="font-label-md text-label-md text-on-surface mb-1" htmlFor="nueva-clave">
              Nueva contraseña
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">
                lock
              </span>
              <input
                className="w-full h-[42px] pl-10 pr-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all font-code-tracking"
                id="nueva-clave"
                name="nueva-clave"
                placeholder="Mínimo 10 caracteres"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                minLength={10}
              />
              <button
                className="absolute right-2.5 p-1 rounded-md text-outline hover:text-on-surface transition-colors flex items-center justify-center"
                type="button"
                onClick={togglePassword}
                title="Mostrar u ocultar contraseña"
                disabled={loading}
              >
                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant/80">Mínimo 10 caracteres. No uses información personal.</span>
          </div>

          <div className="flex flex-col">
            <label className="font-label-md text-label-md text-on-surface mb-1" htmlFor="confirmar-clave">
              Confirmar contraseña
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">
                lock_outline
              </span>
              <input
                className="w-full h-[42px] pl-10 pr-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all font-code-tracking"
                id="confirmar-clave"
                name="confirmar-clave"
                placeholder="Repite tu contraseña"
                required
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2" role="alert">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button type="submit" className="w-full h-[44px]" loading={loading}>
              <span>Definir contraseña y activar cuenta</span>
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </Button>
          </div>
        </form>

        <footer className="mt-8 pt-4 flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 text-outline mb-1">
            <span className="material-symbols-outlined text-[16px] text-tertiary-container">verified_user</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Conexión segura cifrada punto a punto</span>
          </div>
          <p className="font-body-sm text-body-sm text-outline">
            FastRouteCO Colombia • Plataforma segura para flotas de reparto
          </p>
        </footer>
      </div>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.variant === 'success' ? 'Éxito' : 'Error'}
        description={toast.message}
        variant={toast.variant}
      />
    </AuthLayout>
  );
}