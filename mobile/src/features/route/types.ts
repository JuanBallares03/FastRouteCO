export type RouteStatus = 'created' | 'optimized' | 'in_progress' | 'completed' | 'cancelled';

export type StopStatus = 'pending' | 'arrived' | 'completed';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteOrder {
  id: string;
  type: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  priority: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  description: string | null;
}

export interface RouteStudent {
  id: string;
  fullName: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
}

export interface EvidencePhoto {
  id: string;
  photoUrl: string;
  capturedAt: string | null;
}

export interface RouteStop {
  id: string;
  routeId: string;
  sequence: number;
  status: StopStatus;
  arrivedAt: string | null;
  isGeofenceVerified: boolean;
  confirmedAt: string | null;
  syncedAt: string | null;
  notes: string | null;
  recipientName: string | null;
  order: RouteOrder | null;
  student: RouteStudent | null;
  evidencePhotos: EvidencePhoto[];
}

export interface DriverRoute {
  id: string;
  companyId: string;
  driverId: string;
  routeDate: string;
  status: RouteStatus;
  startLatitude: number | null;
  startLongitude: number | null;
  startedAt: string | null;
  endedAt: string | null;
  stops: RouteStop[];
}

export interface EvidenceUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

export interface LocationSample {
  latitude: number;
  longitude: number;
  capturedAt: string;
  isOffline: boolean;
}
