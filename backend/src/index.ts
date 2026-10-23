import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes.js";
import platformRoutes from "./modules/companies/companies.routes.js";
import companyRoutes from "./modules/company/company.routes.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/platform", platformRoutes);
app.use("/api/v1/company", companyRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});