import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';
import { AppError, ServiceUnavailableError } from './errors.js';

const API_BASE_URL = 'https://api.wompi.co/v1';
const CHECKOUT_BASE_URL = 'https://checkout.wompi.co/p/';
const CURRENCY = 'COP';

export class WompiError extends AppError {
  constructor(message: string, code = 'WOMPI_ERROR') {
    super(message, 502, code);
    this.name = 'WompiError';
  }
}

function requireValue(value: string, name: string): string {
  if (!value) {
    throw new ServiceUnavailableError(
      `La pasarela de pagos no está configurada (${name})`,
      'PAYMENT_GATEWAY_NOT_CONFIGURED'
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function integritySignature(reference: string, amountInCents: number): string {
  const secret = requireValue(env.WOMPI_INTEGRITY_SECRET, 'WOMPI_INTEGRITY_SECRET');
  return sha256(`${reference}${amountInCents}${CURRENCY}${secret}`);
}

export function buildCheckoutUrl(params: {
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  customerEmail?: string;
}): string {
  const publicKey = requireValue(env.WOMPI_PUBLIC_KEY, 'WOMPI_PUBLIC_KEY');
  const query = new URLSearchParams({
    'public-key': publicKey,
    currency: CURRENCY,
    'amount-in-cents': String(params.amountInCents),
    reference: params.reference,
    'signature:integrity': integritySignature(params.reference, params.amountInCents),
    'redirect-url': params.redirectUrl,
  });

  if (params.customerEmail) {
    query.set('customer-data:email', params.customerEmail);
  }

  return `${CHECKOUT_BASE_URL}?${query.toString()}`;
}

interface WompiEvent {
  event: string;
  data: Record<string, unknown>;
  environment: string;
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
}

function valueAtPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function verifyWompiEvent(payload: unknown): payload is WompiEvent {
  if (!payload || typeof payload !== 'object') return false;

  const event = payload as Partial<WompiEvent>;
  if (
    typeof event.event !== 'string' ||
    !event.data ||
    !event.signature ||
    !Array.isArray(event.signature.properties) ||
    typeof event.signature.checksum !== 'string' ||
    typeof event.timestamp !== 'number'
  ) {
    return false;
  }

  const secret = env.WOMPI_EVENTS_SECRET;
  if (!secret) return false;

  const values = event.signature.properties.map((property) => {
    const value = valueAtPath(event.data!, property);
    return value === null || value === undefined ? '' : String(value);
  });
  const expected = sha256(`${values.join('')}${event.timestamp}${secret}`);
  const received = event.signature.checksum.toLowerCase();

  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const data = payload as
      | { error?: { message?: string; type?: string }; message?: string }
      | null;
    throw new WompiError(
      data?.error?.message ?? data?.message ?? 'Wompi rechazó la solicitud'
    );
  }

  return payload as T;
}

async function request<T>(
  path: string,
  init: RequestInit,
  authorization: string
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorization}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new WompiError('No se pudo contactar la pasarela de pagos');
  }

  return parseResponse<T>(response);
}

interface MerchantInfoResponse {
  data: {
    presigned_acceptance: { acceptance_token: string };
    presigned_personal_data_auth: { acceptance_token: string };
  };
}

interface PaymentSourceResponse {
  data: {
    id: number;
    type: string;
    status: string;
  };
}

export interface WompiTransaction {
  id: string;
  status: string;
  amount_in_cents: number;
  currency: string;
  reference: string;
  payment_method_type?: string;
  payment_source_id?: number | null;
  payment_method?: {
    type?: string;
    extra?: {
      last_four?: string;
      brand?: string;
    };
  };
}

interface TransactionResponse {
  data: WompiTransaction;
}

export async function createCardPaymentSource(params: {
  token: string;
  customerEmail: string;
}): Promise<{ id: number; status: string }> {
  const publicKey = requireValue(env.WOMPI_PUBLIC_KEY, 'WOMPI_PUBLIC_KEY');
  const merchant = await request<MerchantInfoResponse>(
    '/merchants/info',
    { method: 'GET', headers: { 'x-merchant-public-key': publicKey } },
    publicKey
  );

  const source = await request<PaymentSourceResponse>(
    '/payment_sources',
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'CARD',
        token: params.token,
        customer_email: params.customerEmail,
        acceptance_token: merchant.data.presigned_acceptance.acceptance_token,
        accept_personal_auth:
          merchant.data.presigned_personal_data_auth.acceptance_token,
      }),
    },
    requireValue(env.WOMPI_PRIVATE_KEY, 'WOMPI_PRIVATE_KEY')
  );

  return { id: source.data.id, status: source.data.status };
}

export async function chargePaymentSource(params: {
  amountInCents: number;
  customerEmail: string;
  reference: string;
  paymentSourceId: number;
}): Promise<WompiTransaction> {
  const privateKey = requireValue(env.WOMPI_PRIVATE_KEY, 'WOMPI_PRIVATE_KEY');
  const response = await request<TransactionResponse>(
    '/transactions',
    {
      method: 'POST',
      body: JSON.stringify({
        amount_in_cents: params.amountInCents,
        currency: CURRENCY,
        signature: integritySignature(params.reference, params.amountInCents),
        customer_email: params.customerEmail,
        reference: params.reference,
        payment_source_id: params.paymentSourceId,
        payment_method: { installments: 1 },
      }),
    },
    privateKey
  );

  return response.data;
}

export { CURRENCY as WOMPI_CURRENCY };
