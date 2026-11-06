import type { NextFunction, Request, Response } from 'express';
import { env } from '../../env.js';
import {
  handleWompiEvent,
  registerCardAndStartPayPerUse,
  verifyCardSetupToken,
} from './billing.service.js';
import { respondWithError } from '../../middleware/error-handler.js';

export async function wompiEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.json(await handleWompiEvent(req.body));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

function redirectToBilling(res: Response, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  res.redirect(303, `${env.WEB_APP_URL}/company/billing?${query.toString()}`);
}

export async function wompiCardHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const setup = typeof req.query.setup === 'string' ? req.query.setup : '';
  const token =
    typeof req.body?.payment_source_token === 'string'
      ? req.body.payment_source_token
      : typeof req.body?.token === 'string'
        ? req.body.token
        : '';

  try {
    if (!setup || !token) {
      throw new Error('missing setup token');
    }
    const companyId = verifyCardSetupToken(setup);
    const result = await registerCardAndStartPayPerUse(companyId, token);
    const params: Record<string, string> = {
      card: result.status.toLowerCase(),
    };
    if (result.status === 'PENDING' && result.payment) {
      params.payment = result.payment.id;
    }
    redirectToBilling(res, params);
  } catch (error) {
    if (req.accepts(['html', 'json']) === 'json') {
      if (respondWithError(error, res)) return;
      next(error);
      return;
    }
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : 'CARD_SETUP_FAILED';
    redirectToBilling(res, { card: 'error', code });
  }
}
