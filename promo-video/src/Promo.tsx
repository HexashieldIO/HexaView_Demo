import React from "react";
import { Series } from "remotion";
import { HexIris, loadBrandFonts, sec } from "./theme";
import { S1Noise } from "./scenes/S1Noise";
import { S2Islands } from "./scenes/S2Islands";
import { S3FirstCell } from "./scenes/S3FirstCell";
import { S4OnePane } from "./scenes/S4OnePane";
import { S5Capabilities } from "./scenes/S5Capabilities";
import { S6ClosedLoop } from "./scenes/S6ClosedLoop";
import { S7Industries } from "./scenes/S7Industries";
import { S8EndCard } from "./scenes/S8EndCard";

// Concept A, "From Noise to Hive": shot lengths follow the storyboard.
export const SHOTS = [
  { C: S1Noise, s: 4, iris: false },
  { C: S2Islands, s: 5, iris: true },
  { C: S3FirstCell, s: 5, iris: false }, // hard cut from black
  { C: S4OnePane, s: 6, iris: true },
  { C: S5Capabilities, s: 7, iris: true },
  { C: S6ClosedLoop, s: 6, iris: true },
  { C: S7Industries, s: 6, iris: true },
  { C: S8EndCard, s: 6, iris: true },
];

export const TOTAL_FRAMES = SHOTS.reduce((n, x) => n + sec(x.s), 0);

export const Promo: React.FC = () => {
  loadBrandFonts();
  return (
    <Series>
      {SHOTS.map(({ C, s, iris }, i) => (
        <Series.Sequence key={i} durationInFrames={sec(s)}>
          {iris ? (
            <HexIris>
              <C />
            </HexIris>
          ) : (
            <C />
          )}
        </Series.Sequence>
      ))}
    </Series>
  );
};
