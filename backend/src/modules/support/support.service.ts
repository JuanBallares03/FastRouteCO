import { Prisma, SupportStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sendSupportResponseEmail } from '../../lib/email.js';
import { createAdminNotifications } from '../../lib/notifications.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type {
  CreateSupportRequestInput,
  ListSupportRequestsInput,
  RespondSupportRequestInput,
} from './support.validation.js';

const supportInclude = {
  company: { select: { id: true, legalName: true, email: true } },
} satisfies Prisma.SupportRequestInclude;

type SupportWithCompany = Prisma.SupportRequestGetPayload<{
  include: typeof supportInclude;
}>;

function serializeSupport(request: SupportWithCompany) {
  return { ...request };
}

function buildWhere(companyId: string | undefined, status?: SupportStatus) {
  return {
    ...(companyId ? { companyId } : {}),
    ...(status ? { status } : {}),
  } satisfies Prisma.SupportRequestWhereInput;
}

async function paginate(where: Prisma.SupportRequestWhereInput, filters: ListSupportRequestsInput) {
  const [items, total] = await prisma.$transaction([
    prisma.supportRequest.findMany({
      where,
      include: supportInclude,
      orderBy: [{ sentDate: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.supportRequest.count({ where }),
  ]);

  return {
    items: items.map(serializeSupport),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function createSupportRequest(
  companyId: string,
  data: CreateSupportRequestInput
) {
  const created = await prisma.supportRequest.create({
    data: {
      companyId,
      subject: data.subject,
      description: data.description,
      status: SupportStatus.open,
    },
    include: supportInclude,
  });

  return serializeSupport(created);
}

export async function listCompanySupportRequests(
  companyId: string,
  filters: ListSupportRequestsInput
) {
  return paginate(buildWhere(companyId, filters.status), filters);
}

export async function listPlatformSupportRequests(filters: ListSupportRequestsInput) {
  return paginate(buildWhere(undefined, filters.status), filters);
}

async function findSupportRequest(id: string) {
  const request = await prisma.supportRequest.findUnique({
    where: { id },
    include: supportInclude,
  });

  if (!request) {
    throw new NotFoundError('Solicitud de soporte no encontrada', 'SUPPORT_NOT_FOUND');
  }

  return request;
}

export async function respondToSupportRequest(
  id: string,
  data: RespondSupportRequestInput
) {
  const request = await findSupportRequest(id);
  if (request.status === SupportStatus.closed) {
    throw new ConflictError('La solicitud ya está cerrada', 'SUPPORT_CLOSED');
  }

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: {
      response: data.response,
      responseDate: new Date(),
      status: SupportStatus.answered,
    },
    include: supportInclude,
  });

  await createAdminNotifications(
    prisma,
    updated.companyId,
    'support_response',
    `Respuesta a tu solicitud de soporte: ${updated.subject}`
  );

  await sendSupportResponseEmail(
    updated.company.email,
    updated.company.legalName,
    updated.subject,
    data.response
  );

  return serializeSupport(updated);
}

export async function closeSupportRequest(id: string) {
  const request = await findSupportRequest(id);
  if (request.status === SupportStatus.closed) {
    return serializeSupport(request);
  }

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: { status: SupportStatus.closed },
    include: supportInclude,
  });

  return serializeSupport(updated);
}
