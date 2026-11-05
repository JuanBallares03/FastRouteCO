import { resetPrisma } from './src/lib/prisma.js';

process.env.RESEND_API_KEY = '';

resetPrisma();
