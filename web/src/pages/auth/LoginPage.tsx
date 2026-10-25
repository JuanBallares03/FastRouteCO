import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { Toast } from '@/components/ui/Modal';

export function LoginPage() {
  const [email, setEmail] = useState('despacho.central@ibague-logistica.com.co');
  const [password, setPassword] = useState('IbagueFlotas2025*');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'error' }>({ show: false, message: '', variant: 'success' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || 'Credenciales inválidas. Verifica tu correo y contraseña.';
      setError(message);
      setToast({ show: true, message, variant: 'error' });
      setTimeout(() => setToast({ ...toast, show: false }), 4000);
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = () => setShowPassword(!showPassword);

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
            Ingreso a la plataforma
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            Gestión de logística y rutas para empresas con flota propia
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col">
            <label className="font-label-md text-label-md text-on-surface mb-1" htmlFor="correo">
              Correo electrónico corporativo
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">
                mail
              </span>
              <input
                className="w-full h-[42px] pl-10 pr-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
                id="correo"
                name="correo"
                placeholder="ejemplo@empresa.com.co"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="clave">
                Contraseña
              </label>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">
                lock
              </span>
              <input
                className="w-full h-[42px] pl-10 pr-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all font-code-tracking"
                id="clave"
                name="clave"
                placeholder="Ingresa tu clave de acceso"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
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
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2" role="alert">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button type="submit" className="w-full h-[44px]" loading={loading}>
              <span>Ingresar</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
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