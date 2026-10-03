import type { CSSProperties } from 'react';
import { Check, Plane } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { THREAT_LEVELS, THREAT_COLOR } from '../../../data/modules/vip';
import { Badge, Btn, Callout, Card, Sources } from '../../../components/ui';
import { useVip } from './state';
import { Avatar } from './ui';

export function Travel() {
  const { trips, param, patch, tripDone, toggleTrip, notified, notify, watch, addWatch, openPerson } = useVip();
  const { toast } = useApp();
  const lvl = param('threat');
  const focus = param('id');
  const shown = trips.filter((t) => !lvl || t.threat === lvl);

  return (
    <>
      <Callout>
        Upcoming executive travel and public appearances, rated by HexaInt from destination risk, how public the itinerary is and the traveller’s exposure. Guidance is advisory; the security team owns the decision.
      </Callout>
      <div className="vip-bands">
        {THREAT_LEVELS.map((l) => (
          <button key={l} type="button" className={`vip-band ${lvl === l ? 'on' : ''}`} style={{ '--tone': THREAT_COLOR[l] } as CSSProperties} onClick={() => patch({ threat: lvl === l ? null : l, id: null })} title="Source: HexaInt travel risk · click to filter">
            <b>{trips.filter((t) => t.threat === l).length}</b>
            <span>{l} threat · trips</span>
          </button>
        ))}
      </div>
      <Card title="Upcoming travel & events" count={shown.length} sub="Next 60 days · tick controls as they are done" foot={<Sources items={[{ name: 'Travel booking feed' }, { name: 'HexaInt travel risk' }, { name: 'Event agendas (open source)' }]} />}>
        <div className="vip-trips">
          {shown.map((t) => {
            const done = t.controls.filter((x, i) => (tripDone[`${t.id}:${i}`] ? !x.done : x.done)).length;
            return (
              <div key={t.id} className="vip-trip" style={{ '--tone': THREAT_COLOR[t.threat], outline: focus === t.id ? '2px solid var(--m-int)' : undefined } as CSSProperties}>
                <div className="vip-trip-head">
                  <div>
                    <h4><Plane size={13} style={{ verticalAlign: -1, marginRight: 6 }} />{t.destination}</h4>
                    <span>{t.purpose}</span>
                  </div>
                  <div className="vip-when"><b>{t.departsIn}d</b><span>{t.nights} nights</span></div>
                </div>
                <button type="button" className="row" style={{ gap: 8, background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => openPerson(t.personId)}>
                  <Avatar name={t.personName} size="sm" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{t.personName}</span>
                </button>
                <div className="row wrap" style={{ gap: 6 }}>
                  <Badge color={THREAT_COLOR[t.threat]} solid={t.threat === 'High'}>{t.threat} threat</Badge>
                  {t.publicItinerary && <Badge color="var(--sev-medium)">Publicly announced</Badge>}
                  <Badge color={done === t.controls.length ? 'var(--good)' : 'var(--text-muted)'}>{done}/{t.controls.length} controls</Badge>
                </div>
                <ul className="vip-adv">{t.advisories.map((a) => <li key={a}>{a}</li>)}</ul>
                <div>
                  {t.controls.map((x, i) => {
                    const k = `${t.id}:${i}`;
                    const on = tripDone[k] ? !x.done : x.done;
                    return (
                      <button key={x.label} type="button" className={`vip-ctl ${on ? 'done' : ''}`} onClick={() => toggleTrip(k)}>
                        <i>{on && <Check />}</i>{x.label}
                      </button>
                    );
                  })}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <Btn sm disabled={notified[t.id]} onClick={() => { notify(t.id); toast(`Travel briefing for ${t.destination} sent to ${t.personName} and their assistant.`); }}>{notified[t.id] ? 'Briefed' : 'Send briefing'}</Btn>
                  <Btn sm disabled={watch[t.id]} onClick={() => { addWatch(t.id); toast(`HexaSOC will watch ${t.personName}’s accounts for sign-ins from unexpected locations during the trip.`); }}>{watch[t.id] ? 'Account watch on' : 'Watch account during trip'}</Btn>
                </div>
              </div>
            );
          })}
          {!shown.length && <div className="empty">No trips at this threat level.</div>}
        </div>
      </Card>
    </>
  );
}
