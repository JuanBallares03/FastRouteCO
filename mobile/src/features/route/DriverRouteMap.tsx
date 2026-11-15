import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { colors, radius, typography } from '@/theme';
import {
  boundsForStops,
  buildRouteLineGeoJSON,
  type LngLat,
  type RouteMapStop,
} from './route-map';
import type { Coordinates } from './types';

const MAP_LOAD_TIMEOUT_MS = 15000;
const DEFAULT_CENTER: LngLat = [-75.2322, 4.4389];
const MAP_PADDING = { top: 64, right: 64, bottom: 64, left: 64 };

interface DriverRouteMapProps {
  mapStyleUrl: string;
  stops: RouteMapStop[];
  driverLocation: Coordinates | null;
  geometry?: LngLat[] | null;
  onUnavailable: () => void;
}

function cameraView(stops: RouteMapStop[]) {
  const bounds = boundsForStops(stops);
  if (!bounds) {
    return { center: DEFAULT_CENTER, zoom: 12 };
  }

  const longitudeSpan = bounds[2] - bounds[0];
  const latitudeSpan = bounds[3] - bounds[1];

  if (longitudeSpan === 0 && latitudeSpan === 0) {
    return { center: [bounds[0], bounds[1]] as LngLat, zoom: 15 };
  }

  return { bounds, padding: MAP_PADDING };
}

export function DriverRouteMap({
  mapStyleUrl,
  stops,
  driverLocation,
  geometry = null,
  onUnavailable,
}: DriverRouteMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const failureReported = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);
  const routeLine = buildRouteLineGeoJSON(geometry);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  const reportFailure = useCallback(() => {
    if (failureReported.current) return;
    failureReported.current = true;
    onUnavailableRef.current();
  }, []);

  useEffect(() => {
    if (isLoaded) return;

    const timer = setTimeout(reportFailure, MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoaded, reportFailure]);

  useEffect(() => {
    if (!isLoaded || stops.length === 0) return;

    const bounds = boundsForStops(stops);
    if (!bounds) return;

    const longitudeSpan = bounds[2] - bounds[0];
    const latitudeSpan = bounds[3] - bounds[1];

    if (longitudeSpan === 0 && latitudeSpan === 0) {
      cameraRef.current?.jumpTo({ center: [bounds[0], bounds[1]], zoom: 15 });
      return;
    }

    cameraRef.current?.fitBounds(bounds, { padding: MAP_PADDING, duration: 600 });
  }, [isLoaded, stops]);

  return (
    <Map
      mapStyle={mapStyleUrl}
      style={styles.map}
      onDidFinishLoadingMap={() => setIsLoaded(true)}
      onDidFailLoadingMap={reportFailure}
    >
      <Camera ref={cameraRef} initialViewState={cameraView(stops)} />

      {routeLine ? (
        <GeoJSONSource id="driver-route-line" data={routeLine}>
          <Layer
            id="driver-route-line-layer"
            type="line"
            paint={{
              'line-color': colors.primary,
              'line-width': 5,
              'line-opacity': 0.85,
            }}
          />
        </GeoJSONSource>
      ) : null}

      {stops.map((stop) => (
        <Marker
          key={stop.id}
          lngLat={[stop.longitude, stop.latitude]}
          anchor="center"
        >
          <View
            accessibilityLabel={`Parada ${stop.sequence}: ${stop.label}`}
            style={styles.stopMarker}
          >
            <Text style={styles.stopMarkerText}>{stop.sequence}</Text>
          </View>
        </Marker>
      ))}

      {driverLocation ? (
        <Marker
          lngLat={[driverLocation.longitude, driverLocation.latitude]}
          anchor="center"
        >
          <View accessibilityLabel="Tu ubicación actual" style={styles.driverMarker}>
            <Text style={styles.driverMarkerText}>Tú</Text>
          </View>
        </Marker>
      ) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  stopMarker: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.onPrimary,
  },
  stopMarkerText: {
    color: colors.onPrimary,
    fontSize: typography.label,
    fontWeight: '800',
  },
  driverMarker: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successText,
    borderWidth: 3,
    borderColor: colors.onPrimary,
  },
  driverMarkerText: {
    color: colors.onPrimary,
    fontSize: typography.small,
    fontWeight: '800',
  },
});
