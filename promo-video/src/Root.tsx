import React from "react";
import { Composition } from "remotion";
import { Promo, TOTAL_FRAMES } from "./Promo";
import { FPS } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition id="HexaViewPromo" component={Promo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
