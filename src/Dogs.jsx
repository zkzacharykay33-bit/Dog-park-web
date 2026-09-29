import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { ageFrom } from './format';

const SIZES = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['xl', 'XL']];
const ENERGY = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
const label = (list, key) => list.find(([k]) => k === key)?.[1] || key;

export default function Dogs({ data, session }) {
  const uid = session.user.id;
  const dogs = data.myDogs;
  const [selId, setSelId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | dog
  const [visits, setVisits] = useState(null);
  const dog = dogs.find((d) => d.id === selId) || dogs[0];

  useEffect(() => {
    if (!dog) return;
    setVisits(null);
    supabase.from('check_in_dogs').select('check_in_id', { count: 'exact', head: true }).eq('dog_id', dog.id)
      .then(({ count }) => setVisits(count ?? 0));
  }, [dog?.id]);

  async function togglePublic() {
    await supabase.from('dogs').update({ is_public: !dog.is_public }).eq('id', dog.id);
    data.loadMine();
  }

  async function uploadPhoto(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${dog.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('dog-photos').upload(path, file, { contentType: file.type });
    if (error) { alert(`Photo upload failed: ${error.message}`); return; }
    const { data: pub } = supabase.storage.from('dog-photos').getPublicUrl(path);
    await supabase.from('dogs').update({ photo_url: pub.publicUrl }).eq('id', dog.id);
    data.loadMine();
  }

  if (editing) {
    return (
      <div className="page">
        <DogForm
          dog={editing === 'new' ? null : editing}
          uid={uid}
          onCancel={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setSelId(id); data.loadMine(); }}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="masthead">
        <div className="eyebrow">MY DOGS</div>
        <div className="chips">
          {dogs.map((d) => (
            <button key={d.id} className="chip" aria-pressed={dog?.id === d.id} onClick={() => setSelId(d.id)}>{d.name}</button>
          ))}
          <button className="chip" onClick={() => setEditing('new')}>+ Add a dog</button>
        </div>
      </header>

      {!dog && (
        <div className="card stack">
          <h2>Add your first dog</h2>
          <p className="muted">Your dog’s profile is what other owners see when you check in at a park.</p>
          <div className="btn-row"><button className="btn btn-primary" onClick={() => setEditing('new')}>Add a dog</button></div>
        </div>
      )}

      {dog && (
        <>
          <section className="profile">
            <label className="avatar" title="Change photo">
              {dog.photo_url ? <img src={dog.photo_url} alt={dog.name} /> : dog.name[0]}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadPhoto(e.target.files[0])} />
              <span className="sr-only">Change photo</span>
            </label>
            <div className="col">
              <h1>{dog.name}</h1>
              <span className="muted">{[dog.breed, ageFrom(dog.birthday)].filter(Boolean).join(' · ') || 'Add breed and birthday'}</span>
              <button className="link-btn left" onClick={() => setEditing(dog)}>Edit profile</button>
            </div>
          </section>

          {dog.bio && <p className="bio">{dog.bio}</p>}
          {dog.temperament?.length > 0 && (
            <div className="tag-row">{dog.temperament.map((t) => <span key={t} className="tag">{t}</span>)}</div>
          )}

          <section className="facts" aria-label="Details">
            <div><span className="fact-k">Size</span><span className="fact-v">{label(SIZES, dog.size)}</span></div>
            <div><span className="fact-k">Energy</span><span className="fact-v">{label(ENERGY, dog.energy)}</span></div>
            <div><span className="fact-k">Park visits</span><span className="fact-v">{visits ?? '–'}</span></div>
            <div><span className="fact-k">Vaccines</span><span className="fact-v">{dog.vaccinated ? 'Up to date' : 'Not marked'}</span></div>
          </section>

          <label className="card check-card">
            <span className="col">
              <span className="strong">Show in “Who’s here”</span>
              <span className="muted small">Other owners see {dog.name} when you check in</span>
            </span>
            <input type="checkbox" checked={dog.is_public} onChange={togglePublic} />
          </label>
        </>
      )}

      <div className="account">
        <span className="muted small">Signed in as {session.user.email}</span>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}

function DogForm({ dog, uid, onCancel, onSaved }) {
  const [f, setF] = useState({
    name: dog?.name || '', breed: dog?.breed || '', size: dog?.size || 'medium', energy: dog?.energy || 'medium',
    birthday: dog?.birthday || '', bio: dog?.bio || '', temperament: (dog?.temperament || []).join(', '),
    vaccinated: dog?.vaccinated || false, is_public: dog?.is_public ?? true,
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const row = {
      name: f.name.trim(), breed: f.breed.trim() || null, size: f.size, energy: f.energy,
      birthday: f.birthday || null, bio: f.bio.trim() || null,
      temperament: f.temperament.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
      vaccinated: f.vaccinated, is_public: f.is_public,
    };
    const res = dog
      ? await supabase.from('dogs').update(row).eq('id', dog.id).select('id').single()
      : await supabase.from('dogs').insert({ ...row, owner_id: uid }).select('id').single();
    setSaving(false);
    if (res.error) setErr(res.error.message);
    else onSaved(res.data.id);
  }

  async function remove() {
    if (!window.confirm(`Delete ${dog.name}'s profile? This can't be undone.`)) return;
    const { error } = await supabase.from('dogs').delete().eq('id', dog.id);
    if (error) setErr(error.message);
    else onSaved(null);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1>{dog ? `Edit ${dog.name}` : 'Add a dog'}</h1>
      <div className="field"><label htmlFor="d-name">Name</label>
        <input id="d-name" className="input" required maxLength={40} value={f.name} onChange={set('name')} /></div>
      <div className="field"><label htmlFor="d-breed">Breed</label>
        <input id="d-breed" className="input" value={f.breed} onChange={set('breed')} placeholder="e.g. Golden Retriever mix" /></div>
      <div className="grid-2">
        <div className="field"><label htmlFor="d-size">Size</label>
          <select id="d-size" className="input" value={f.size} onChange={set('size')}>
            {SIZES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div className="field"><label htmlFor="d-energy">Energy</label>
          <select id="d-energy" className="input" value={f.energy} onChange={set('energy')}>
            {ENERGY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
      </div>
      <div className="field"><label htmlFor="d-bday">Birthday</label>
        <input id="d-bday" type="date" className="input" value={f.birthday} onChange={set('birthday')} /></div>
      <div className="field"><label htmlFor="d-bio">About</label>
        <textarea id="d-bio" className="input" maxLength={500} value={f.bio} onChange={set('bio')} /></div>
      <div className="field"><label htmlFor="d-temp">Personality (separate with commas)</label>
        <input id="d-temp" className="input" value={f.temperament} onChange={set('temperament')} placeholder="Loves fetch, Shy with big dogs" /></div>
      <label className="check"><input type="checkbox" checked={f.vaccinated} onChange={set('vaccinated')} /> Vaccines up to date</label>
      <label className="check"><input type="checkbox" checked={f.is_public} onChange={set('is_public')} /> Show in “Who’s here” at parks</label>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="btn-row">
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        {dog && <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}
