import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { crowdStatus } from './format';

export function CrowdLabel({ dogs }) {
  const s = crowdStatus(dogs);
  return (
    <span className="crowd">
      <span className="dot" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function CheckInButton({ park, data }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const here = data.activeParkId === park.park_id;

  if (!here && data.myDogs.length === 0) {
    return <a className="btn btn-primary" href="#dogs">Add your dog to check in</a>;
  }

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      if (here) await data.checkOut();
      else await data.checkIn(park.park_id);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const names = data.myDogs.map((d) => d.name).join(' & ');
  return (
    <>
      <button className="btn btn-primary" disabled={busy} onClick={go}>
        {busy ? 'Saving…' : here ? 'Check out' : `Check in with ${names}`}
      </button>
      {err && <p className="error full" role="alert">{err}</p>}
    </>
  );
}

export function DirectionsLink({ park }) {
  return (
    <a
      className="btn"
      href={`https://www.google.com/maps/dir/?api=1&destination=${park.latitude},${park.longitude}`}
      target="_blank"
      rel="noreferrer"
    >
      Directions
    </a>
  );
}

// Typical dog arrivals by hour for a weekday (default today), from the last 8 weeks of check-ins
export function BusyChart({ parkId, day }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    supabase.rpc('park_busy_times', { p_park_id: parkId, p_tz: tz }).then(({ data }) => {
      if (!cancelled) setRows(data || []);
    });
    return () => { cancelled = true; };
  }, [parkId]);

  if (!rows) return null;
  const today = new Date().getDay();
  const showDay = day ?? today;
  const nowHour = showDay === today ? new Date().getHours() : -1;
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  const vals = hours.map((h) =>
    Number(rows.find((r) => r.day_of_week === showDay && r.hour_of_day === h)?.avg_dog_arrivals || 0)
  );
  const max = Math.max(...vals);

  if (max === 0) {
    return <p className="muted small">Busy times appear here once people start checking in.</p>;
  }
  return (
    <div className="chart">
      <div className="bars" role="img" aria-label="Typical number of dogs arriving each hour">
        {vals.map((v, i) => (
          <div
            key={hours[i]}
            className={hours[i] === nowHour ? 'now' : ''}
            style={{ height: `${Math.max(5, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="bar-labels"><span>7a</span><span>10a</span><span>1p</span><span>4p</span><span>7p</span></div>
    </div>
  );
}
