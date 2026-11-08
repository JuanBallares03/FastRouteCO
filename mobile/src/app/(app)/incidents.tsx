import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { getApiErrorMessage, routesApi } from '@/services/routes-api';
import {
  incidentsApi,
  type DriverIncident,
  type IncidentCategory,
  type IncidentStatus,
} from '@/services/incidents-api';
import { getRealtimeSocket } from '@/services/realtime';
import type { DriverRoute } from '@/features/route/types';
import { colors, radius, spacing, typography } from '@/theme';

const categoryLabel: Record<IncidentCategory, string> = {
  incident: 'Incidencia',
  question: 'Pregunta',
};

const statusLabel: Record<IncidentStatus, string> = {
  open: 'Abierta',
  in_progress: 'En curso',
  resolved: 'Resuelta',
};

function formatTime(value: string): string {
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IncidentsScreen() {
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [incidents, setIncidents] = useState<DriverIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<IncidentCategory>('incident');
  const [stopId, setStopId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) {
      setIsLoading(true);
    }

    try {
      const [today, list] = await Promise.all([
        routesApi.getTodayRoute().catch(() => null),
        incidentsApi.list(),
      ]);
      setRoute(today);
      setIncidents(list);
      setSelectedId((current) =>
        current && list.some((incident) => incident.id === current)
          ? current
          : list[0]?.id ?? null
      );
      setError(null);
    } catch (refreshError) {
      if (!quiet) {
        setError(getApiErrorMessage(refreshError));
      }
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    const handleChange = () => {
      void refresh(true);
    };

    socket.on('incident:created', handleChange);
    socket.on('incident:updated', handleChange);
    socket.on('incident:message', handleChange);

    return () => {
      socket.off('incident:created', handleChange);
      socket.off('incident:updated', handleChange);
      socket.off('incident:message', handleChange);
    };
  }, [refresh]);

  async function handleCreate() {
    if (!route) return;
    if (description.trim().length < 5) {
      setError('Describe la novedad con al menos 5 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const created = await incidentsApi.create({
        routeId: route.id,
        stopId: stopId ?? undefined,
        category,
        description: description.trim(),
      });
      setIncidents((current) => [created, ...current]);
      setSelectedId(created.id);
      setDescription('');
      setStopId(null);
      setCategory('incident');
      setNotice('Novedad reportada. La empresa ya puede verla.');
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSend() {
    if (!selectedId || reply.trim().length === 0) return;

    setIsSending(true);
    setError(null);

    try {
      const result = await incidentsApi.addMessage(selectedId, reply.trim());
      setIncidents((current) =>
        current.map((incident) =>
          incident.id === result.incident.id ? result.incident : incident
        )
      );
      setReply('');
    } catch (sendError) {
      setError(getApiErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  }

  const canReport = route?.status === 'in_progress';
  const reportableStops = route?.stops.filter((stop) => stop.status !== 'completed') ?? [];

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Incidencias
      </Text>
      <Text style={styles.subtitle}>
        Reporta novedades y conversa con la empresa durante tu jornada.
      </Text>

      {error ? <Notice message={error} /> : null}
      {notice ? <Notice message={notice} variant="success" /> : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Cargando incidencias...</Text>
        </View>
      ) : null}

      {!isLoading ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reportar novedad</Text>
          {canReport ? (
            <>
              <View style={styles.chipRow}>
                {(['incident', 'question'] as IncidentCategory[]).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === value }}
                    onPress={() => setCategory(value)}
                    style={[styles.chip, category === value ? styles.chipActive : null]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        category === value ? styles.chipLabelActive : null,
                      ]}
                    >
                      {categoryLabel[value]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Parada asociada (opcional)</Text>
              <View style={styles.chipRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: stopId === null }}
                  onPress={() => setStopId(null)}
                  style={[styles.chip, stopId === null ? styles.chipActive : null]}
                >
                  <Text
                    style={[styles.chipLabel, stopId === null ? styles.chipLabelActive : null]}
                  >
                    Sin parada
                  </Text>
                </Pressable>
                {reportableStops.map((stop) => (
                  <Pressable
                    key={stop.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: stopId === stop.id }}
                    onPress={() => setStopId(stop.id)}
                    style={[styles.chip, stopId === stop.id ? styles.chipActive : null]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        stopId === stop.id ? styles.chipLabelActive : null,
                      ]}
                    >
                      Parada {stop.sequence}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <AppTextInput
                label="Descripción"
                value={description}
                onChangeText={setDescription}
                placeholder="Cuéntanos qué está pasando..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <AppButton
                title="Enviar reporte"
                loading={isSubmitting}
                disabled={description.trim().length < 5}
                onPress={() => void handleCreate()}
              />
            </>
          ) : (
            <Text style={styles.emptyText}>
              Podrás reportar novedades cuando tengas una ruta en curso.
            </Text>
          )}
        </View>
      ) : null}

      {!isLoading ? (
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Mis reportes</Text>
          {incidents.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>
                Aún no tienes incidencias registradas.
              </Text>
            </View>
          ) : (
            incidents.map((incident) => {
              const isSelected = incident.id === selectedId;
              return (
                <View key={incident.id} style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedId(incident.id)}
                    style={styles.incidentHeader}
                  >
                    <View style={styles.incidentHeading}>
                      <View style={styles.chipRow}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>
                            {categoryLabel[incident.category]}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            incident.status === 'resolved' ? styles.statusResolved : null,
                            incident.status === 'in_progress' ? styles.statusActive : null,
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>
                            {statusLabel[incident.status]}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.incidentDescription}>{incident.description}</Text>
                      <Text style={styles.incidentMeta}>
                        {incident.stop
                          ? `Parada ${incident.stop.sequence} · `
                          : ''}
                        {formatTime(incident.reportedAt)} · {incident.messages.length}{' '}
                        {incident.messages.length === 1 ? 'mensaje' : 'mensajes'}
                      </Text>
                    </View>
                  </Pressable>

                  {isSelected ? (
                    <View style={styles.chat}>
                      {incident.messages.length === 0 ? (
                        <Text style={styles.chatEmpty}>Aún no hay respuestas.</Text>
                      ) : (
                        incident.messages.map((message) => (
                          <View key={message.id} style={styles.message}>
                            <Text style={styles.messageAuthor}>
                              {message.sender?.fullName ?? 'Empresa'} ·{' '}
                              {formatTime(message.sentAt)}
                            </Text>
                            <Text style={styles.messageText}>{message.message}</Text>
                          </View>
                        ))
                      )}

                      {incident.status !== 'resolved' ? (
                        <>
                          <AppTextInput
                            label="Responder"
                            value={reply}
                            onChangeText={setReply}
                            placeholder="Escribe un mensaje..."
                          />
                          <AppButton
                            title="Enviar mensaje"
                            loading={isSending}
                            disabled={reply.trim().length === 0}
                            onPress={() => void handleSend()}
                          />
                        </>
                      ) : (
                        <Text style={styles.chatEmpty}>
                          Esta novedad ya fue resuelta
                          {incident.resolutionNotes ? `: ${incident.resolutionNotes}` : '.'}
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : null}

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
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.label,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: colors.onPrimary,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
  },
  listSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  incidentHeader: {
    gap: spacing.sm,
  },
  incidentHeading: {
    gap: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  categoryBadgeText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  statusActive: {
    backgroundColor: '#FEF3C7',
  },
  statusResolved: {
    backgroundColor: colors.successSurface,
  },
  statusBadgeText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  incidentDescription: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
    fontWeight: '600',
  },
  incidentMeta: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  chat: {
    gap: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  chatEmpty: {
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: 21,
  },
  message: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  messageAuthor: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  messageText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
