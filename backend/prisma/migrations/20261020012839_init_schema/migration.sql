-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('platform_admin', 'company_admin', 'supervisor', 'driver');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('available', 'on_route', 'unavailable');

-- CreateEnum
CREATE TYPE "ServiceModality" AS ENUM ('subscription', 'pay_per_use');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'inactive', 'expired');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('renewal', 'consumption', 'purchase');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('delivery', 'pickup');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('whatsapp', 'phone_call', 'in_person');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'assigned', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('normal', 'urgent');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('created', 'optimized', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('pending', 'arrived', 'completed');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('incident', 'question');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('open', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('subscription', 'credit_package', 'module', 'usage');

-- CreateEnum
CREATE TYPE "UsageChargeStatus" AS ENUM ('open', 'charged', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "legalName" VARCHAR(200) NOT NULL,
    "taxId" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "address" VARCHAR(255),
    "status" "CompanyStatus" NOT NULL DEFAULT 'active',
    "has_own_fleet" BOOLEAN NOT NULL,
    "settings" JSONB,
    "card_reference" VARCHAR(100),
    "monthly_spending_limit" DECIMAL(12,2),
    "created_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(255),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "role" "UserRole" NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "user_id" UUID NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'unavailable',

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "modality" "ServiceModality" NOT NULL DEFAULT 'subscription',
    "max_drivers" INTEGER,
    "max_branches" INTEGER,
    "support_type" VARCHAR(50),
    "trial_days" INTEGER,
    "monthly_credits" INTEGER,
    "monthly_price" DECIMAL(12,2),
    "annual_price" DECIMAL(12,2),
    "included_drivers" INTEGER,
    "price_per_optimization" DECIMAL(12,2),
    "price_per_additional_driver" DECIMAL(12,2),
    "early_charge_threshold" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "billing_cycle" "BillingCycle",
    "payment_id" UUID,
    "start_date" DATE NOT NULL,
    "renewal_date" DATE,
    "end_date" DATE,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_modules" (
    "plan_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,

    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("plan_id","module_id")
);

-- CreateTable
CREATE TABLE "company_modules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" DATE,

    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_balances" (
    "company_id" UUID NOT NULL,
    "plan_credits" INTEGER NOT NULL DEFAULT 0,
    "extra_credits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "credit_packages" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_purchases" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "purchase_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" BIGSERIAL NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "resulting_balance" INTEGER NOT NULL,
    "purchase_id" UUID,
    "optimization_id" UUID,
    "transaction_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "type" "OrderType" NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "priority" "OrderPriority" NOT NULL DEFAULT 'normal',
    "customer_name" VARCHAR(150),
    "customer_phone" VARCHAR(30),
    "description" TEXT,
    "channel" "OrderChannel",
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "created_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "route_date" DATE NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'created',
    "start_latitude" DECIMAL(9,6),
    "start_longitude" DECIMAL(9,6),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "order_id" UUID,
    "student_id" UUID,
    "sequence" INTEGER NOT NULL,
    "status" "StopStatus" NOT NULL DEFAULT 'pending',
    "arrived_at" TIMESTAMP(3),
    "is_geofence_verified" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3),
    "notes" TEXT,
    "recipient_name" VARCHAR(150),

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_optimizations" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "total_distance_m" INTEGER,
    "estimated_duration_s" INTEGER,
    "processing_time_ms" INTEGER,
    "is_successful" BOOLEAN NOT NULL,
    "usage_charge_id" UUID,
    "optimization_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_optimizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_locations" (
    "id" BIGSERIAL NOT NULL,
    "route_id" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_offline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "route_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_photos" (
    "id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,
    "photo_url" VARCHAR(500) NOT NULL,
    "captured_at" TIMESTAMP(3),

    CONSTRAINT "evidence_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "stop_id" UUID,
    "category" "IncidentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "resolution_notes" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_messages" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "incident_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'open',
    "response" TEXT,
    "sent_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_date" DATE,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" BIGSERIAL NOT NULL,
    "company_id" UUID,
    "severity" "AlertSeverity" NOT NULL,
    "source" VARCHAR(100),
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "pickup_address" VARCHAR(255) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" VARCHAR(30),
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "gateway_reference" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_charges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "period_start_date" DATE NOT NULL,
    "period_end_date" DATE,
    "optimization_count" INTEGER NOT NULL DEFAULT 0,
    "additional_drivers" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "UsageChargeStatus" NOT NULL DEFAULT 'open',
    "payment_id" UUID,

    CONSTRAINT "usage_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_taxId_key" ON "companies"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_company_id_key" ON "subscriptions"("company_id") WHERE (status = 'active');

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "route_stops_route_id_sequence_key" ON "route_stops"("route_id", "sequence");

-- CreateIndex
CREATE INDEX "route_locations_route_id_captured_at_idx" ON "route_locations"("route_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_reference_key" ON "payments"("gateway_reference");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "credit_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "credit_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "route_optimizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_optimizations" ADD CONSTRAINT "route_optimizations_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_optimizations" ADD CONSTRAINT "route_optimizations_usage_charge_id_fkey" FOREIGN KEY ("usage_charge_id") REFERENCES "usage_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_locations" ADD CONSTRAINT "route_locations_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photos" ADD CONSTRAINT "evidence_photos_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_messages" ADD CONSTRAINT "incident_messages_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_messages" ADD CONSTRAINT "incident_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints for credit_balances
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_plan_credits_non_negative" CHECK ("plan_credits" >= 0);
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_extra_credits_non_negative" CHECK ("extra_credits" >= 0);
