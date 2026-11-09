import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getGeocoder } from '../../lib/geocoding.js';
import { parseBusinessDate, todayInBogota } from '../../lib/dates.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateStudentInput, ListStudentsInput, UpdateStudentInput } from './students.validation.js';

const SCHOOL_MODULE_CODE = 'school_transport';

interface GeocodingOutcome {
  latitude: number | null;
  longitude: number | null;
  warning?: string;
}

function serializeStudent(
  student: Prisma.StudentGetPayload<Record<string, never>>
) {
  return {
    ...student,
    latitude: student.latitude === null ? null : Number(student.latitude),
    longitude: student.longitude === null ? null : Number(student.longitude),
  };
}

async function geocodePickupAddress(address: string): Promise<GeocodingOutcome> {
  let result;
  try {
    result = await getGeocoder().geocode(address);
  } catch {
    return {
      latitude: null,
      longitude: null,
      warning:
        'La dirección no se pudo geocodificar en este momento. El estudiante se guardó sin coordenadas.',
    };
  }

  if (!result) {
    throw new BadRequestError(
      'No se pudo geocodificar la dirección de recogida. Verifica que sea válida.',
      'ADDRESS_NOT_FOUND'
    );
  }

  return { latitude: result.latitude, longitude: result.longitude };
}

export async function getSchoolTransportEntitlement(companyId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { companyId, status: SubscriptionStatus.active },
    include: { plan: { include: { planModules: { include: { module: true } } } } },
    orderBy: { startDate: 'desc' },
  });

  if (!subscription) {
    return {
      enabled: false,
      reason: 'La empresa no tiene una suscripción activa.',
    };
  }

  const included = subscription.plan.planModules.some(
    (entry) => entry.module.code === SCHOOL_MODULE_CODE && entry.module.isActive
  );
  if (included) {
    return { enabled: true, reason: null };
  }

  const today = parseBusinessDate(todayInBogota());
  const purchased = await prisma.companyModule.findFirst({
    where: {
      companyId,
      module: { code: SCHOOL_MODULE_CODE, isActive: true },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
  });

  if (purchased) {
    return { enabled: true, reason: null };
  }

  return {
    enabled: false,
    reason:
      'El módulo de transporte escolar no está incluido en tu plan ni fue comprado. Actívalo desde Suscripción y créditos.',
  };
}

export async function assertSchoolTransportEnabled(companyId: string) {
  const entitlement = await getSchoolTransportEntitlement(companyId);
  if (!entitlement.enabled) {
    throw new ForbiddenError(
      entitlement.reason ?? 'Módulo de transporte escolar no habilitado',
      'MODULE_NOT_ENABLED'
    );
  }
}

export async function listStudents(companyId: string, filters: ListStudentsInput) {
  await assertSchoolTransportEnabled(companyId);
  const students = await prisma.student.findMany({
    where: {
      companyId,
      ...(filters.active === 'true'
        ? { isActive: true }
        : filters.active === 'false'
          ? { isActive: false }
          : {}),
    },
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });

  return students.map(serializeStudent);
}

export async function createStudent(companyId: string, data: CreateStudentInput) {
  await assertSchoolTransportEnabled(companyId);
  const geocoding = await geocodePickupAddress(data.pickupAddress);

  const student = await prisma.student.create({
    data: {
      companyId,
      fullName: data.fullName,
      pickupAddress: data.pickupAddress,
      latitude: geocoding.latitude,
      longitude: geocoding.longitude,
      isActive: true,
    },
  });

  return {
    ...serializeStudent(student),
    geocoded: geocoding.latitude !== null,
    warning: geocoding.warning,
  };
}

async function findStudent(companyId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, companyId },
  });

  if (!student) {
    throw new NotFoundError('Estudiante no encontrado', 'STUDENT_NOT_FOUND');
  }

  return student;
}

export async function updateStudent(
  companyId: string,
  studentId: string,
  data: UpdateStudentInput
) {
  await assertSchoolTransportEnabled(companyId);
  const student = await findStudent(companyId, studentId);

  let geocoding: GeocodingOutcome | null = null;
  if (data.pickupAddress && data.pickupAddress !== student.pickupAddress) {
    geocoding = await geocodePickupAddress(data.pickupAddress);
  }

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: {
      fullName: data.fullName,
      pickupAddress: data.pickupAddress,
      ...(geocoding
        ? { latitude: geocoding.latitude, longitude: geocoding.longitude }
        : {}),
    },
  });

  return {
    ...serializeStudent(updated),
    geocoded: updated.latitude !== null,
    warning: geocoding?.warning,
  };
}

export async function updateStudentStatus(
  companyId: string,
  studentId: string,
  isActive: boolean
) {
  const student = await findStudent(companyId, studentId);
  const updated = await prisma.student.update({
    where: { id: student.id },
    data: { isActive },
  });

  return serializeStudent(updated);
}

export async function assertStudentsAvailable(companyId: string, studentIds: string[]) {
  const uniqueIds = [...new Set(studentIds)];
  if (uniqueIds.length === 0) return [];

  await assertSchoolTransportEnabled(companyId);
  const students = await prisma.student.findMany({
    where: { id: { in: uniqueIds }, companyId, isActive: true },
  });

  if (students.length !== uniqueIds.length) {
    throw new NotFoundError(
      'Uno o más estudiantes no pertenecen a la empresa o están inactivos',
      'STUDENT_NOT_FOUND'
    );
  }

  return uniqueIds;
}
