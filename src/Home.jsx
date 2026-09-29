import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { miles, eventDate } from './format';
import { BusyChart, CheckInButton, CrowdLabel } from './ParkParts.jsx';

export default function Home({ data, onViewPark }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    supabase.from('events')
      .select('id, title, starts_at, park:parks(name)')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at').limit(2)
      .then(({ data: rows }) => setEvents(rows || []));
  }, []);

  const near = data.parks.slice(0, 5);
  const best = near.find((p) => p.dogs_here <= 8) || near[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      <header className="masthead">
        <div className="eyebrow">{today.toUpperCase()}</div>
        <h1>Where to today?</h1>
      </header>

      {data.locStatus === 'asking' && <p className="muted">Finding parks near you…</p>}
      {data.locStatus === 'denied' && (
        <div className="card">
          <p>Allow location access in your browser to see parks near you, or search any area on the map.</p>
          <a className="btn" href="#map">Open the map</a>
        </div>
      )}
      {data.locStatus === 'ok' && data.loading && near.length === 0 && <p className="muted">Loading parks…</p>}
      {data.locStatus === 'ok' && !data.loading && near.length === 0 && (
        <p className="muted">No dog parks found within 5 miles yet.</p>
      )}

      {best && (
        <section className="card stack" aria-label="Best bet right now">
          <div className="eyebrow accent">BEST BET RIGHT NOW</div>
          <div>
            <h2 className="park-title">{best.name}</h2>
            <p className="muted meta">
              {miles(best.distance_m)} · {best.dogs_here} dogs now · <CrowdLabel dogs={best.dogs_here} />
            </p>
          </div>
          <BusyChart parkId={best.park_id} />
          <div className="btn-row">
            <CheckInButton park={best} data={data} />
            <button className="btn" onClick={() => onViewPark(best.park_id)}>View on map</button>
          </div>
        </section>
      )}

      {near.length > 0 && (
        <section aria-label="Nearby parks">
          <div className="section-head">
            <h2>Nearby parks</h2>
            <a href="#map">Map</a>
          </div>
          {near.map((p) => (
            <button key={p.park_id} className="list-row row-btn" onClick={() => onViewPark(p.park_id)}>
              <span className="col">
                <span className="strong">{p.name}</span>
                <span className="muted small">{miles(p.distance_m)}</span>
              </span>
              <span className="col end">
                <span className="strong">{p.dogs_here} dogs</span>
                <span className="small"><CrowdLabel dogs={p.dogs_here} /></span>
              </span>
            </button>
          ))}
        </section>
      )}

      {events.length > 0 && (
        <section aria-label="Coming up">
          <div className="section-head">
            <h2>Coming up</h2>
            <a href="#events">All events</a>
          </div>
          {events.map((e) => {
            const d = eventDate(e.starts_at);
            return (
              <div key={e.id} className="event-mini">
                <div className="date-block"><span className="small-caps">{d.mon}</span><span className="big-num">{d.day}</span></div>
                <div className="col">
                  <span className="strong">{e.title}</span>
                  <span className="muted small">{d.time} · {e.park?.name}</span>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
