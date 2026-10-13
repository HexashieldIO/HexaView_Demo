import React, { useLayoutEffect, useRef } from "react";
import { interpolate } from "remotion";
import { BrandIcon, C, MONO, Stage, prog, useSceneFrame } from "../theme";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import COUNTRIES_TOPO from "world-atlas/countries-50m.json";

// Natural Earth landmasses and borders (world-atlas), converted once.
const TOPO = COUNTRIES_TOPO as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
const LAND = feature(TOPO, TOPO.objects.land);
const BORDERS = mesh(TOPO, TOPO.objects.countries, (a, b) => a !== b);
const GRATICULE = geoGraticule10();

// A slowly turning globe of real landmasses, with live arcs between
// IT, OT and cloud sites, and a real-time feed: HexaView as the single source of truth.
type Kind = "IT" | "OT" | "CLOUD";
const KIND_COLOR: Record<Kind, string> = { IT: "#52C5EF", OT: "#EFA468", CLOUD: "#A996FF" };

const SITES: { name: string; lat: number; lon: number; kind: Kind; label?: boolean }[] = [
  { name: "London", lat: 51.5, lon: -0.1, kind: "IT", label: true },
  { name: "Rotterdam", lat: 51.9, lon: 4.5, kind: "OT" },
  { name: "New York", lat: 40.7, lon: -74, kind: "IT", label: true },
  { name: "Los Angeles", lat: 34, lon: -118.2, kind: "IT", label: true },
  { name: "Ingolstadt", lat: 48.8, lon: 11.4, kind: "OT" },
  { name: "Singapore", lat: 1.3, lon: 103.8, kind: "IT", label: true },
  { name: "Dubai", lat: 25.2, lon: 55.3, kind: "CLOUD", label: true },
  { name: "Tokyo", lat: 35.7, lon: 139.7, kind: "OT", label: true },
  { name: "São Paulo", lat: -23.5, lon: -46.6, kind: "CLOUD", label: true },
  { name: "Puebla", lat: 19, lon: -98.2, kind: "OT" },
  { name: "Sydney", lat: -33.9, lon: 151.2, kind: "IT", label: true },
  { name: "Basel", lat: 47.6, lon: 7.6, kind: "OT" },
  { name: "Mumbai", lat: 19, lon: 72.8, kind: "CLOUD", label: true },
  { name: "Johannesburg", lat: -26.2, lon: 28, kind: "IT", label: true },
  { name: "Frankfurt", lat: 50.1, lon: 8.7, kind: "CLOUD" },
  { name: "Vessel", lat: 45, lon: -35, kind: "OT", label: true },
];

const ARCS: [number, number][] = [
  [2, 0], [3, 2], [9, 2], [8, 0], [15, 1], [0, 6], [1, 5], [4, 7], [6, 12], [12, 5], [5, 10], [13, 6], [14, 7], [11, 2],
];

const FEED: { site: number; where: string; what: string }[] = [
  { site: 1, where: "Rotterdam terminal", what: "Crane PLC change verified" },
  { site: 0, where: "London trading floor", what: "Endpoint isolated" },
  { site: 14, where: "Frankfurt cloud", what: "Public bucket locked" },
  { site: 4, where: "Ingolstadt plant", what: "Unknown device quarantined" },
  { site: 2, where: "New York HQ", what: "Phishing wave contained" },
  { site: 15, where: "Vessel · North Atlantic", what: "Satcom anomaly cleared" },
  { site: 5, where: "Singapore hospital", what: "Medical device patched" },
  { site: 12, where: "Mumbai cloud", what: "Excess admin role removed" },
  { site: 7, where: "Tokyo battery plant", what: "Firmware drift corrected" },
  { site: 10, where: "Sydney hospital", what: "Account takeover blocked" },
  { site: 9, where: "Puebla plant", what: "Segment rule enforced" },
  { site: 8, where: "São Paulo data centre", what: "Backup integrity proven" },
];
const FEED_AT = (k: number) => 40 + k * 15;

const SECTORS = ["Maritime", "Financial services", "Media & entertainment", "Healthcare", "Automotive", "Defence", "Pharmaceuticals", "Insurance"];

const GX = 600;
const GY = 585;
const R = 360;
const TILT = (22 * Math.PI) / 180;
const D2R = Math.PI / 180;

const vec = (lat: number, lon: number) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];

/** Orthographic projection of a point at radius k (1 = surface) for a globe turned to lon0. */
const project = (lat: number, lon: number, lon0: number, k = 1) => {
  const la = lat * D2R;
  const lo = (lon - lon0) * D2R;
  const x = Math.cos(la) * Math.sin(lo);
  const y = Math.cos(TILT) * Math.sin(la) - Math.sin(TILT) * Math.cos(la) * Math.cos(lo);
  const z = Math.sin(TILT) * Math.sin(la) + Math.cos(TILT) * Math.cos(la) * Math.cos(lo);
  return { x: GX + R * k * x, y: GY - R * k * y, z, k };
};

/** Great-circle point between two sites, lifted off the surface in the middle. */
const arcPoint = (a: (typeof SITES)[number], b: (typeof SITES)[number], t: number, lon0: number) => {
  const va = vec(a.lat, a.lon);
  const vb = vec(b.lat, b.lon);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const om = Math.acos(dot);
  const s = Math.sin(om) || 1;
  const wa = Math.sin((1 - t) * om) / s;
  const wb = Math.sin(t * om) / s;
  const v = [wa * va[0] + wb * vb[0], wa * va[1] + wb * vb[1], wa * va[2] + wb * vb[2]];
  const lat = Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R;
  const lon = Math.atan2(v[1], v[0]) / D2R;
  const lift = 0.06 + 0.22 * (om / Math.PI);
  return project(lat, lon, lon0, 1 + lift * Math.sin(Math.PI * t));
};

const spin = (frame: number) => interpolate(frame, [0, 240], [-40, 50]);

const visible = (p: { x: number; y: number; z: number }) => p.z > 0 || Math.hypot(p.x - GX, p.y - GY) > R;

const Globe: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const lon0 = spin(frame);
    const appear = prog(frame, 0, 24);
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.save();
    ctx.globalAlpha = appear;

    // Atmosphere and body, lit from the top left.
    const halo = ctx.createRadialGradient(GX, GY, R * 0.9, GX, GY, R * 1.28);
    halo.addColorStop(0, "rgba(90,150,255,0.42)");
    halo.addColorStop(0.35, "rgba(58,208,174,0.12)");
    halo.addColorStop(1, "rgba(58,208,174,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(GX, GY, R * 1.28, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(GX - R * 0.4, GY - R * 0.45, R * 0.1, GX, GY, R * 1.05);
    body.addColorStop(0, "#16306e");
    body.addColorStop(0.55, "#0a1540");
    body.addColorStop(1, "#050a1f");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(GX, GY, R, 0, Math.PI * 2);
    ctx.fill();

    // Same orientation as project(): centred on (lon0, TILT), front hemisphere only.
    const proj = geoOrthographic()
      .scale(R)
      .translate([GX, GY])
      .rotate([-lon0, -(TILT / D2R)])
      .clipAngle(90);
    const path = geoPath(proj, ctx);

    // A faint latitude and longitude grid on the ocean.
    ctx.beginPath();
    path(GRATICULE);
    ctx.strokeStyle = "rgba(120,160,255,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Landmasses, lit from the top left like the sphere.
    const land = ctx.createLinearGradient(GX - R, GY - R, GX + R * 0.8, GY + R);
    land.addColorStop(0, "#5c9ef0");
    land.addColorStop(0.5, "#2c5fb8");
    land.addColorStop(1, "#1a3b84");
    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = land;
    ctx.shadowColor = "rgba(90,170,255,0.55)";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(170,215,255,0.85)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Country borders.
    ctx.beginPath();
    path(BORDERS);
    ctx.strokeStyle = "rgba(200,225,255,0.28)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Terminator shading: the far limb falls into shadow for depth.
    const shade = ctx.createRadialGradient(GX - R * 0.35, GY - R * 0.4, R * 0.2, GX, GY, R);
    shade.addColorStop(0, "rgba(6,12,36,0)");
    shade.addColorStop(0.7, "rgba(6,12,36,0.12)");
    shade.addColorStop(1, "rgba(6,12,36,0.6)");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(GX, GY, R, 0, Math.PI * 2);
    ctx.fill();

    // Rim light.
    ctx.strokeStyle = "rgba(140,190,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(GX, GY, R, 0, Math.PI * 2);
    ctx.stroke();

    // Arcs between sites, drawn on, then carrying a travelling light.
    ARCS.forEach(([ia, ib], i) => {
      const a = SITES[ia];
      const b = SITES[ib];
      const draw = prog(frame, 24 + i * 9, 50 + i * 9);
      if (draw <= 0) return;
      const N = 48;
      const pts = Array.from({ length: Math.ceil(N * draw) + 1 }, (_, j) => arcPoint(a, b, Math.min(draw, j / N), lon0));
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.shadowColor = KIND_COLOR[a.kind];
      ctx.shadowBlur = 10;
      for (let j = 1; j < pts.length; j++) {
        if (!visible(pts[j]) || !visible(pts[j - 1])) continue;
        ctx.strokeStyle = j / N < 0.5 ? KIND_COLOR[a.kind] : KIND_COLOR[b.kind];
        ctx.globalAlpha = appear * 0.75;
        ctx.beginPath();
        ctx.moveTo(pts[j - 1].x, pts[j - 1].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
      if (draw >= 1) {
        const t = ((frame + i * 11) % 50) / 50;
        const p = arcPoint(a, b, t, lon0);
        if (visible(p)) {
          ctx.globalAlpha = appear;
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = C.tealBright;
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = appear;

    // Sites: a glowing dot, a pulse ring, and a bigger flash when a live event lands.
    SITES.forEach((s, i) => {
      const p = project(s.lat, s.lon, lon0);
      if (p.z <= 0.05) return;
      const on = prog(frame, 8 + i * 3, 18 + i * 3);
      if (on <= 0) return;
      const col = KIND_COLOR[s.kind];
      const ring = ((frame + i * 7) % 36) / 36;
      ctx.globalAlpha = appear * on * (1 - ring) * 0.8;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + ring * 18, 0, Math.PI * 2);
      ctx.stroke();
      const ev = FEED.findIndex((f) => f.site === i);
      if (ev >= 0) {
        const flash = prog(frame, FEED_AT(ev), FEED_AT(ev) + 4) * (1 - prog(frame, FEED_AT(ev) + 4, FEED_AT(ev) + 24));
        if (flash > 0) {
          ctx.globalAlpha = appear * flash;
          ctx.fillStyle = `${col}55`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10 + flash * 26, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = appear * on;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }, [frame]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", inset: 0 }} />;
};

export const S7Industries: React.FC = () => {
  const frame = useSceneFrame();
  const swap = prog(frame, 110, 126);
  const panel = prog(frame, 24, 40);
  const clock = (k: number) => `09:41:${String(7 + k * 3).padStart(2, "0")}`;

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 54, textAlign: "center", fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em", opacity: prog(frame, 2, 14) * (1 - swap), transform: `translateY(${-swap * 30}px)` }}>
        Any industry. Anywhere. IT and OT.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 54, textAlign: "center", fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em", opacity: swap, transform: `translateY(${(1 - swap) * 30}px)` }}>
        One source of truth. <span style={{ color: C.tealBright }}>In real time.</span>
      </div>

      <Globe frame={frame} />
      {SITES.map((s, i) => {
        if (!s.label) return null;
        const p = project(s.lat, s.lon, spin(frame));
        if (p.z <= 0.35) return null;
        const on = prog(frame, 8 + i * 3, 18 + i * 3) * prog(frame, 0, 24) * Math.min(1, (p.z - 0.35) * 4);
        return (
          <div key={s.name} style={{ position: "absolute", left: p.x + 13, top: p.y - 11, fontFamily: MONO, fontWeight: 600, fontSize: 17, letterSpacing: "0.04em", color: "#e6edff", whiteSpace: "nowrap", opacity: on, textShadow: "0 0 6px rgba(5,10,24,0.95), 0 0 2px rgba(5,10,24,0.95)" }}>
            {s.name.toUpperCase()}
          </div>
        );
      })}

      {/* Live feed: every site, every tool, one console. */}
      <div style={{ position: "absolute", left: 1110, top: 230, width: 720, opacity: panel, transform: `translateX(${(1 - panel) * 40}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16, borderBottom: "1px solid rgba(140,170,255,0.3)" }}>
          <BrandIcon name="HexaView_mark" x={0} y={0} size={48} style={{ position: "relative", left: 0, top: 0 }} />
          <div style={{ fontSize: 30, fontWeight: 700, flex: 1 }}>HexaView live feed</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 20, color: C.tealBright }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.threat, opacity: frame % 20 < 10 ? 1 : 0.35 }} />
            LIVE
          </div>
        </div>
        <div style={{ position: "relative", height: 580, overflow: "hidden", marginTop: 14 }}>
          {FEED.map((f, k) => {
            if (frame < FEED_AT(k)) return null;
            const idx = FEED.reduce((n, _, j) => (j > k ? n + prog(frame, FEED_AT(j), FEED_AT(j) + 9) : n), 0);
            const enter = prog(frame, FEED_AT(k), FEED_AT(k) + 9);
            const kind = SITES[f.site].kind;
            return (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: idx * 96,
                  height: 84,
                  boxSizing: "border-box",
                  borderRadius: 16,
                  background: idx < 0.5 ? "rgba(58,208,174,0.12)" : "rgba(10,20,50,0.85)",
                  border: `1px solid ${idx < 0.5 ? "rgba(58,208,174,0.6)" : "rgba(140,170,255,0.22)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "0 18px",
                  opacity: enter * Math.max(0, Math.min(1, 6 - idx)),
                  transform: `translateY(${(1 - enter) * -24}px)`,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 14, color: KIND_COLOR[kind], border: `1px solid ${KIND_COLOR[kind]}`, borderRadius: 6, padding: "3px 8px", width: 56, textAlign: "center" }}>{kind}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 23, fontWeight: 600, whiteSpace: "nowrap" }}>{f.what}</div>
                  <div style={{ fontFamily: MONO, fontSize: 16, color: C.dim }}>{f.where.toUpperCase()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: C.tealBright }}>✓</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: C.dim }}>{clock(k)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sectors drift gently along the bottom, slow enough to read. */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, height: 60, overflow: "hidden", opacity: prog(frame, 60, 80) }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            display: "flex",
            gap: 18,
            whiteSpace: "nowrap",
            transform: `translateX(calc(-50% + ${interpolate(frame, [60, 300], [160, -160])}px))`,
          }}
        >
          {SECTORS.map((s) => (
            <div key={s} style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid rgba(140,170,255,0.4)", background: "rgba(10,20,50,0.8)", fontSize: 21, color: "#dfe7fb" }}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
};
