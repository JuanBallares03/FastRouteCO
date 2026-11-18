export type InvitationRole = 'platform_admin' | 'company_admin' | 'supervisor' | 'driver';

export const INVITATION_EMAIL_FAILED_MESSAGE =
  'No pudimos enviar el correo. Comparte este enlace con la persona:';

export interface InvitationDelivery {
  emailSent: boolean;
  invitationUrl?: string | null;
}

export interface InvitationFeedback {
  message: string;
  invitationUrl: string | null;
}

export function buildInvitationFeedback(
  successMessage: string,
  delivery: InvitationDelivery
): InvitationFeedback {
  if (delivery.emailSent) {
    return { message: successMessage, invitationUrl: null };
  }

  return {
    message: INVITATION_EMAIL_FAILED_MESSAGE,
    invitationUrl: delivery.invitationUrl ?? null,
  };
}

export function canResendInvitation(params: {
  actorRole: InvitationRole;
  targetRole: InvitationRole;
  hasActivated: boolean;
  sameCompany?: boolean;
}): boolean {
  if (params.hasActivated) return false;

  if (params.actorRole === 'platform_admin') return true;

  return (
    params.actorRole === 'company_admin' &&
    params.sameCompany !== false &&
    (params.targetRole === 'supervisor' || params.targetRole === 'driver')
  );
}
