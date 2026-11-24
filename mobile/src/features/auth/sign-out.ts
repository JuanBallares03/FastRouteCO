// Text of the confirmation shown before a manual sign-out that would delete
// offline actions not sent yet (RF17, HU-36). Returns null when there are none.
export function signOutConfirmationMessage(pending: number, rejected: number): string | null {
  const parts: string[] = [];
  if (pending > 0) {
    parts.push(`${pending} ${pending === 1 ? 'acción pendiente' : 'acciones pendientes'}`);
  }
  if (rejected > 0) {
    const noun = pending > 0 ? '' : rejected === 1 ? 'acción ' : 'acciones ';
    parts.push(`${rejected} ${noun}${rejected === 1 ? 'rechazada' : 'rechazadas'}`);
  }
  if (parts.length === 0) return null;

  return `Tienes ${parts.join(' y ')} sin enviar. Si cierras sesión se borrarán de este teléfono.`;
}
