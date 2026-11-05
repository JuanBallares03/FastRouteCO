import { useEffect, useRef } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface RouteMapStop {
  id: string;
  sequence: number;
  latitude: number | null;
  longitude: number | null;
  label: string;
}

interface RouteMapProps {
  stops: RouteMapStop[];
  className?: string;
}

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER: [number, number] = [-75.2322, 4.4389];

export function RouteMap({ stops, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 12,
    });
    map.addControl(new NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const validStops = stops.filter(
      (stop) => stop.latitude !== null && stop.longitude !== null
    );
    if (validStops.length === 0) return;

    const bounds = new LngLatBounds();

    validStops.forEach((stop, index) => {
      const element = document.createElement('div');
      element.className =
        'flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-label-lg border-2 border-white shadow-md';
      element.textContent = String(index + 1);
      element.title = stop.label;

      const marker = new Marker({ element })
        .setLngLat([stop.longitude as number, stop.latitude as number])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([stop.longitude as number, stop.latitude as number]);
    });

    if (validStops.length === 1) {
      map.setCenter([validStops[0].longitude as number, validStops[0].latitude as number]);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    }
  }, [stops]);

  return <div ref={containerRef} className={className ?? 'w-full h-80 rounded-xl overflow-hidden'} />;
}
