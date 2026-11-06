import express from "express";
import cors from "cors";
import helmet from "helmet";
import 'dotenv/config';
import { env } from "./env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import platformRoutes from "./modules/companies/companies.routes.js";
import offeringRoutes from "./modules/billing/offerings.routes.js";
import companyRoutes from "./modules/company/company.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";
import routeRoutes from "./modules/routes/routes.routes.js";
import paymentRoutes from "./modules/billing/payments.routes.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: env.WEB_APP_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/platform", platformRoutes);
app.use("/api/v1/platform", offeringRoutes);
app.use("/api/v1/company", companyRoutes);
app.use("/api/v1/company", billingRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/routes", routeRoutes);
app.use("/api/v1/payments", paymentRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});