export function crowdStatus(dogs) {
  if (dogs === 0) return { label: 'No dogs yet', color: '#56607A' };
  if (dogs <= 4) return { label: 'Quiet', color: '#2C6DB5' };
  if (dogs <= 8) return { label: 'Moderate', color: '#B7791F' };
  return { label: 'Busy', color: '#C2410C' };
}

export const miles = (meters) => `${(meters / 1609.34).toFixed(1)} mi`;

export function eventDate(iso) {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    day: d.getDate(),
    mon: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

export function ageFrom(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  const months = (new Date().getFullYear() - b.getFullYear()) * 12 + (new Date().getMonth() - b.getMonth());
  if (months < 12) return `${Math.max(months, 0)} mo`;
  return `${Math.floor(months / 12)} yrs`;
}

// Rough distance in meters between two {lat, lng} points
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
