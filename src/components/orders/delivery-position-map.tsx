"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Re-centers the map whenever a new position arrives, without fighting a
 * viewer who's manually panned/zoomed in between updates — panTo() moves
 * the view, it doesn't reset zoom or interrupt an in-progress gesture.
 */
function RecenterOnMove({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([latitude, longitude]);
  }, [latitude, longitude, map]);
  return null;
}

/**
 * Phase F, checkpoint F-3. Pure Leaflet/OpenStreetMap rendering — no data
 * fetching, no Realtime, no state beyond what react-leaflet itself needs.
 * Deliberately loaded only via next/dynamic with ssr:false from
 * delivery-live-map.tsx, since Leaflet touches `window` at module load and
 * breaks Next.js's server render pass otherwise.
 *
 * Uses CircleMarker (a plain SVG circle Leaflet draws itself) for the
 * partner's position instead of the default pin Marker — deliberately
 * avoids Leaflet's well-known default-icon asset-resolution problem under
 * Next.js's bundler entirely, rather than working around it with an
 * explicit L.icon() pointing at repackaged image URLs. No image asset of
 * any kind is loaded for the marker.
 *
 * The accuracy Circle (radius in meters, matching accuracy_meters exactly
 * as reported by the browser's Geolocation API — never a fabricated
 * value) is only drawn when a real, positive accuracy value exists.
 */
export default function DeliveryPositionMap({
  latitude,
  longitude,
  accuracyMeters,
}: {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "220px", width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {accuracyMeters !== null && accuracyMeters > 0 && (
        <Circle
          center={[latitude, longitude]}
          radius={accuracyMeters}
          pathOptions={{ color: "#166534", weight: 1, fillOpacity: 0.08 }}
        />
      )}
      <CircleMarker
        center={[latitude, longitude]}
        radius={8}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#166534", fillOpacity: 1 }}
      />
      <RecenterOnMove latitude={latitude} longitude={longitude} />
    </MapContainer>
  );
}
