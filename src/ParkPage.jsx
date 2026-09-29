import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { crowdStatus, eventDate } from './format';
import { BusyChart, CheckInButton, DirectionsLink } from './ParkParts.jsx';

const AMENITIES = [
  ['fenced', 'Fully fenced'],
  ['small_dog_area', 'Small-dog area'],
  ['water', 'Water fountain'],
  ['shade', 'Shade'],
  ['lighting', 'Lights at night'],
  ['parking', 'Parking'],
  ['restrooms', 'Restrooms'],
  ['agility', 'Agility equipment'],
];

const REPORT_KINDS = [
  ['muddy', 'Muddy'],
  ['crowded', 'Crowded'],
  ['gate_broken', 'Gate broken'],
  ['no_water', 'Water off'],
  ['hazard', 'Hazard'],
  ['other', 'Other'],
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Google "periods" → is the park open right now (in the viewer's local time)?
function isOpenNow(periods) {
  if (!periods?.length) return null;
  if (periods.length === 1 && !periods[0].close) return true; // open 24 hours
  const week = 7 * 1440;
  const now = new Date();
  const m = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  for (const p of periods) {
    if (!p.open || !p.close) continue;
    const s = p.open.day * 1440 + (p.open.hour || 0) * 60 + (p.open.minute || 0);
    let e = p.close.day * 1440 + (p.close.hour || 0) * 60 + (p.close.minute || 0);
    if (e <= s) e += week;
    if ((m >= s && m < e) || (m + week >= s && m + week < e)) return true;
  }
  return false;
}

export default function ParkPage({ parkId, data, session }) {
  const uid = session.user.id;
  const [park, setPark] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState(null);
  const [liveDogs, setLiveDogs] = useState([]);
  const [day, setDay] = useState(new Date().getDay());

  const loadLive = useCallback(async () => {
    const [{ data: rows }, { data: dogs }] = await Promise.all([
      supabase.rpc('park_detail', { p_park_id: parkId }),
      supabase.rpc('park_live_dogs', { p_park_id: parkId }),
    ]);
    if (!rows || rows.length === 0) { setNotFound(true); return; }
    setPark(rows[0]);
    setLiveDogs(dogs || []);
  }, [parkId]);

  useEffect(() => {
    loadLive();
    supabase.functions.invoke('park-details', { body: { park_id: parkId } }).then(({ data: d, error }) => {
      if (error) setDetailsError('Couldn’t load hours and photos from Google right now.');
      else setDetails(d || {});
    });
    const channel = supabase
      .channel(`park-${parkId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'park_activity', filter: `park_id=eq.${parkId}` },
        () => loadLive())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [parkId, loadLive]);

  // Keep the check-in button's state in sync with this page
  useEffect(() => { if (park) loadLive(); }, [data.activeParkId]);

  if (notFound) {
    return (
      <div className="page">
        <a className="back-link" href="#map">← Back to map</a>
        <p>This park couldn’t be found. It may have been removed.</p>
      </div>
    );
  }
  if (!park) return <div className="page muted">Loading park…</div>;

  const status = crowdStatus(park.dogs_here);
  const open = isOpenNow(details?.periods);
  const address = details?.address || park.address;
  const todayIdx = (new Date().getDay() + 6) % 7; // Google lists Monday first

  return (
    <div className="page park-page">
      <a className="back-link" href="#map">← Back to map</a>

      {details?.photo?.url && (
        <figure className="park-hero">
          <img src={details.photo.url} alt={`Photo of ${park.name}`} onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
          {details.photo.credits?.length > 0 && (
            <figcaption className="photo-credit">
              Photo:{' '}
              {details.photo.credits.map((c, i) => (
                <span key={c.uri || i}>{i > 0 && ', '}<a href={c.uri} target="_blank" rel="noreferrer">{c.name}</a></span>
              ))}{' '}
              · Google
            </figcaption>
          )}
        </figure>
      )}

      <header className="stack tight">
        <h1>{park.name}</h1>
        {address && <p className="muted">{address}</p>}
        <div className="tag-row">
          {open !== null && (
            <span className={open ? 'status-chip open' : 'status-chip closed'}>{open ? 'Open now' : 'Closed now'}</span>
          )}
          {details?.google_rating && (
            <span className="small">★ {details.google_rating} on Google ({details.google_review_count})</span>
          )}
          {park.review_count > 0 && (
            <span className="small">★ {park.avg_rating} from {park.review_count} Field Guide {park.review_count === 1 ? 'review' : 'reviews'}</span>
          )}
        </div>
        <div className="btn-row">
          <CheckInButton park={park} data={data} />
          <DirectionsLink park={park} />
          {details?.phone && <a className="btn" href={`tel:${details.phone}`}>Call</a>}
          {details?.website && <a className="btn" href={details.website} target="_blank" rel="noreferrer">Website</a>}
        </div>
        {detailsError && <p className="muted small">{detailsError}</p>}
      </header>

      <section className="card stack" aria-label="Live right now">
        <div className="row-between">
          <h2>Right now</h2>
          <span className="crowd"><span className="dot" style={{ background: status.color }} />{status.label}</span>
        </div>
        <p>
          <span className="big-num">{park.dogs_here}</span> {park.dogs_here === 1 ? 'dog' : 'dogs'} here
          {park.dogs_here > 0 && (
            <span className="muted"> · {park.small_dogs} small · {park.medium_dogs} medium · {park.large_dogs} large</span>
          )}
        </p>
        {liveDogs.length > 0 && (
          <div className="dog-chips">
            {liveDogs.map((d) => (
              <div key={d.dog_id} className="dog-chip">
                <span className="mini-avatar">
                  {d.photo_url ? <img src={d.photo_url} alt="" /> : d.name[0]}
                </span>
                <span className="col">
                  <span className="strong">{d.name}</span>
                  <span className="muted small">{[d.breed, d.size].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {park.dogs_here > liveDogs.length && liveDogs.length > 0 && (
          <p className="muted small">Some dogs here have private profiles.</p>
        )}
      </section>

      <Conditions parkId={parkId} uid={uid} />

      <section className="stack" aria-label="Busy times">
        <h2>Busy times</h2>
        <div className="chips" role="group" aria-label="Day of week">
          {DAYS.map((label, i) => (
            <button key={label} className="chip small-chip" aria-pressed={day === i} onClick={() => setDay(i)}>{label}</button>
          ))}
        </div>
        <BusyChart parkId={parkId} day={day} />
      </section>

      {details?.hours && (
        <section className="stack tight" aria-label="Hours">
          <h2>Hours</h2>
          <ul className="hours-list">
            {details.hours.map((h, i) => (
              <li key={h} className={i === todayIdx ? 'today' : ''}>{h}</li>
            ))}
          </ul>
          <p className="muted small">Hours from Google. Check posted signs for seasonal changes.</p>
        </section>
      )}

      <Amenities parkId={parkId} uid={uid} />
      <ParkEvents parkId={parkId} uid={uid} />
      <Reviews parkId={parkId} uid={uid} onChange={loadLive} />
    </div>
  );
}

function Conditions({ parkId, uid }) {
  const [reports, setReports] = useState([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('muddy');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('park_reports')
      .select('id, kind, note, created_at, user_id')
      .eq('park_id', parkId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setReports(data || []);
  }, [parkId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.from('park_reports')
      .insert({ park_id: parkId, user_id: uid, kind, note: note.trim() || null });
    if (error) { setErr(error.message); return; }
    setNote('');
    setOpen(false);
    load();
  }

  async function remove(id) {
    await supabase.from('park_reports').delete().eq('id', id);
    load();
  }

  const labelFor = (k) => REPORT_KINDS.find(([key]) => key === k)?.[1] || k;

  return (
    <section className="stack tight" aria-label="Conditions">
      <div className="row-between">
        <h2>Conditions today</h2>
        <button className="link-btn" onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Report a condition'}</button>
      </div>
      {reports.length === 0 && !open && <p className="muted">No problems reported in the last 24 hours.</p>}
      {reports.map((r) => (
        <div key={r.id} className="report">
          <span className="tag warn">{labelFor(r.kind)}</span>
          <span className="grow small">{r.note}</span>
          <span className="muted small nowrap">{timeAgo(r.created_at)}</span>
          {r.user_id === uid && <button className="link-btn small" onClick={() => remove(r.id)}>Remove</button>}
        </div>
      ))}
      {open && (
        <form className="card stack" onSubmit={submit}>
          <div className="chips" role="group" aria-label="What’s the condition?">
            {REPORT_KINDS.map(([k, label]) => (
              <button type="button" key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="report-note">Details (optional)</label>
            <input id="report-note" className="input" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Big puddle by the east gate" />
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="btn-row"><button className="btn btn-primary">Post report</button></div>
          <p className="muted small">Reports disappear after 24 hours.</p>
        </form>
      )}
    </section>
  );
}

function Amenities({ parkId, uid }) {
  const [rows, setRows] = useState({});

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('park_amenities', { p_park_id: parkId });
    const map = {};
    (data || []).forEach((r) => { map[r.amenity] = r; });
    setRows(map);
  }, [parkId]);

  useEffect(() => { load(); }, [load]);

  async function vote(amenity, value) {
    const mine = rows[amenity]?.my_vote;
    if (mine === value) {
      await supabase.from('park_amenity_votes').delete()
        .eq('park_id', parkId).eq('user_id', uid).eq('amenity', amenity);
    } else {
      await supabase.from('park_amenity_votes')
        .upsert({ park_id: parkId, user_id: uid, amenity, value }, { onConflict: 'park_id,user_id,amenity' });
    }
    load();
  }

  return (
    <section className="stack tight" aria-label="Amenities">
      <h2>Amenities</h2>
      <p className="muted small">Answered by visitors. Tap Yes or No if you’ve been here.</p>
      <div className="amenity-grid">
        {AMENITIES.map(([key, label]) => {
          const r = rows[key];
          const yes = r?.yes_votes || 0;
          const no = r?.no_votes || 0;
          const answer = yes + no === 0 ? 'Not reported yet'
            : yes > no ? `Yes (${yes})` : no > yes ? `No (${no})` : 'Mixed reports';
          return (
            <div key={key} className="amenity">
              <span className="col">
                <span className="strong">{label}</span>
                <span className={yes + no === 0 ? 'muted small' : 'small'}>{answer}</span>
              </span>
              <span className="vote-btns">
                <button className="chip small-chip" aria-pressed={r?.my_vote === true} onClick={() => vote(key, true)} aria-label={`${label}: yes`}>Yes</button>
                <button className="chip small-chip" aria-pressed={r?.my_vote === false} onClick={() => vote(key, false)} aria-label={`${label}: no`}>No</button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ParkEvents({ parkId, uid }) {
  const [events, setEvents] = useState([]);
  const [mine, setMine] = useState(new Set());

  const load = useCallback(async () => {
    const [ev, my] = await Promise.all([
      supabase.from('events')
        .select('id, title, starts_at, event_rsvps(count)')
        .eq('park_id', parkId)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at').limit(10),
      supabase.from('event_rsvps').select('event_id').eq('user_id', uid),
    ]);
    setEvents(ev.data || []);
    setMine(new Set((my.data || []).map((r) => r.event_id)));
  }, [parkId, uid]);

  useEffect(() => { load(); }, [load]);

  async function toggle(id) {
    if (mine.has(id)) await supabase.from('event_rsvps').delete().eq('event_id', id).eq('user_id', uid);
    else await supabase.from('event_rsvps').insert({ event_id: id, user_id: uid, status: 'going' });
    load();
  }

  return (
    <section aria-label="Events here">
      <div className="section-head">
        <h2>Events here</h2>
        <a href="#events">Host an event</a>
      </div>
      {events.length === 0 && <p className="muted">No upcoming events at this park yet.</p>}
      {events.map((e) => {
        const d = eventDate(e.starts_at);
        const going = mine.has(e.id);
        return (
          <div key={e.id} className="event-mini">
            <div className="date-block"><span className="small-caps">{d.mon}</span><span className="big-num">{d.day}</span></div>
            <div className="col grow">
              <span className="strong">{e.title}</span>
              <span className="muted small">{d.dow} {d.time} · {e.event_rsvps?.[0]?.count ?? 0} going</span>
            </div>
            <button className={going ? 'btn btn-primary' : 'btn btn-accent'} aria-pressed={going} onClick={() => toggle(e.id)}>
              {going ? 'Going' : 'RSVP'}
            </button>
          </div>
        );
      })}
    </section>
  );
}

function Reviews({ parkId, uid, onChange }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('park_reviews')
      .select('user_id, rating, comment, created_at, profile:profiles(display_name)')
      .eq('park_id', parkId)
      .order('created_at', { ascending: false })
      .limit(50);
    setReviews(data || []);
    const mine = (data || []).find((r) => r.user_id === uid);
    setRating(mine?.rating || 0);
    setComment(mine?.comment || '');
  }, [parkId, uid]);

  useEffect(() => { load(); }, [load]);

  const myReview = reviews.find((r) => r.user_id === uid);

  async function save(e) {
    e.preventDefault();
    if (!rating) { setErr('Pick a star rating.'); return; }
    setErr(null);
    const { error } = await supabase.from('park_reviews').upsert(
      { park_id: parkId, user_id: uid, rating, comment: comment.trim() || null, created_at: new Date().toISOString() },
      { onConflict: 'park_id,user_id' }
    );
    if (error) { setErr(error.message); return; }
    setEditing(false);
    load();
    onChange();
  }

  async function remove() {
    await supabase.from('park_reviews').delete().eq('park_id', parkId).eq('user_id', uid);
    setEditing(false);
    load();
    onChange();
  }

  const showForm = editing || !myReview;

  return (
    <section className="stack" aria-label="Reviews">
      <h2>Reviews</h2>

      {showForm ? (
        <form className="card stack" onSubmit={save}>
          <span className="strong">{myReview ? 'Edit your review' : 'How was your visit?'}</span>
          <div className="stars" role="group" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n}
                className={n <= rating ? 'star on' : 'star'} onClick={() => setRating(n)}>★</button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="review-text">Your review (optional)</label>
            <textarea id="review-text" className="input" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Good for small dogs? Shade? Clean? Friendly crowd?" />
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="btn-row">
            <button className="btn btn-primary">{myReview ? 'Save changes' : 'Post review'}</button>
            {myReview && <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>}
            {myReview && <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>}
          </div>
        </form>
      ) : (
        <button className="link-btn left" onClick={() => setEditing(true)}>Edit your review</button>
      )}

      {reviews.length === 0 && <p className="muted">No reviews yet. Be the first.</p>}
      {reviews.map((r) => (
        <article key={r.user_id} className="review">
          <div className="row-between">
            <span className="strong">{r.profile?.display_name || 'Dog owner'}{r.user_id === uid && ' (you)'}</span>
            <span className="muted small">{timeAgo(r.created_at)}</span>
          </div>
          <span className="stars-static" aria-label={`${r.rating} out of 5 stars`}>
            {'★'.repeat(r.rating)}<span className="dim">{'★'.repeat(5 - r.rating)}</span>
          </span>
          {r.comment && <p>{r.comment}</p>}
        </article>
      ))}
    </section>
  );
}
