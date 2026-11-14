import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';

const app = createApp();

describe('Company report routes', () => {
  it.each(['/dashboard', '/summary', '/routes'])(
    'serves %s under /api/v1/company/reports',
    async (path) => {
      const response = await request(app).get(`/api/v1/company/reports${path}`);

      expect(response.status).not.toBe(404);
      expect(response.status).toBe(401);
    }
  );
});
