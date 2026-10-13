import fs from "node:fs";
const T = JSON.parse(fs.readFileSync("src/timeline.json", "utf8"));
const VO = JSON.parse(fs.readFileSync("src/vo-lines.json", "utf8")).filter((l) => !l.only || l.only === "cyberdockside");
const slow = T.slowBy.cyberdockside; let f = 0; const st = {}; const len = {};
for (const sh of T.shots.filter((s) => !s.only || s.only === "cyberdockside")) {
  st[sh.id] = f;
  const need = Math.max(0, ...VO.filter((l) => l.scene === sh.id).map((l) => l.offset + l.dur + (sh.tail ?? T.tail)));
  len[sh.id] = Math.round((sh.s * slow + Math.max(sh.hold, need - sh.s * slow)) * 30); f += len[sh.id];
}
console.log([st.maritimeOT + Math.round(150 * slow), st.maritimeComply + Math.round(120 * slow), st.maritimeSoc + Math.round(105 * slow), st.maritimeSoc + len.maritimeSoc - 5].join(" "));
