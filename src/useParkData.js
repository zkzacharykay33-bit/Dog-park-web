import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, TEST_MODE } from './supabase';

const RADIUS_M = 8000;

// Shared data for the signed-in user: location, nearby parks with live
// counts, their dogs, and where they're checked in.
export function useParkData(session) {
  const [coords, setCoords] = useState(null);     // where the user is
  const [center, setCenter] = useState(null);     // where we searched
  const [locStatus, setLocStatus] = useState('asking'); // asking | ok | denied
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myDogs, setMyDogs] = useState([]);
  const [activeParkId, setActiveParkId] = useState(null);
  const synced = useRef(new Set());
  const centerRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus('ok');
      },
      () => setLocStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const loadParks = useCallback(async (pt = centerRef.current) => {
    if (!pt) return [];
    const { data, error } = await supabase.rpc('parks_nearby', {
      p_lat: pt.lat, p_lng: pt.lng, p_radius_m: RADIUS_M,
    });
    if (error) { console.error('parks_nearby failed', error); return []; }
    setParks(data || []);
    return data || [];
  }, []);

  // Import parks from Google for a new area (once per ~1 km square per visit), then load them
  const searchArea = useCallback(async (pt) => {
    centerRef.current = pt;
    setCenter(pt);
    setLoading(true);
    const key = `${pt.lat.toFixed(2)},${pt.lng.toFixed(2)}`;
    if (!synced.current.has(key)) {
      synced.current.add(key);
      const { error } = await supabase.functions.invoke('sync-parks', {
        body: { lat: pt.lat, lng: pt.lng, radius: RADIUS_M },
      });
      if (error) console.error('sync-parks failed', error);
    }
    await loadParks(pt);
    setLoading(false);
  }, [loadParks]);

  useEffect(() => { if (coords) searchArea(coords); }, [coords, searchArea]);

  const loadMine = useCallback(async () => {
    const uid = session.user.id;
    const [dogsRes, activeRes] = await Promise.all([
      supabase.from('dogs').select('*').eq('owner_id', uid).order('created_at'),
      supabase.from('check_ins').select('park_id')
        .eq('user_id', uid).is('checked_out_at', null)
        .gt('expires_at', new Date().toISOString()).limit(1),
    ]);
    setMyDogs(dogsRes.data || []);
    setActiveParkId(activeRes.data?.[0]?.park_id ?? null);
  }, [session]);

  useEffect(() => { loadMine(); }, [loadMine]);

  // Live updates: refetch when any park changes, plus every 3 minutes for expired check-ins
  useEffect(() => {
    if (!center) return;
    const channel = supabase
      .channel('park-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'park_activity' }, () => loadParks())
      .subscribe();
    const timer = setInterval(() => loadParks(), 3 * 60 * 1000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, [center, loadParks]);

  const checkIn = useCallback(async (parkId) => {
    const sendLocation = !TEST_MODE && coords;
    const { error } = await supabase.rpc('check_in', {
      p_park_id: parkId,
      p_dog_ids: myDogs.map((d) => d.id),
      p_lat: sendLocation ? coords.lat : null,
      p_lng: sendLocation ? coords.lng : null,
    });
    if (error) throw error;
    setActiveParkId(parkId);
    await loadParks();
  }, [coords, myDogs, loadParks]);

  const checkOut = useCallback(async () => {
    const { error } = await supabase.rpc('check_out');
    if (error) throw error;
    setActiveParkId(null);
    await loadParks();
  }, [loadParks]);

  return {
    coords, center, locStatus, parks, loading, myDogs, activeParkId,
    searchArea, loadParks, loadMine, checkIn, checkOut,
  };
}
