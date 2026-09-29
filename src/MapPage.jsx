import { useEffect, useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MAPS_KEY } from './supabase';
import { miles, distanceM } from './format';
import { CheckInButton, CrowdLabel, DirectionsLink } from './ParkParts.jsx';

const US_CENTER = { lat: 39.5, lng: -98.35 };

export default function MapPage({ data, selectedId, setSelectedId }) {
  const [viewCenter, setViewCenter] = useState(null);

  if (!MAPS_KEY) {
    return <div className="page"><p>Add <code>VITE_GOOGLE_MAPS_KEY</code> to your environment variables to show the map.</p></div>;
  }
  if (data.locStatus === 'asking') {
    return <div className="page muted">Finding your location…</div>;
  }

  const start = data.center || data.coords || US_CENTER;
  const moved = viewCenter && (!data.center || distanceM(viewCenter, data.center) > 2500);
  const selected = data.parks.find((p) => p.park_id === selectedId) || null;

  return (
    <APIProvider apiKey={MAPS_KEY}>
      <div className="map-page">
        <aside className="park-panel" aria-label="Parks list">
          <div className="section-head">
            <h2>
              {data.loading ? 'Finding parks…'
                : data.center ? `${data.parks.length} parks within 5 miles`
                : 'Move the map to a town, then search'}
            </h2>
          </div>
          {!data.loading && data.center && data.parks.length === 0 && (
            <p className="muted">No dog parks found here. Try searching a different area.</p>
          )}
          {data.parks.map((p) => {
            const on = p.park_id === selectedId;
            return (
              <div key={p.park_id} className="park-item">
                <button className="row-btn" aria-expanded={on} onClick={() => setSelectedId(on ? null : p.park_id)}>
                  <span className="col">
                    <span className={on ? 'strong bold' : 'strong'}>{p.name}</span>
                    <span className="muted small">{miles(p.distance_m)} · <CrowdLabel dogs={p.dogs_here} /></span>
                  </span>
                  <span className="strong nowrap">{p.dogs_here} dogs</span>
                </button>
                {on && (
                  <div className="park-detail">
                    {p.dogs_here > 0 && (
                      <p className="small">{p.small_dogs} small · {p.medium_dogs} medium · {p.large_dogs} large</p>
                    )}
                    {p.address && <p className="small muted">{p.address}</p>}
                    <div className="btn-row">
                      <CheckInButton park={p} data={data} />
                      <DirectionsLink park={p} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <div className="map-wrap">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={start}
            defaultZoom={data.center || data.coords ? 13 : 4}
            gestureHandling="greedy"
            clickableIcons={false}
            onCameraChanged={(e) => setViewCenter(e.detail.center)}
            style={{ width: '100%', height: '100%' }}
          >
            {data.parks.map((p) => (
              <AdvancedMarker
                key={p.park_id}
                position={{ lat: p.latitude, lng: p.longitude }}
                title={`${p.name}: ${p.dogs_here} dogs`}
                onClick={() => setSelectedId(p.park_id)}
                zIndex={p.park_id === selectedId ? 10 : 1}
              >
                <div className={p.park_id === selectedId ? 'pin pin-on' : 'pin'}>{p.dogs_here}</div>
              </AdvancedMarker>
            ))}
            {data.coords && (
              <AdvancedMarker position={data.coords} title="You are here">
                <div className="me-dot" />
              </AdvancedMarker>
            )}
          </GoogleMap>
          {moved && (
            <button className="btn search-area" onClick={() => data.searchArea(viewCenter)}>
              Search this area
            </button>
          )}
          <PanTo park={selected} />
        </div>
      </div>
    </APIProvider>
  );
}

function PanTo({ park }) {
  const map = useMap();
  useEffect(() => {
    if (map && park) map.panTo({ lat: park.latitude, lng: park.longitude });
  }, [map, park?.park_id]);
  return null;
}
