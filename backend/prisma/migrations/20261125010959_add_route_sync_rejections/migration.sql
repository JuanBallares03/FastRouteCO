-- CreateEnum
CREATE TYPE "SyncActionType" AS ENUM ('start', 'arrival', 'completion', 'finish');

-- CreateTable
CREATE TABLE "route_reassignments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "stop_id" UUID,
    "target_route_id" UUID NOT NULL,
    "previous_driver_id" UUID NOT NULL,
    "new_driver_id" UUID NOT NULL,
    "reassigned_by" UUID NOT NULL,
    "reassigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_reassignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_sync_rejections" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "stop_id" UUID,
    "driver_id" UUID NOT NULL,
    "client_action_id" VARCHAR(64) NOT NULL,
    "action_type" "SyncActionType" NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "error_code" VARCHAR(50),
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,

    CONSTRAINT "route_sync_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_sync_rejection_photos" (
    "id" UUID NOT NULL,
    "rejection_id" UUID NOT NULL,
    "photo_url" VARCHAR(500) NOT NULL,
    "captured_at" TIMESTAMP(3),

    CONSTRAINT "route_sync_rejection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_reassignments_route_id_previous_driver_id_idx" ON "route_reassignments"("route_id", "previous_driver_id");

-- CreateIndex
CREATE INDEX "route_reassignments_stop_id_previous_driver_id_idx" ON "route_reassignments"("stop_id", "previous_driver_id");

-- CreateIndex
CREATE INDEX "route_sync_rejections_route_id_idx" ON "route_sync_rejections"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_sync_rejections_driver_id_client_action_id_key" ON "route_sync_rejections"("driver_id", "client_action_id");

-- CreateIndex
CREATE INDEX "route_sync_rejection_photos_rejection_id_idx" ON "route_sync_rejection_photos"("rejection_id");

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_target_route_id_fkey" FOREIGN KEY ("target_route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_previous_driver_id_fkey" FOREIGN KEY ("previous_driver_id") REFERENCES "drivers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_new_driver_id_fkey" FOREIGN KEY ("new_driver_id") REFERENCES "drivers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reassignments" ADD CONSTRAINT "route_reassignments_reassigned_by_fkey" FOREIGN KEY ("reassigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sync_rejections" ADD CONSTRAINT "route_sync_rejections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sync_rejections" ADD CONSTRAINT "route_sync_rejections_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sync_rejections" ADD CONSTRAINT "route_sync_rejections_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sync_rejections" ADD CONSTRAINT "route_sync_rejections_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sync_rejections" ADD CONSTRAINT "route_sync_rejections_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sync_rejection_photos" ADD CONSTRAINT "route_sync_rejection_photos_rejection_id_fkey" FOREIGN KEY ("rejection_id") REFERENCES "route_sync_rejections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
