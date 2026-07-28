import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
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

function makeIcon(type) {
  const s = MARKER_STYLES[type] || MARKER_STYLES.sign;
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:3px;background:#0A0A0A;border:2px solid ${s.color};color:${s.color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${s.glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const CLOSURE_STYLE = { color: "#EF4444", weight: 6, dashArray: "10 8", opacity: 0.85 };
const DETOUR_STYLE = { color: "#3B82F6", weight: 4, opacity: 0.8 };

export default function TrafficMap({ features }) {
  const center = features?.center || { lat: 49.2827, lng: -123.1207 };
  const markers = features?.markers || [];
  const closure = (features?.closure_path || []).filter((p) => Array.isArray(p) && p.length === 2);
  const detour = (features?.detour_path || []).filter((p) => Array.isArray(p) && p.length === 2);

  return (
    <div data-testid="traffic-map" className="border border-black/15 rounded-sm overflow-hidden">
      <MapContainer center={[center.lat, center.lng]} zoom={features?.zoom || 16} style={{ height: "520px", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {closure.length > 1 && <Polyline positions={closure} pathOptions={CLOSURE_STYLE} />}
        {detour.length > 1 && <Polyline positions={detour} pathOptions={DETOUR_STYLE} />}
        {markers.map((m, i) => (
          <Marker key={`${m.type}-${m.lat}-${m.lng}-${i}`} position={[m.lat, m.lng]} icon={makeIcon(m.type)}>
            <Popup><span className="font-mono text-xs uppercase">{m.type}</span><br />{m.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="flex flex-wrap gap-4 px-4 py-3 bg-white border-t border-black/10">
        {Object.entries(MARKER_STYLES).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            <span style={{ color: v.color }} className="font-bold">{v.glyph}</span> {k.replace("_", " ")}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600"><span className="w-5 border-t-2 border-dashed border-[#EF4444]" /> closure</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600"><span className="w-5 border-t-2 border-[#3B82F6]" /> detour</span>
      </div>
    </div>
  );
}
