import React from "react";
import { Img, staticFile } from "remotion";
import { C, MONO, Stage, prog, usePartner, useSceneFrame } from "../theme";
import { Callout, ConsoleShot, Headline, Spotlight, Sub } from "../hc/common";

// Cyber Dockside cut: ports and fleet, told through the platform's maritime tenant, Halcyon Ports & Shipping.
const SHOT = { imgW: 2000, imgH: 1125 };

/** "Cyber Dockside · Exclusive maritime partner" in the corner of each maritime scene. */
const DocksideBadge: React.FC<{ frame: number }> = ({ frame }) => {
  const partner = usePartner();
  if (!partner) return null;
  return (
    <div style={{ position: "absolute", right: 40, bottom: 30, display: "flex", alignItems: "center", gap: 16, opacity: prog(frame, 10, 26) }}>
      <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.16em", color: C.dim, textAlign: "right", lineHeight: 1.4 }}>
        EXCLUSIVE MARITIME
        <br />
        <span style={{ color: C.tealBright }}>HEXAVIEW PARTNER</span>
      </div>
      <Img src={staticFile(partner.logo)} style={{ height: 46, width: 46 * partner.ratio }} />
    </div>
  );
};

const Chips: React.FC<{ frame: number; at: number; top: number; items: string[]; color?: string }> = ({ frame, at, top, items, color = C.tealBright }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", gap: 16 }}>
    {items.map((t, i) => {
      const p = prog(frame, at + i * 8, at + 14 + i * 8);
      return (
        <div key={t} style={{ padding: "10px 22px", borderRadius: 999, background: "rgba(10,20,50,0.9)", border: `2px solid ${color}`, fontSize: 24, fontWeight: 600, color: "#e5f6f1", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
          {t}
        </div>
      );
    })}
  </div>
);

/** Terminals, cranes and vessels: OT seen passively. */
export const MaritimeOT: React.FC = () => {
  const frame = useSceneFrame();
  return (
    <Stage>
      <Headline frame={frame} top={46} size={76}>
        Every terminal. Every vessel. One view.
      </Headline>
      <ConsoleShot
        src="screens/maritime/mar-ot.png"
        {...SHOT}
        width={1240}
        left={80}
        top={170}
        url="HexaView · HexaOT · Halcyon Ports & Shipping"
        keys={[
          { f: 0, z: 1, x: 1000, y: 562 },
          { f: 40, z: 1, x: 1000, y: 562 },
          { f: 110, z: 1.55, x: 1000, y: 960 },
        ]}
        overlay={(px) => (
          <>
            <Spotlight px={px} x={622} y={366} w={262} h={98} show={prog(frame, 40, 54)} color="#EFA468" />
            <Spotlight px={px} x={366} y={958} w={790} h={30} show={prog(frame, 120, 134)} color={C.threat} />
            <Spotlight px={px} x={1060} y={1066} w={132} h={36} show={prog(frame, 140, 154)} color="#EFA468" />
          </>
        )}
      />
      <div style={{ position: "absolute", left: 1360, top: 190, width: 500, display: "flex", flexDirection: "column", gap: 20 }}>
        <Callout inline x={0} y={0} w={500} show={prog(frame, 30, 46)} title="4 terminals · 22 vessels" body="Rotterdam, Antwerp, Port Klang and Santos, plus a fleet reporting in over VSAT and LEO." accent="#0ea5b7" />
        <Callout inline x={0} y={0} w={500} show={prog(frame, 56, 72)} title="1,912 OT assets, passively" body="Read-only by policy. Nothing in HexaView can reach the control network." accent="#EFA468" />
        <Callout inline x={0} y={0} w={500} show={prog(frame, 128, 144)} title="Cranes, gates, bridges" body="Crane HMIs, gate OCR lanes, reefer gateways and ECDIS, below the line where a change moves steel." accent={C.tealBright} />
      </div>
      <DocksideBadge frame={frame} />
    </Stage>
  );
};

/** Maritime compliance, framework by framework. */
export const MaritimeComply: React.FC = () => {
  const frame = useSceneFrame();
  return (
    <Stage>
      <Headline frame={frame} top={46} size={76}>
        Maritime compliance, proven live.
      </Headline>
      <ConsoleShot
        src="screens/maritime/mar-comply.png"
        {...SHOT}
        width={1360}
        top={170}
        url="HexaView · HexaComply · Halcyon Ports & Shipping"
        keys={[
          { f: 0, z: 1, x: 1000, y: 562 },
          { f: 30, z: 1, x: 1000, y: 562 },
          { f: 90, z: 1.3, x: 1160, y: 760 },
          { f: 170, z: 1.3, x: 1160, y: 900 },
        ]}
        overlay={(px) => (
          <>
            <Spotlight px={px} x={352} y={598} w={522} h={242} show={prog(frame, 70, 84)} />
            <Spotlight px={px} x={898} y={598} w={524} h={242} show={prog(frame, 88, 102)} />
            <Spotlight px={px} x={1446} y={598} w={522} h={242} show={prog(frame, 106, 120)} />
            <Spotlight px={px} x={898} y={865} w={524} h={244} show={prog(frame, 140, 154)} />
            <Spotlight px={px} x={1446} y={865} w={522} h={244} show={prog(frame, 158, 172)} />
          </>
        )}
      />
      <Chips frame={frame} at={70} top={980} items={["IMO MSC.428(98)", "IACS UR E26 / E27", "NIS2", "ISPS Code", "IEC 62443"]} />
      <DocksideBadge frame={frame} />
    </Stage>
  );
};

/** Managed SOC, then AI-driven penetration testing. */
export const MaritimeSoc: React.FC = () => {
  const frame = useSceneFrame();
  const SWITCH = 130;
  const second = prog(frame, SWITCH, SWITCH + 14);
  return (
    <Stage>
      <div style={{ opacity: 1 - second }}>
        <Headline frame={frame} top={46} size={76}>
          A 24/7 managed SOC, on watch.
        </Headline>
      </div>
      <div style={{ opacity: second }}>
        <Headline frame={frame} at={SWITCH} top={46} size={76}>
          AI pen testing, terminal by terminal.
        </Headline>
      </div>
      {second < 1 && (
        <div style={{ opacity: 1 - second }}>
          <ConsoleShot
            src="screens/maritime/mar-soc.png"
            {...SHOT}
            width={1360}
            top={170}
            url="HexaView · HexaSOC · Halcyon Ports & Shipping"
            keys={[
              { f: 0, z: 1, x: 1000, y: 562 },
              { f: 30, z: 1, x: 1000, y: 562 },
              { f: 90, z: 1.45, x: 1150, y: 520 },
            ]}
            overlay={(px) => (
              <>
                <Spotlight px={px} x={622} y={366} w={806} h={118} show={prog(frame, 60, 74)} color="#A580F8" />
                <Spotlight px={px} x={1432} y={366} w={266} h={118} show={prog(frame, 84, 98)} color={C.tealBright} />
              </>
            )}
          />
        </div>
      )}
      {second > 0 && (
        <div style={{ opacity: second }}>
          <ConsoleShot
            src="screens/maritime/mar-aipentest.png"
            {...SHOT}
            width={1360}
            top={170}
            url="HexaView · HexaStrike · AI Penetration Testing"
            keys={[
              { f: SWITCH, z: 1, x: 1000, y: 562 },
              { f: SWITCH + 30, z: 1, x: 1000, y: 562 },
              { f: SWITCH + 90, z: 1.4, x: 880, y: 900 },
            ]}
            overlay={(px) => (
              <>
                <Spotlight px={px} x={352} y={424} w={1616} h={112} show={prog(frame, SWITCH + 24, SWITCH + 38)} color="#EB7074" />
                <Spotlight px={px} x={360} y={836} w={1050} h={270} show={prog(frame, SWITCH + 96, SWITCH + 110)} color="#EB7074" />
              </>
            )}
          />
        </div>
      )}
      <Callout x={1880} y={760} w={440} align="right" show={prog(frame, 70, 86) * (1 - second)} title="Detect in minutes" body="Agents and analysts triage 94% of alerts with an explained verdict, around the clock." accent="#A580F8" />
      <Callout x={1880} y={760} w={440} align="right" show={prog(frame, SWITCH + 110, SWITCH + 126)} title="Prove defences hold" body="Guard-railed, AI-driven tests at Maasvlakte, Port Klang and Antwerp, every finding tracked to retest." accent="#EB7074" />
      <Sub frame={frame} at={SWITCH + 130} top={1010}>
        <span style={{ fontSize: 22, fontFamily: MONO, color: C.faint }}>Illustrative demo data</span>
      </Sub>
      <DocksideBadge frame={frame} />
    </Stage>
  );
};
