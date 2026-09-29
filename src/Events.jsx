import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { eventDate } from './format';

const CATEGORIES = [
  { key: 'meetup', label: 'Meetup' },
  { key: 'puppy', label: 'Puppies' },
  { key: 'breed_day', label: 'Breed day' },
  { key: 'training', label: 'Training' },
  { key: 'cleanup', label: 'Cleanup' },
  { key: 'other', label: 'Other' },
];
const FILTERS = [{ key: 'all', label: 'All' }, { key: 'weekend', label: 'This weekend' }, ...CATEGORIES.slice(0, 5)];

function isThisWeekend(iso) {
  const d = new Date(iso);
  const days = (d - new Date()) / 86400000;
  return days < 7 && (d.getDay() === 0 || d.getDay() === 6);
}

export default function Events({ data, session }) {
  const uid = session.user.id;
  const [events, setEvents] = useState(null);
  const [mine, setMine] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [hosting, setHosting] = useState(false);

  const load = useCallback(async () => {
    const [evRes, myRes] = await Promise.all([
      supabase.from('events')
        .select('id, title, description, category, starts_at, ends_at, host_id, park:parks(name), event_rsvps(count)')
        .gte('ends_at', new Date().toISOString())
        .order('starts_at').limit(50),
      supabase.from('event_rsvps').select('event_id').eq('user_id', uid),
    ]);
    setEvents(evRes.data || []);
    setMine(new Set((myRes.data || []).map((r) => r.event_id)));
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  async function toggleRsvp(id) {
    if (mine.has(id)) {
      await supabase.from('event_rsvps').delete().eq('event_id', id).eq('user_id', uid);
    } else {
      await supabase.from('event_rsvps').insert({ event_id: id, user_id: uid, status: 'going' });
    }
    load();
  }

  const shown = (events || []).filter((e) =>
    filter === 'all' ? true : filter === 'weekend' ? isThisWeekend(e.starts_at) : e.category === filter
  );

  return (
    <div className="page">
      <header className="masthead row-between">
        <div>
          <div className="eyebrow">EVENTS</div>
          <h1>What’s on</h1>
        </div>
        <button className="btn" onClick={() => setHosting(!hosting)}>{hosting ? 'Close' : 'Host an event'}</button>
      </header>

      {hosting && (
        <HostForm parks={data.parks} uid={uid} onDone={() => { setHosting(false); load(); }} />
      )}

      <div className="chips" role="group" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <section>
        {events === null && <p className="muted">Loading events…</p>}
        {events && shown.length === 0 && (
          <p className="muted">No upcoming events here yet. Host the first one.</p>
        )}
        {shown.map((e) => {
          const d = eventDate(e.starts_at);
          const going = mine.has(e.id);
          const count = e.event_rsvps?.[0]?.count ?? 0;
          const cat = CATEGORIES.find((c) => c.key === e.category)?.label;
          return (
            <article key={e.id} className="event-row">
              <div className="date-block">
                <span className="small-caps">{d.dow}</span>
                <span className="big-num">{d.day}</span>
                <span className="small-caps accent">{d.mon}</span>
              </div>
              <div className="col grow">
                <h3 className="event-title">{e.title}</h3>
                <span className="muted small">{d.time} · {e.park?.name}</span>
                {e.description && <span className="small">{e.description}</span>}
                <span className="tag-row"><span className="tag">{cat}</span><span className="small">{count} going</span></span>
              </div>
              <button className={going ? 'btn btn-primary' : 'btn btn-accent'} aria-pressed={going} onClick={() => toggleRsvp(e.id)}>
                {going ? 'Going' : 'RSVP'}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function HostForm({ parks, uid, onDone }) {
  const [form, setForm] = useState({ title: '', park_id: parks[0]?.park_id || '', category: 'meetup', starts: '', hours: '1', description: '' });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (parks.length === 0) {
    return <div className="card">Open the Map tab and search an area first, so you can pick a park.</div>;
  }

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    const start = new Date(form.starts);
    if (isNaN(start) || start < new Date()) { setErr('Pick a start time in the future.'); return; }
    setSaving(true);
    const { error } = await supabase.from('events').insert({
      park_id: form.park_id,
      host_id: uid,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + Number(form.hours) * 3600000).toISOString(),
    });
    setSaving(false);
    if (error) setErr(error.message);
    else onDone();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Host an event</h2>
      <div className="field"><label htmlFor="ev-title">Title</label>
        <input id="ev-title" className="input" required minLength={3} maxLength={80} value={form.title} onChange={set('title')} /></div>
      <div className="field"><label htmlFor="ev-park">Park</label>
        <select id="ev-park" className="input" value={form.park_id} onChange={set('park_id')}>
          {parks.map((p) => <option key={p.park_id} value={p.park_id}>{p.name}</option>)}
        </select></div>
      <div className="grid-2">
        <div className="field"><label htmlFor="ev-cat">Type</label>
          <select id="ev-cat" className="input" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select></div>
        <div className="field"><label htmlFor="ev-hours">Length</label>
          <select id="ev-hours" className="input" value={form.hours} onChange={set('hours')}>
            <option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3 hours</option>
          </select></div>
      </div>
      <div className="field"><label htmlFor="ev-start">Starts</label>
        <input id="ev-start" type="datetime-local" className="input" required value={form.starts} onChange={set('starts')} /></div>
      <div className="field"><label htmlFor="ev-desc">Details (optional)</label>
        <textarea id="ev-desc" className="input" maxLength={2000} value={form.description} onChange={set('description')} /></div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="btn-row"><button className="btn btn-primary" disabled={saving}>{saving ? 'Posting…' : 'Post event'}</button></div>
    </form>
  );
}
