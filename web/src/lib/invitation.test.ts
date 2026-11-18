import { describe, expect, it } from 'vitest';
import {
  INVITATION_EMAIL_FAILED_MESSAGE,
  buildInvitationFeedback,
  canResendInvitation,
} from './invitation';

const INVITATION_URL = 'https://fastrouteco.example/set-password?token=abc123';

describe('buildInvitationFeedback', () => {
  it('returns the success message when the email was sent', () => {
    const feedback = buildInvitationFeedback('Supervisor creado y acceso enviado por correo', {
      emailSent: true,
      invitationUrl: INVITATION_URL,
    });

    expect(feedback).toEqual({
      message: 'Supervisor creado y acceso enviado por correo',
      invitationUrl: null,
    });
  });

  it('returns the fallback message and the link when the email failed', () => {
    const feedback = buildInvitationFeedback('Supervisor creado y acceso enviado por correo', {
      emailSent: false,
      invitationUrl: INVITATION_URL,
    });

    expect(feedback).toEqual({
      message: INVITATION_EMAIL_FAILED_MESSAGE,
      invitationUrl: INVITATION_URL,
    });
  });

  it('keeps the fallback message without a link when none is returned', () => {
    const feedback = buildInvitationFeedback('Mensaje', {
      emailSent: false,
      invitationUrl: null,
    });

    expect(feedback).toEqual({
      message: INVITATION_EMAIL_FAILED_MESSAGE,
      invitationUrl: null,
    });
  });
});

describe('canResendInvitation', () => {
  it('allows a platform admin to resend to any user that has not activated', () => {
    for (const targetRole of ['company_admin', 'supervisor', 'driver'] as const) {
      expect(
        canResendInvitation({
          actorRole: 'platform_admin',
          targetRole,
          hasActivated: false,
          sameCompany: false,
        })
      ).toBe(true);
    }
  });

  it('allows a company admin to resend to supervisors and drivers of the same company', () => {
    for (const targetRole of ['supervisor', 'driver'] as const) {
      expect(
        canResendInvitation({
          actorRole: 'company_admin',
          targetRole,
          hasActivated: false,
          sameCompany: true,
        })
      ).toBe(true);
    }
  });

  it('does not allow a company admin to resend to company admins or other companies', () => {
    expect(
      canResendInvitation({
        actorRole: 'company_admin',
        targetRole: 'company_admin',
        hasActivated: false,
        sameCompany: true,
      })
    ).toBe(false);

    expect(
      canResendInvitation({
        actorRole: 'company_admin',
        targetRole: 'driver',
        hasActivated: false,
        sameCompany: false,
      })
    ).toBe(false);
  });

  it('does not allow supervisors to resend invitations', () => {
    expect(
      canResendInvitation({
        actorRole: 'supervisor',
        targetRole: 'driver',
        hasActivated: false,
        sameCompany: true,
      })
    ).toBe(false);
  });

  it('does not allow resending to users that already activated their account', () => {
    expect(
      canResendInvitation({
        actorRole: 'platform_admin',
        targetRole: 'company_admin',
        hasActivated: true,
      })
    ).toBe(false);
  });
});
