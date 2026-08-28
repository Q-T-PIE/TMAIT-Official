import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import { useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MARKER_STYLES = {
  sign: { color: "#FF5F15", glyph: "▲" },
  detour_sign: { color: "#3B82F6", glyph: "◆" },
  cone: { color: "#F59E0B", glyph: "●" },
  flagger: { color: "#3B82F6", glyph: "■" },
  barrier: { color: "#EF4444", glyph: "▬" },
  work_zone: { color: "#EF4444", glyph: "✕" },
};

const VANCOUVER_PLACEHOLDER = { lat: 49.2827, lng: -123.1207 };
const CLOSURE_STYLE = { color: "#EF4444", weight: 6, dashArray: "10 8", opacity: 0.9 };
const DETOUR_STYLE = { color: "#3B82F6", weight: 4, opacity: 0.9 };

function makeIcon(type) {
  const s = MARKER_STYLES[type] || MARKER_STYLES.sign;
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:3px;background:#0A0A0A;border:2px solid ${s.color};color:${s.color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.55)">${s.glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function isFiniteCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlaceholderCenter(center) {
  return (
    Math.abs(center.lat - VANCOUVER_PLACEHOLDER.lat) < 0.000001 &&
    Math.abs(center.lng - VANCOUVER_PLACEHOLDER.lng) < 0.000001
  );
}

function normalizePath(path) {
  return (path || []).filter(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      isFiniteCoordinate(point[0]) &&
      isFiniteCoordinate(point[1])
  );
}

export default function TrafficMap({ features }) {
  const center = useMemo(() => {
    const raw = features?.center || {};
    if (!isFiniteCoordinate(raw.lat) || !isFiniteCoordinate(raw.lng)) return null;
    if (raw.lat === 0 && raw.lng === 0) return null;
    return { lat: raw.lat, lng: raw.lng };
  }, [features]);

  const hasUsableCenter = center && !isPlaceholderCenter(center);
  const centerPos = hasUsableCenter ? [center.lat, center.lng] : null;
  const markers = (features?.markers || []).filter(
    (marker) => isFiniteCoordinate(marker?.lat) && isFiniteCoordinate(marker?.lng)
  );
  const closure = normalizePath(features?.closure_path);
  const detour = normalizePath(features?.detour_path);

  if (!hasUsableCenter) {
    return (
      <div
        data-testid="traffic-map-location-error"
        className="border border-amber-400/60 bg-amber-50 px-5 py-6 rounded-sm"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800 mb-2">
          Site imagery unavailable
        </p>
        <p className="text-sm text-amber-950">
          The job location could not be geocoded accurately. TMAIT will not display a substitute city.
          Confirm or refine the address before generating the final plan.
        </p>
      </div>
    );
  }

  const mapKey = `${center.lat}:${center.lng}:${features?.zoom || 18}`;

  return (
    <div data-testid="traffic-map" className="border border-black/15 rounded-sm overflow-hidden">
      <MapContainer
        key={mapKey}
        center={centerPos}
        zoom={features?.zoom || 18}
        style={{ height: "520px", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
        />
        <TileLayer
          attribution="Labels &copy; Esri"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
        />

        {closure.length > 1 && <Polyline positions={closure} pathOptions={CLOSURE_STYLE} />}
        {detour.length > 1 && <Polyline positions={detour} pathOptions={DETOUR_STYLE} />}

        {markers.map((marker, index) => (
          <Marker
            key={`${marker.type}-${marker.lat}-${marker.lng}-${index}`}
            position={[marker.lat, marker.lng]}
            icon={makeIcon(marker.type)}
          >
            <Popup>
              <span className="font-mono text-xs uppercase">{marker.type}</span>
              <br />
              {marker.label}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="flex flex-wrap gap-4 px-4 py-3 bg-white border-t border-black/10">
        {Object.entries(MARKER_STYLES).map(([key, value]) => (
          <span
            key={key}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600"
          >
            <span style={{ color: value.color }} className="font-bold">
              {value.glyph}
            </span>
            {key.replace("_", " ")}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          <span className="w-5 border-t-2 border-dashed border-[#EF4444]" /> closure
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          <span className="w-5 border-t-2 border-[#3B82F6]" /> detour
        </span>
      </div>
    </div>
  );
}
