import { isAxiosError } from 'axios';

export const NON_DRIVER_MESSAGE =
  'Esta aplicación es solo para conductores. Si usas otra cuenta, ingresa desde la plataforma web.';

export class LoginBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginBlockedError';
  }
}

export function isDriverRole(role: string | null | undefined): boolean {
  return role === 'driver';
}

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof LoginBlockedError) {
    return error.message;
  }

  if (isAxiosError(error)) {
    if (!error.response) {
      return 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.';
    }

    const { status } = error.response;

    if (status === 400) {
      return 'Revisa el correo y la contraseña e inténtalo de nuevo.';
    }
    if (status === 401) {
      return 'El correo o la contraseña no son correctos.';
    }
    if (status === 403) {
      return 'Tu cuenta no está activa. Comunícate con la empresa para la que trabajas.';
    }
    if (status === 404) {
      return 'No encontramos tu cuenta. Comunícate con la empresa para la que trabajas.';
    }
    if (status === 429) {
      return 'Hiciste muchos intentos. Espera un momento e inténtalo de nuevo.';
    }
    if (status >= 500) {
      return 'El servicio no está disponible en este momento. Inténtalo más tarde.';
    }
  }

  return 'No pudimos iniciar sesión. Inténtalo de nuevo.';
}
