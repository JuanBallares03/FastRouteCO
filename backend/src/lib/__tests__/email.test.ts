import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, ResendMock } = vi.hoisted(() => {
  const sendMock = vi.fn();
  class ResendMock {
    emails = { send: sendMock };
  }
  return { sendMock, ResendMock };
});

vi.mock('resend', () => ({ Resend: ResendMock }));

const DEFAULT_FROM = 'FastRouteCO <onboarding@resend.dev>';

async function loadEmailModule() {
  return import('../email.js');
}

beforeEach(() => {
  vi.resetModules();
  sendMock.mockReset();
  process.env.RESEND_API_KEY = 're_test_key';
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  delete process.env.EMAIL_FROM;
  vi.restoreAllMocks();
});

describe('sendEmail', () => {
  it('uses the default Resend test sender when EMAIL_FROM is not set', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    const { sendEmail } = await loadEmailModule();
    const sent = await sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });

    expect(sent).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: DEFAULT_FROM })
    );
  });

  it('uses EMAIL_FROM when it is configured', async () => {
    process.env.EMAIL_FROM = 'Custom Sender <custom@example.com>';
    sendMock.mockResolvedValue({ data: { id: 'email-2' }, error: null });

    const { sendEmail } = await loadEmailModule();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Custom Sender <custom@example.com>' })
    );
  });

  it('returns false and logs the Resend error code and message', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: 'validation_error',
        message: 'Domain not verified: Verify fastrouteco.com',
        statusCode: 403,
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendEmail } = await loadEmailModule();
    const sent = await sendEmail({
      to: 'user@example.com',
      subject: 'Private subject',
      html: '<p>Private body</p>',
    });

    expect(sent).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const logged = JSON.stringify(errorSpy.mock.calls[0]);
    expect(logged).toContain('validation_error');
    expect(logged).toContain('403');
    expect(logged).toContain('Domain not verified');
    expect(logged).not.toContain('re_test_key');
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('Private subject');
    expect(logged).not.toContain('Private body');
  });

  it('returns false and logs a thrown error without leaking the email', async () => {
    sendMock.mockRejectedValue(new Error('fetch failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendEmail } = await loadEmailModule();
    const sent = await sendEmail({
      to: 'user@example.com',
      subject: 'Private subject',
      html: '<p>Private body</p>',
    });

    expect(sent).toBe(false);
    const logged = JSON.stringify(errorSpy.mock.calls[0]);
    expect(logged).toContain('fetch failed');
    expect(logged).not.toContain('re_test_key');
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('Private body');
  });
});
