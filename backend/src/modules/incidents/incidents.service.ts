import { IncidentStatus, Prisma, RouteStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { emitToCompany } from '../../lib/realtime.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type {
  AddIncidentMessageInput,
  CreateIncidentInput,
  ListIncidentsInput,
  UpdateIncidentInput,
} from './incidents.validation.js';

const incidentInclude = {
  route: {
    select: {
      id: true,
      routeDate: true,
      status: true,
      driverId: true,
      driver: {
        select: {
          user: { select: { id: true, fullName: true, phone: true } },
        },
      },
    },
  },
  stop: {
    select: { id: true, sequence: true, status: true },
  },
  messages: {
    orderBy: { sentAt: 'asc' as const },
    include: {
      sender: { select: { id: true, fullName: true, role: true } },
    },
  },
} satisfies Prisma.IncidentInclude;

type IncidentWithRelations = Prisma.IncidentGetPayload<{ include: typeof incidentInclude }>;

function serializeIncident(incident: IncidentWithRelations) {
  return {
    ...incident,
    messages: incident.messages.map((message) => ({
      ...message,
      id: message.id.toString(),
    })),
  };
}

async function findIncident(companyId: string, incidentId: string) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, route: { companyId } },
    include: incidentInclude,
  });

  if (!incident) {
    throw new NotFoundError('Incidencia no encontrada', 'INCIDENT_NOT_FOUND');
  }

  return incident;
}

export async function createIncident(
  companyId: string,
  driverId: string,
  data: CreateIncidentInput
) {
  const route = await prisma.route.findFirst({
    where: { id: data.routeId, companyId, driverId },
    include: { stops: { select: { id: true } } },
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  if (route.status !== RouteStatus.in_progress) {
    throw new ConflictError('La ruta no está en curso', 'ROUTE_NOT_IN_PROGRESS');
  }

  if (data.stopId && !route.stops.some((stop) => stop.id === data.stopId)) {
    throw new NotFoundError('Parada no encontrada', 'STOP_NOT_FOUND');
  }

  const created = await prisma.incident.create({
    data: {
      routeId: route.id,
      stopId: data.stopId ?? null,
      category: data.category,
      description: data.description,
      status: IncidentStatus.open,
    },
  });

  const incident = serializeIncident(await findIncident(companyId, created.id));
  emitToCompany(companyId, 'incident:created', incident);
  return incident;
}

function buildListWhere(companyId: string, filters: ListIncidentsInput) {
  return {
    route: {
      companyId,
      ...(filters.routeId ? { id: filters.routeId } : {}),
    },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  } satisfies Prisma.IncidentWhereInput;
}

export async function listCompanyIncidents(companyId: string, filters: ListIncidentsInput) {
  const incidents = await prisma.incident.findMany({
    where: buildListWhere(companyId, filters),
    include: incidentInclude,
    orderBy: [{ status: 'asc' }, { reportedAt: 'desc' }],
  });

  return incidents.map(serializeIncident);
}

export async function listDriverIncidents(
  companyId: string,
  driverId: string,
  filters: ListIncidentsInput
) {
  const incidents = await prisma.incident.findMany({
    where: {
      ...buildListWhere(companyId, filters),
      route: {
        companyId,
        driverId,
        ...(filters.routeId ? { id: filters.routeId } : {}),
      },
    },
    include: incidentInclude,
    orderBy: [{ status: 'asc' }, { reportedAt: 'desc' }],
  });

  return incidents.map(serializeIncident);
}

export async function getIncident(
  companyId: string,
  incidentId: string,
  userId: string,
  role: UserRole
) {
  const incident = await findIncident(companyId, incidentId);
  assertIncidentAccess(incident, userId, role);
  return serializeIncident(incident);
}

function assertIncidentAccess(
  incident: IncidentWithRelations,
  userId: string,
  role: UserRole
) {
  if (role === UserRole.driver && incident.route.driverId !== userId) {
    throw new ForbiddenError('No tienes acceso a esta incidencia', 'INCIDENT_FORBIDDEN');
  }
}

export async function addIncidentMessage(
  companyId: string,
  incidentId: string,
  userId: string,
  role: UserRole,
  data: AddIncidentMessageInput
) {
  const incident = await findIncident(companyId, incidentId);
  assertIncidentAccess(incident, userId, role);

  if (incident.status === IncidentStatus.resolved) {
    throw new ConflictError('La incidencia ya está resuelta', 'INCIDENT_RESOLVED');
  }

  const message = await prisma.incidentMessage.create({
    data: {
      incidentId: incident.id,
      senderId: userId,
      message: data.message,
    },
    include: {
      sender: { select: { id: true, fullName: true, role: true } },
    },
  });

  if (
    incident.status === IncidentStatus.open &&
    (role === UserRole.supervisor || role === UserRole.company_admin)
  ) {
    await prisma.incident.update({
      where: { id: incident.id },
      data: { status: IncidentStatus.in_progress },
    });
  }

  const updated = serializeIncident(await findIncident(companyId, incident.id));
  const serializedMessage = { ...message, id: message.id.toString() };
  emitToCompany(companyId, 'incident:message', {
    incidentId: incident.id,
    message: serializedMessage,
  });
  emitToCompany(companyId, 'incident:updated', updated);

  return { message: serializedMessage, incident: updated };
}

export async function updateIncident(
  companyId: string,
  incidentId: string,
  data: UpdateIncidentInput
) {
  const incident = await findIncident(companyId, incidentId);

  const status = data.status ?? incident.status;
  const resolvedAt =
    status === IncidentStatus.resolved
      ? incident.resolvedAt ?? new Date()
      : status === IncidentStatus.open || status === IncidentStatus.in_progress
        ? null
        : incident.resolvedAt;

  await prisma.incident.update({
    where: { id: incident.id },
    data: {
      status,
      resolutionNotes: data.resolutionNotes ?? incident.resolutionNotes,
      resolvedAt,
    },
  });

  const updated = serializeIncident(await findIncident(companyId, incident.id));
  emitToCompany(companyId, 'incident:updated', updated);
  return updated;
}
