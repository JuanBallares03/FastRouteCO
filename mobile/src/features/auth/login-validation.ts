export interface LoginFormErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(email: string, password: string): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    errors.email = 'Escribe tu correo.';
  } else if (!EMAIL_PATTERN.test(cleanEmail)) {
    errors.email = 'Escribe un correo válido.';
  }

  if (!password) {
    errors.password = 'Escribe tu contraseña.';
  }

  return errors;
}

export function hasErrors(errors: LoginFormErrors): boolean {
  return Boolean(errors.email || errors.password);
}
