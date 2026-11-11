import { isAuthenticationError } from '../http';

describe('isAuthenticationError', () => {
  it('treats 401 and 403 responses as authentication failures', () => {
    expect(
      isAuthenticationError({ isAxiosError: true, response: { status: 401 } })
    ).toBe(true);
    expect(
      isAuthenticationError({ isAxiosError: true, response: { status: 403 } })
    ).toBe(true);
  });

  it('keeps the session on network and server errors', () => {
    expect(isAuthenticationError({ isAxiosError: true, response: undefined })).toBe(false);
    expect(
      isAuthenticationError({ isAxiosError: true, response: { status: 500 } })
    ).toBe(false);
    expect(isAuthenticationError(new Error('offline'))).toBe(false);
  });
});
