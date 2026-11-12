-- CreateIndex
CREATE INDEX "credit_transactions_company_id_type_transaction_date_idx" ON "credit_transactions"("company_id", "type", "transaction_date");

-- CreateIndex
CREATE INDEX "incidents_route_id_status_reported_at_idx" ON "incidents"("route_id", "status", "reported_at");

-- CreateIndex
CREATE INDEX "orders_company_id_status_created_at_idx" ON "orders"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payments_company_id_status_created_at_idx" ON "payments"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "route_stops_order_id_idx" ON "route_stops"("order_id");

-- CreateIndex
CREATE INDEX "routes_company_id_route_date_status_idx" ON "routes"("company_id", "route_date", "status");

-- CreateIndex
CREATE INDEX "usage_charges_company_id_status_period_start_date_idx" ON "usage_charges"("company_id", "status", "period_start_date");

-- CreateIndex
CREATE INDEX "users_company_id_role_is_active_idx" ON "users"("company_id", "role", "is_active");
