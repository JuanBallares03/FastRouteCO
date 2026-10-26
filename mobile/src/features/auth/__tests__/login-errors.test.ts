import {
  LoginBlockedError,
  getLoginErrorMessage,
  isDriverRole,
} from '../auth-errors';
import { hasErrors, validateLoginForm } from '../login-validation';

describe('validateLoginForm', () => {
  it('requires an email', () => {
    expect(validateLoginForm('', 'secret').email).toBe('Escribe tu correo.');
  });

  it('rejects an invalid email', () => {
    expect(validateLoginForm('driver', 'secret').email).toBe('Escribe un correo válido.');
  });

  it('requires a password', () => {
    expect(validateLoginForm('driver@example.com', '').password).toBe('Escribe tu contraseña.');
  });

  it('accepts valid credentials', () => {
    const errors = validateLoginForm('driver@example.com', 'secret');
    expect(hasErrors(errors)).toBe(false);
  });
});

describe('getLoginErrorMessage', () => {
  it('explains wrong credentials', () => {
    const error = { isAxiosError: true, response: { status: 401 } };
    expect(getLoginErrorMessage(error)).toBe('El correo o la contraseña no son correctos.');
  });

  it('explains connection problems', () => {
    const error = { isAxiosError: true, response: undefined };
    expect(getLoginErrorMessage(error)).toContain('No pudimos conectar');
  });

  it('keeps the blocked role message', () => {
    expect(getLoginErrorMessage(new LoginBlockedError('Solo conductores'))).toBe('Solo conductores');
  });
});

describe('isDriverRole', () => {
  it('only accepts the driver role', () => {
    expect(isDriverRole('driver')).toBe(true);
    expect(isDriverRole('company_admin')).toBe(false);
    expect(isDriverRole(undefined)).toBe(false);
  });
});
