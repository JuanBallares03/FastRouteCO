import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const messages: { field: string; message: string }[] = [];
      for (const [field, msgs] of Object.entries(errors)) {
        if (Array.isArray(msgs)) {
          for (const msg of msgs) {
            messages.push({ field, message: msg });
          }
        }
      }
      res.status(400).json({ errors: messages });
      return;
    }
    next();
  };
}