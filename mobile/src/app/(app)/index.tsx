import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { AppButton } from '@/components/AppButton';
import { EvidenceCameraModal } from '@/components/EvidenceCameraModal';
import { Notice } from '@/components/Notice';
import { RejectedActionsModal } from '@/components/RejectedActionsModal';
import { Screen } from '@/components/Screen';
import { DriverRouteMap } from '@/features/route/DriverRouteMap';
import { uploadEvidencePhoto } from '@/features/route/cloudinary';
import { deleteEvidencePhoto, persistEvidencePhoto } from '@/features/route/evidence-files';
import { isInsideGeofence } from '@/features/route/geo';
import {
  enqueueAction,
  flushOfflineQueue,
  getPendingActionCount,
  getRejectedActions,
  retryRejectedAction,
  type RejectedEntry,
} from '@/features/route/offline-queue';
import {
  groupRejectedActions,
  rejectedSyncMessage,
  type RejectedActionItem,
} from '@/features/route/rejected-actions';
import {
  mapFallbackMessage,
  resolveMapStyleUrl,
  toMapStops,
} from '@/features/route/route-map';
import type {
  Coordinates,
  RouteStatus,
  RouteStop,
  StopStatus,
} from '@/features/route/types';
import { shouldRefreshAfterSync } from '@/features/route/sync-refresh';
import { useCurrentLocation } from '@/features/route/use-current-location';
import { useDriverRoute } from '@/features/route/use-driver-route';
import {
  useRouteTracking,
  type TrackingMode,
} from '@/features/route/use-route-tracking';
import { getApiErrorCode, routesApi } from '@/features/route/api';
import { getSyncErrorMessage, isNetworkError } from '@/features/route/sync-errors';
import { colors, layout, radius, spacing, typography } from '@/theme';

const MAP_STYLE_URL = resolveMapStyleUrl(process.env.EXPO_PUBLIC_MAP_STYLE_URL);

type RouteViewMode = 'list' | 'map';

const routeStatusLabel: Record<RouteStatus, string> = {
  created: 'Creada',
  optimized: 'Optimizada',
  in_progress: 'En curso',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

const stopStatusLabel: Record<StopStatus, string> = {
  pending: 'Pendiente',
  arrived: 'En el lugar',
  completed: 'Completada',
};

function stopAddress(stop: RouteStop): string {
  return stop.order?.address ?? stop.student?.pickupAddress ?? 'Sin dirección registrada';
}

function stopPerson(stop: RouteStop): string | null {
  return stop.order?.customerName ?? stop.student?.fullName ?? null;
}

function stopTypeLabel(stop: RouteStop): string {
  if (stop.order?.type === 'delivery') return 'Entrega';
  if (stop.order?.type === 'pickup') return 'Recogida';
  if (stop.student) return 'Recogida';
  return 'Parada';
}

function formatRouteDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function trackingMessage(mode: TrackingMode): string {
  switch (mode) {
    case 'background':
      return 'Registrando tu recorrido en segundo plano.';
    case 'foreground':
      return 'El recorrido se registra solo con la app abierta. Activa la ubicación en segundo plano para registrar todo el trayecto.';
    case 'denied':
      return 'Permiso de ubicación inactivo. Actívalo para registrar el recorrido.';
    default:
      return 'Preparando el registro de ubicación...';
  }
}

export default function MyRouteScreen() {
  const {
    route,
    updateRoute,
    isLoading,
    isOffline,
    error,
    setError,
    notice,
    setNotice,
    loadToday,
    refresh,
  } = useDriverRoute();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [cameraStopId, setCameraStopId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<RouteViewMode>('list');
  const [failedRouteId, setFailedRouteId] = useState<string | null>(null);
  const { mode: trackingMode } = useRouteTracking(route, isLoading);
  const mapStops = useMemo(() => toMapStops(route?.stops ?? []), [route?.stops]);
  const mapUnavailable = failedRouteId !== null && failedRouteId === route?.id;
  const mapFallback =
    viewMode === 'map'
      ? mapFallbackMessage({
          isOffline,
          hasMapStyle: MAP_STYLE_URL !== null,
          mapFailed: mapUnavailable,
          stopCount: mapStops.length,
        })
      : null;
  const shouldTrackForMap = viewMode === 'map' && Boolean(route) && !mapFallback;
  const { location: driverLocation, permissionDenied: locationDenied } =
    useCurrentLocation(shouldTrackForMap);

  const [rejectedEntries, setRejectedEntries] = useState<RejectedEntry[]>([]);
  const [showRejected, setShowRejected] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  // Read inside runSync without making it change on every route update.
  const stopsRef = useRef(route?.stops ?? []);
  useEffect(() => {
    stopsRef.current = route?.stops ?? [];
  }, [route?.stops]);
  const rejectedItems = useMemo(
    () => groupRejectedActions(rejectedEntries, route?.stops ?? []),
    [rejectedEntries, route?.stops]
  );

  const loadRejected = useCallback(async () => {
    setRejectedEntries(await getRejectedActions());
  }, []);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await getPendingActionCount());
  }, []);

  const runSync = useCallback(
    async (shouldRefreshRoute: boolean) => {
      const result = await flushOfflineQueue();
      setPendingCount(result.pending);
      await loadRejected();

      // Reload first: a successful reload clears the error, and the sync
      // outcome below must stay visible to the driver.
      if (shouldRefreshAfterSync(result, shouldRefreshRoute)) {
        await refresh('manual');
      }

      if (result.rejected > 0) {
        setError(
          rejectedSyncMessage(
            result.rejected,
            result.lastRejected,
            result.lastError,
            stopsRef.current
          )
        );
      } else if (result.synced > 0) {
        setNotice('Acciones pendientes sincronizadas.');
      }
    },
    [loadRejected, refresh, setError, setNotice]
  );

  const handleRetryRejected = useCallback(
    async (item: RejectedActionItem) => {
      setRetryingKey(item.key);
      try {
        for (const id of item.ids) {
          await retryRejectedAction(id);
        }
        await runSync(true);
      } finally {
        setRetryingKey(null);
      }
    },
    [runSync]
  );

  useEffect(() => {
    void (async () => {
      await runSync(false);
    })();
  }, [runSync]);

  useEffect(() => {
    if (pendingCount === 0) return;

    const interval = setInterval(() => {
      void runSync(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [pendingCount, runSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runSync(false);
      }
    });

    return () => subscription.remove();
  }, [runSync]);

  function updateLocalStop(stopId: string, patch: Partial<RouteStop>) {
    updateRoute((current) =>
      current
        ? {
            ...current,
            stops: current.stops.map((stop) =>
              stop.id === stopId ? { ...stop, ...patch } : stop
            ),
          }
        : current
    );
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refresh('manual');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function getPosition(): Promise<Coordinates | null> {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }

    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 30000,
        requiredAccuracy: 50,
      });
      if (lastKnown) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
    } catch {
      return null;
    }
  }

  async function handleStart() {
    if (!route) return;
    setBusyAction('start');
    setError(null);
    setNotice(null);

    try {
      const coordinates = await getPosition();
      try {
        const updated = await routesApi.startRoute(route.id, coordinates ?? undefined);
        updateRoute(updated);
        setNotice('Ruta iniciada. El registro de ubicación está activo.');
      } catch (startError) {
        if (!isNetworkError(startError)) throw startError;

        await enqueueAction({
          type: 'start',
          routeId: route.id,
          coordinates: coordinates ?? undefined,
        });
        updateRoute((current) =>
          current
            ? {
                ...current,
                status: 'in_progress',
                startedAt: new Date().toISOString(),
                startLatitude: coordinates?.latitude ?? current.startLatitude,
                startLongitude: coordinates?.longitude ?? current.startLongitude,
              }
            : current
        );
        setNotice('Inicio guardado sin conexión. Se sincronizará automáticamente.');
        await refreshPendingCount();
      }
    } catch (startError) {
      setError(getSyncErrorMessage(startError));
    } finally {
      setBusyAction(null);
    }
  }

  async function submitArrival(
    stop: RouteStop,
    method: 'geofence' | 'manual',
    coordinates?: Coordinates | null
  ) {
    if (!route) return;
    setBusyAction(`arrive-${stop.id}`);
    setError(null);
    setNotice(null);

    const body =
      method === 'geofence' && coordinates
        ? {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            method,
          }
        : { method: 'manual' as const };

    try {
      const updated = await routesApi.arriveAtStop(route.id, stop.id, body);
      updateRoute(updated);
      setNotice('Llegada registrada.');
    } catch (arrivalError) {
      if (isNetworkError(arrivalError)) {
        await enqueueAction({
          type: 'arrival',
          routeId: route.id,
          stopId: stop.id,
          body,
        });
        updateLocalStop(stop.id, {
          status: 'arrived',
          arrivedAt: new Date().toISOString(),
          isGeofenceVerified: method === 'geofence',
        });
        setNotice('Llegada guardada sin conexión. Se sincronizará automáticamente.');
        await refreshPendingCount();
      } else if (getApiErrorCode(arrivalError) === 'OUTSIDE_GEOFENCE') {
        askManualArrival(stop, 'No pudimos verificar que estés dentro del radio de la parada.');
      } else {
        setError(getSyncErrorMessage(arrivalError));
      }
    } finally {
      setBusyAction(null);
    }
  }

  function askManualArrival(stop: RouteStop, message: string) {
    Alert.alert('Confirmar llegada manual', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Marcar llegada',
        onPress: () => void submitArrival(stop, 'manual'),
      },
    ]);
  }

  async function handleArrival(stop: RouteStop) {
    setError(null);
    setNotice(null);
    const coordinates = await getPosition();

    if (coordinates && isInsideGeofence(stop, coordinates)) {
      await submitArrival(stop, 'geofence', coordinates);
      return;
    }

    askManualArrival(
      stop,
      coordinates
        ? 'Parece que estás lejos de la dirección de la parada.'
        : 'No pudimos obtener tu ubicación actual.'
    );
  }

  async function handleCapture(uri: string) {
    const stopId = cameraStopId;
    setCameraStopId(null);
    if (!route || !stopId) return;

    setBusyAction(`complete-${stopId}`);
    setError(null);
    setNotice(null);
    let localUri = uri;

    try {
      localUri = await persistEvidencePhoto(uri);
      const capturedAt = new Date().toISOString();
      const signature = await routesApi.getEvidenceSignature(route.id, stopId);
      const photoUrl = await uploadEvidencePhoto(signature, localUri);

      const updated = await routesApi.completeStop(route.id, stopId, {
        evidence: [{ photoUrl, capturedAt }],
      });
      updateRoute(updated);
      deleteEvidencePhoto(localUri);
      setNotice('Parada completada con foto de evidencia.');
    } catch (completeError) {
      if (isNetworkError(completeError)) {
        const capturedAt = new Date().toISOString();
        await enqueueAction({
          type: 'completion',
          routeId: route.id,
          stopId,
          photos: [{ uri: localUri, capturedAt }],
        });
        updateLocalStop(stopId, {
          status: 'completed',
          confirmedAt: capturedAt,
          evidencePhotos: [
            ...(route.stops.find((stop) => stop.id === stopId)?.evidencePhotos ?? []),
            { id: `local-${capturedAt}`, photoUrl: localUri, capturedAt },
          ],
        });
        setNotice('Entrega guardada sin conexión. La foto se subirá al sincronizar.');
        await refreshPendingCount();
      } else {
        deleteEvidencePhoto(localUri);
        setError(getSyncErrorMessage(completeError));
        if (getApiErrorCode(completeError) === 'STOP_ALREADY_COMPLETED') {
          void refresh('manual');
        }
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFinish() {
    if (!route) return;
    setBusyAction('finish');
    setError(null);
    setNotice(null);

    try {
      const updated = await routesApi.finishRoute(route.id);
      updateRoute(updated);
      setNotice('Ruta finalizada.');
    } catch (finishError) {
      if (isNetworkError(finishError)) {
        await enqueueAction({ type: 'finish', routeId: route.id });
        updateRoute((current) =>
          current ? { ...current, status: 'completed', endedAt: new Date().toISOString() } : current
        );
        setNotice('Fin de ruta guardado sin conexión. Se sincronizará automáticamente.');
        await refreshPendingCount();
      } else {
        setError(getSyncErrorMessage(finishError));
      }
    } finally {
      setBusyAction(null);
    }
  }

  function renderStops() {
    if (!route) return null;

    return (
      <View style={styles.stopsSection}>
        <Text style={styles.sectionTitle}>Paradas</Text>
        {route.stops.map((stop) => {
          const person = stopPerson(stop);
          const isCompleted = stop.status === 'completed';

          return (
            <View
              key={stop.id}
              style={[styles.stopCard, isCompleted ? styles.stopCardCompleted : null]}
            >
              <View style={styles.stopHeader}>
                <View
                  style={[
                    styles.sequence,
                    isCompleted ? styles.sequenceCompleted : null,
                  ]}
                >
                  <Text style={styles.sequenceText}>{stop.sequence}</Text>
                </View>
                <View style={styles.stopHeading}>
                  <Text style={styles.stopType}>{stopTypeLabel(stop)}</Text>
                  <Text style={styles.stopAddress}>{stopAddress(stop)}</Text>
                  {person ? <Text style={styles.stopPerson}>{person}</Text> : null}
                </View>
                <View
                  style={[
                    styles.stopStatus,
                    stop.status === 'arrived' ? styles.stopStatusArrived : null,
                    isCompleted ? styles.stopStatusCompleted : null,
                  ]}
                >
                  <Text style={styles.stopStatusText}>{stopStatusLabel[stop.status]}</Text>
                </View>
              </View>

              {stop.notes ? <Text style={styles.stopNotes}>{stop.notes}</Text> : null}

              {isCompleted ? (
                <Text style={styles.evidenceText}>
                  Evidencia: {stop.evidencePhotos.length}{' '}
                  {stop.evidencePhotos.length === 1 ? 'foto' : 'fotos'}
                  {formatTime(stop.confirmedAt)
                    ? ` · ${formatTime(stop.confirmedAt)}`
                    : ''}
                </Text>
              ) : null}

              {isInProgress && !isCompleted ? (
                <View style={styles.stopActions}>
                  {stop.status === 'pending' ? (
                    <AppButton
                      title="Marcar llegada"
                      loading={busyAction === `arrive-${stop.id}`}
                      onPress={() => void handleArrival(stop)}
                    />
                  ) : (
                    <AppButton
                      title="Completar con foto"
                      loading={busyAction === `complete-${stop.id}`}
                      onPress={() => setCameraStopId(stop.id)}
                    />
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  const pendingStops = route?.stops.filter((stop) => stop.status !== 'completed').length ?? 0;
  const isInProgress = route?.status === 'in_progress';
  const canFinish = isInProgress && pendingStops === 0;

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshing={isRefreshing}
      onRefresh={() => void handleRefresh()}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Mi ruta
      </Text>
      <Text style={styles.subtitle}>Consulta y ejecuta la ruta que tienes asignada para hoy.</Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Cargando tu ruta...</Text>
        </View>
      ) : null}

      {error ? <Notice message={error} /> : null}
      {notice ? <Notice message={notice} variant="success" /> : null}

      {rejectedItems.length > 0 ? (
        <View style={styles.rejectedBlock}>
          <Notice
            message={
              rejectedItems.length === 1
                ? '1 acción no se pudo enviar.'
                : `${rejectedItems.length} acciones no se pudieron enviar.`
            }
          />
          <AppButton title="Ver detalle" onPress={() => setShowRejected(true)} />
        </View>
      ) : null}

      {!isLoading && !route ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No tienes ruta asignada hoy</Text>
          <Text style={styles.emptyText}>
            Cuando tu empresa te asigne una ruta, la verás en esta pantalla.
          </Text>
          <AppButton title="Volver a consultar" onPress={() => void loadToday()} />
        </View>
      ) : null}

      {route ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryHeading}>
                <Text style={styles.summaryDate}>{formatRouteDate(route.routeDate)}</Text>
                <Text style={styles.summaryMeta}>
                  {route.stops.length} {route.stops.length === 1 ? 'parada' : 'paradas'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  isInProgress ? styles.statusChipActive : null,
                  route.status === 'completed' ? styles.statusChipComplete : null,
                ]}
              >
                <Text style={styles.statusChipText}>{routeStatusLabel[route.status]}</Text>
              </View>
            </View>

            {isInProgress ? (
              <View style={styles.trackingBanner}>
                <Text style={styles.trackingText}>{trackingMessage(trackingMode)}</Text>
              </View>
            ) : null}

            {pendingCount > 0 ? (
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingText}>
                  {pendingCount} {pendingCount === 1 ? 'acción pendiente' : 'acciones pendientes'} de
                  sincronizar.
                </Text>
                <AppButton title="Sincronizar ahora" onPress={() => void runSync(true)} />
              </View>
            ) : null}

            {route.status === 'created' || route.status === 'optimized' ? (
              <AppButton
                title="Iniciar ruta"
                loading={busyAction === 'start'}
                onPress={() => void handleStart()}
              />
            ) : null}

            {isInProgress ? (
              <View style={styles.finishBlock}>
                <AppButton
                  title="Finalizar ruta"
                  loading={busyAction === 'finish'}
                  disabled={!canFinish}
                  onPress={() => void handleFinish()}
                />
                {!canFinish ? (
                  <Text style={styles.finishHint}>
                    Completa las {pendingStops} paradas pendientes para finalizar.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {route.status === 'completed' ? (
              <Text style={styles.finishedText}>
                Ruta finalizada
                {formatTime(route.endedAt) ? ` a las ${formatTime(route.endedAt)}` : ''}.
              </Text>
            ) : null}
          </View>

          <View style={styles.viewSwitcher}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'list' }}
              onPress={() => setViewMode('list')}
              style={({ pressed }) => [
                styles.viewOption,
                viewMode === 'list' ? styles.viewOptionActive : null,
                pressed ? styles.viewOptionPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.viewOptionText,
                  viewMode === 'list' ? styles.viewOptionTextActive : null,
                ]}
              >
                Lista
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'map' }}
              onPress={() => setViewMode('map')}
              style={({ pressed }) => [
                styles.viewOption,
                viewMode === 'map' ? styles.viewOptionActive : null,
                pressed ? styles.viewOptionPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.viewOptionText,
                  viewMode === 'map' ? styles.viewOptionTextActive : null,
                ]}
              >
                Mapa
              </Text>
            </Pressable>
          </View>

          {viewMode === 'list' ? renderStops() : null}

          {viewMode === 'map' && mapFallback ? (
            <>
              <Notice message={mapFallback} variant="warning" />
              {renderStops()}
            </>
          ) : null}

          {viewMode === 'map' && !mapFallback && MAP_STYLE_URL ? (
            <>
              <View style={styles.mapCard}>
                <DriverRouteMap
                  mapStyleUrl={MAP_STYLE_URL}
                  stops={mapStops}
                  driverLocation={driverLocation}
                  onUnavailable={() => setFailedRouteId(route.id)}
                />
              </View>
              {locationDenied ? (
                <Text style={styles.mapHint}>
                  Activa el permiso de ubicación para ver tu posición actual en el mapa.
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <RejectedActionsModal
        visible={showRejected}
        items={rejectedItems}
        retryingKey={retryingKey}
        onRetry={(item) => void handleRetryRejected(item)}
        onClose={() => setShowRejected(false)}
      />

      <EvidenceCameraModal
        visible={cameraStopId !== null}
        onClose={() => setCameraStopId(null)}
        onCapture={(uri) => void handleCapture(uri)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  emptyCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
  },
  summaryCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryDate: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: typography.label,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  statusChipActive: {
    backgroundColor: colors.successSurface,
  },
  statusChipComplete: {
    backgroundColor: '#DBEAFE',
  },
  statusChipText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  trackingBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  trackingText: {
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: 21,
  },
  rejectedBlock: {
    gap: spacing.sm,
  },
  pendingBanner: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#FEF9C3',
  },
  pendingText: {
    color: '#713F12',
    fontSize: typography.label,
    lineHeight: 21,
    fontWeight: '600',
  },
  finishBlock: {
    gap: spacing.sm,
  },
  finishHint: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
  },
  finishedText: {
    color: colors.successText,
    fontSize: typography.body,
    fontWeight: '700',
  },
  viewSwitcher: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  viewOption: {
    flex: 1,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  viewOptionActive: {
    backgroundColor: colors.primary,
  },
  viewOptionPressed: {
    opacity: 0.85,
  },
  viewOptionText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  viewOptionTextActive: {
    color: colors.onPrimary,
  },
  mapCard: {
    height: 430,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  mapHint: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 20,
  },
  stopsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  stopCard: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  stopCardCompleted: {
    borderColor: colors.successText,
    backgroundColor: '#F0FDF4',
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sequence: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sequenceCompleted: {
    backgroundColor: colors.successText,
  },
  sequenceText: {
    color: colors.onPrimary,
    fontSize: typography.label,
    fontWeight: '800',
  },
  stopHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  stopType: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stopAddress: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
    fontWeight: '600',
  },
  stopPerson: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
  stopStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  stopStatusArrived: {
    backgroundColor: '#FEF3C7',
  },
  stopStatusCompleted: {
    backgroundColor: colors.successSurface,
  },
  stopStatusText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  stopNotes: {
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: 21,
  },
  evidenceText: {
    color: colors.successText,
    fontSize: typography.small,
    fontWeight: '700',
  },
  stopActions: {
    gap: spacing.sm,
  },
});
