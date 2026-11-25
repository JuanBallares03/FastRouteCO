import { Prisma, RouteStatus, SyncActionType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { emitToCompany } from '../../lib/realtime.js';
import {
  evidenceFolder,
  isEvidenceUrlInFolder,
  signEvidenceUpload,
} from './evidence-signature.js';

// Offline driver actions the server rejected after a reassignment or a closed
// route, reported once by the phone so the supervisor can review them
// (RF07, HU-10 CA03, HU-36 CA04 and CA05).

export const SYNC_REJECTION_CODES = [
  'ROUTE_NOT_FOUND',
  'ROUTE_NOT_IN_PROGRESS',
  'STOP_NOT_FOUND',
] as const;

export type SyncRejectionCode = (typeof SYNC_REJECTION_CODES)[number];

export interface SyncRejectionReportInput {
  clientActionId: string;
  routeId: string;
  stopId?: string;
  actionType: SyncActionType;
  capturedAt: Date;
  reason: string;
  errorCode?: SyncRejectionCode;
  photos: Array<{ photoUrl: string; capturedAt?: Date }>;
}

const routeNotFound = () => new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');

function pendingEvidenceFolder(companyId: string, routeId: string, stopId: string) {
  return `${evidenceFolder(companyId, routeId, stopId)}/pending`;
}

// Accepts the report only when the driver really did the action on that route:
//   1. their own route, already closed (finished or cancelled on the panel);
//   2. a whole-route reassignment away from them (target_route_id = route_id,
//      so a stop reassignment whose stop_id became NULL never matches);
//   3. a reassignment of that stop away from them.
// Any other case answers 404 like findDriverRoute, so route ids of other
// drivers are not confirmed.
async function authorizeSyncReport(
  companyId: string,
  driverId: string,
  routeId: string,
  stopId: string | undefined
) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    select: { id: true, driverId: true, status: true },
  });
  if (!route) throw routeNotFound();

  const stopInRoute = stopId
    ? (await prisma.routeStop.count({ where: { id: stopId, routeId } })) > 0
    : true;
  const isOwnRoute = route.driverId === driverId;

  if (isOwnRoute && route.status !== RouteStatus.in_progress && stopInRoute) {
    return route;
  }

  const wholeRouteReassignment = await prisma.routeReassignment.count({
    where: {
      companyId,
      routeId,
      targetRouteId: routeId,
      stopId: null,
      previousDriverId: driverId,
    },
  });
  if (wholeRouteReassignment > 0 && stopInRoute) {
    return route;
  }

  if (stopId) {
    const stopReassignment = await prisma.routeReassignment.count({
      where: { companyId, routeId, stopId, previousDriverId: driverId },
    });
    if (stopReassignment > 0) {
      return route;
    }
  }

  if (isOwnRoute && stopInRoute) {
    throw new ConflictError(
      'La ruta sigue asignada y en curso; la acción se puede sincronizar',
      'SYNC_REJECTION_NOT_APPLICABLE'
    );
  }

  throw routeNotFound();
}

export async function createSyncRejectionSignature(
  companyId: string,
  driverId: string,
  routeId: string,
  stopId: string
) {
  await authorizeSyncReport(companyId, driverId, routeId, stopId);
  return signEvidenceUpload(pendingEvidenceFolder(companyId, routeId, stopId));
}

const rejectionInclude = {
  photos: { orderBy: { capturedAt: 'asc' } },
} satisfies Prisma.RouteSyncRejectionInclude;

type RejectionWithPhotos = Prisma.RouteSyncRejectionGetPayload<{
  include: typeof rejectionInclude;
}>;

export function serializeSyncRejection(rejection: RejectionWithPhotos) {
  return {
    id: rejection.id,
    routeId: rejection.routeId,
    stopId: rejection.stopId,
    driverId: rejection.driverId,
    clientActionId: rejection.clientActionId,
    actionType: rejection.actionType,
    capturedAt: rejection.capturedAt,
    reason: rejection.reason,
    errorCode: rejection.errorCode,
    reportedAt: rejection.reportedAt,
    reviewedAt: rejection.reviewedAt,
    photos: rejection.photos.map((photo) => ({
      id: photo.id,
      photoUrl: photo.photoUrl,
      capturedAt: photo.capturedAt,
    })),
  };
}

const supervisorInclude = {
  ...rejectionInclude,
  driver: { select: { userId: true, user: { select: { fullName: true } } } },
  stop: { select: { id: true, sequence: true, routeId: true } },
} satisfies Prisma.RouteSyncRejectionInclude;

type SupervisorRejection = Prisma.RouteSyncRejectionGetPayload<{
  include: typeof supervisorInclude;
}>;

function serializeForSupervisor(rejection: SupervisorRejection) {
  return {
    ...serializeSyncRejection(rejection),
    driverName: rejection.driver.user.fullName,
    // The stop may have moved to another route after a stop reassignment.
    stop: rejection.stop,
  };
}

// Reports of a route of the company, oldest action first (RF07, HU-10 CA03).
export async function listRouteSyncRejections(companyId: string, routeId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    select: { id: true },
  });
  if (!route) throw routeNotFound();

  const rejections = await prisma.routeSyncRejection.findMany({
    where: { companyId, routeId },
    include: supervisorInclude,
    orderBy: [{ capturedAt: 'asc' }, { reportedAt: 'asc' }],
  });
  return rejections.map(serializeForSupervisor);
}

export async function reviewSyncRejection(
  companyId: string,
  routeId: string,
  rejectionId: string,
  reviewedById: string
) {
  const rejection = await prisma.routeSyncRejection.findFirst({
    where: { id: rejectionId, routeId, companyId },
    include: supervisorInclude,
  });
  if (!rejection) {
    throw new NotFoundError('Reporte no encontrado', 'SYNC_REJECTION_NOT_FOUND');
  }
  if (rejection.reviewedAt) {
    return serializeForSupervisor(rejection);
  }

  const updated = await prisma.routeSyncRejection.update({
    where: { id: rejection.id },
    data: { reviewedAt: new Date(), reviewedById },
    include: supervisorInclude,
  });

  emitToCompany(companyId, 'route:sync-rejection-reviewed', {
    routeId,
    rejectionId: updated.id,
  });
  return serializeForSupervisor(updated);
}

async function findReported(driverId: string, clientActionId: string) {
  return prisma.routeSyncRejection.findUnique({
    where: { driverId_clientActionId: { driverId, clientActionId } },
    include: rejectionInclude,
  });
}

// Idempotent per (driver, clientActionId): a retried report returns the stored one.
export async function reportSyncRejection(
  companyId: string,
  driverId: string,
  input: SyncRejectionReportInput
): Promise<{ created: boolean; rejection: ReturnType<typeof serializeSyncRejection> }> {
  const existing = await findReported(driverId, input.clientActionId);
  if (existing) {
    return { created: false, rejection: serializeSyncRejection(existing) };
  }

  await authorizeSyncReport(companyId, driverId, input.routeId, input.stopId);

  if (input.photos.length > 0) {
    const folder = input.stopId
      ? pendingEvidenceFolder(companyId, input.routeId, input.stopId)
      : null;
    if (!folder || !input.photos.every((photo) => isEvidenceUrlInFolder(photo.photoUrl, folder))) {
      throw new BadRequestError(
        'Las fotos deben subirse con la firma del reporte',
        'INVALID_EVIDENCE_URL'
      );
    }
  }

  let rejection: RejectionWithPhotos;
  try {
    rejection = await prisma.routeSyncRejection.create({
      data: {
        companyId,
        routeId: input.routeId,
        stopId: input.stopId ?? null,
        driverId,
        clientActionId: input.clientActionId,
        actionType: input.actionType,
        capturedAt: input.capturedAt,
        reason: input.reason,
        errorCode: input.errorCode ?? null,
        photos: {
          create: input.photos.map((photo) => ({
            photoUrl: photo.photoUrl,
            capturedAt: photo.capturedAt ?? null,
          })),
        },
      },
      include: rejectionInclude,
    });
  } catch (error) {
    // Two concurrent retries of the same report: the second one returns the first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const stored = await findReported(driverId, input.clientActionId);
      if (stored) return { created: false, rejection: serializeSyncRejection(stored) };
    }
    throw error;
  }

  emitToCompany(companyId, 'route:sync-rejected', {
    routeId: rejection.routeId,
    rejectionId: rejection.id,
  });

  return { created: true, rejection: serializeSyncRejection(rejection) };
}
