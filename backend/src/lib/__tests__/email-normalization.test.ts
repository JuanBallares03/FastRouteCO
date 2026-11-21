import { describe, it, expect } from 'vitest';
import { emailSchema, normalizeEmail } from '../email-normalization.js';

describe('email normalization', () => {
  it('trims and lowercases an email', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('normalizes the email schema output', () => {
    expect(emailSchema.parse('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('rejects an invalid email after normalization', () => {
    expect(() => emailSchema.parse('  invalid  ')).toThrow();
  });
});
