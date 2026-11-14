import { createServer } from "node:http";
import 'dotenv/config';
import { createApp } from "./app.js";
import { initRealtime, closeRealtime } from "./lib/realtime.js";
import { closeRateLimitStore } from "./lib/rate-limit.js";
import { prisma } from "./lib/prisma.js";
import {
  startBillingJobScheduler,
  stopBillingJobScheduler,
} from "./modules/billing/billing-jobs.js";

const app = createApp();
const PORT = process.env.PORT ?? 3000;

const server = createServer(app);
try {
  await initRealtime(server);
} catch (error) {
  console.error("Fatal: realtime initialization failed", error);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startBillingJobScheduler();
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  const forceExit = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    stopBillingJobScheduler();
    await closeRealtime();
    await closeRateLimitStore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));