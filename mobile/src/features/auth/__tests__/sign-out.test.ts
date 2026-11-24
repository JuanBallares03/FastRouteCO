import { signOutConfirmationMessage } from '../sign-out';

describe('signOutConfirmationMessage', () => {
  it('does not ask when there is nothing to lose', () => {
    expect(signOutConfirmationMessage(0, 0)).toBeNull();
  });

  it('counts pending and rejected actions', () => {
    expect(signOutConfirmationMessage(3, 2)).toBe(
      'Tienes 3 acciones pendientes y 2 rechazadas sin enviar. Si cierras sesión se borrarán de este teléfono.'
    );
  });

  it('uses the singular for one action', () => {
    expect(signOutConfirmationMessage(1, 0)).toBe(
      'Tienes 1 acción pendiente sin enviar. Si cierras sesión se borrarán de este teléfono.'
    );
    expect(signOutConfirmationMessage(0, 1)).toBe(
      'Tienes 1 acción rechazada sin enviar. Si cierras sesión se borrarán de este teléfono.'
    );
  });
});
