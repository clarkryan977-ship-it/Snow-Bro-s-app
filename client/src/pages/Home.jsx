import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SocialLinks from '../components/SocialLinks';

const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJTl55Hg2qT4cR3iZyb4-KV1Q';

const SERVICE_ICONS = {
  // Snow / Winter
  'Snow Removal': '❄️',
  'Parking Lot Snow Removal': '🚜',
  'Ice Management & De-Icing': '🧂',
  'Ice Management': '🧂',
  'Seasonal Service Contract': '🗓️',
  // Lawn / Grass
  'Grass Mowing': '🏡',
  'Lawn Mowing': '🏡',
  'Grass border trimming': '✂️',
  'Grass border trimming ': '✂️',
  'Dethatching': '🌾',
  'Aeration': '🌱',
  'Aeration & Dethatching': '🌱',
  'Sod instalation': '🌱',
  'Sod instalation ': '🌱',
  // Trees / Plants
  'Tree Trimming': '🌳',
  'Tree & Shrub Trimming': '🌳',
  'Tree planting': '🌲',
  'Tree planting ': '🌲',
  // Cleanup
  'Spring Cleanup': '🌸',
  'Fall Cleanup': '🍂',
  'Spring & Fall Cleanup': '🍂',
  'Landscaping/Cleanup': '🍂',
  'Leaf Removal': '🍁',
  'General Cleanup': '🧹',
  // Gutters / Exterior
  'Gutter Cleaning': '🍃',
  'Pressure Washing': '🚿',
  'Pressure Washing ': '🚿',
  // Commercial / HOA
  'Commercial Lawn Care': '🏢',
  'Commercial Property Maintenance': '🔧',
  'HOA Lawn & Snow Services': '🏘️',
  // Hauling / Junk
  'Junk Removal': '🚛',
  'Junk Removal / Construction Clean-Up': '🚛',
  'Hauling Conpost': '♻️',
  'Hauling Compost': '♻️',
  // Misc
  'Box building': '📦',
  'Box building ': '📦',
  // Estimates intentionally excluded from public homepage
  'Estimates': null,
  'Estimates ': null,
  'Misc': '🔧',
};

const DEFAULT_SERVICES = [
  { icon: '❄️', name: 'Snow Removal' },
  { icon: '🌿', name: 'Lawn Mowing' },
  { icon: '🌱', name: 'Aeration & Dethatching' },
  { icon: '🍂', name: 'Spring & Fall Cleanup', note: 'From $65' },
  { icon: '✂️', name: 'Tree & Shrub Trimming' },
  { icon: '🧂', name: 'Ice Management' },
  { icon: '🅿️', name: 'Parking Lot Plowing' },
  { icon: '🚛', name: 'Junk Removal' },
  { icon: '🍃', name: 'Gutter Cleaning' },
];

const WHY = [
  { icon: '⭐', title: 'Rated 4.9 on Google', desc: 'Hundreds of happy customers in Fargo-Moorhead.' },
  { icon: '🤝', title: 'Locally Owned', desc: 'Serving Moorhead MN & Fargo ND since 2022.' },
  { icon: '📅', title: 'Flexible Scheduling', desc: 'One-time, recurring, or seasonal contracts.' },
  { icon: '🏢', title: 'Residential & Commercial', desc: 'Homes, businesses, HOAs, and parking lots.' },
];

// ── Live Weather Widget ──────────────────────────────────────────────────────
function WeatherWidget() {
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/weather/current')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => { setWx(data); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  const card = (label, value, sub) => (
    <div style={{
      background: '#f0f7ff', borderRadius: 10, padding: '.75rem 1rem',
      textAlign: 'center', border: '1px solid #bfdbfe', minWidth: 90,
    }}>
      <div style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 600, marginBottom: '.2rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e3a5f', lineHeight: 1.1 }}>{value || '—'}</div>
      {sub && <div style={{ fontSize: '.7rem', color: '#94a3b8', marginTop: '.15rem' }}>{sub}</div>}
    </div>
  );

  if (loading) {
    return (
      <div style={{ background: '#f8fafc', borderRadius: 14, padding: '1.5rem', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '.9rem' }}>
        Loading current conditions…
      </div>
    );
  }

  if (error || !wx || !wx.latest) {
    return (
      <div style={{ background: '#f8fafc', borderRadius: 14, padding: '1.5rem', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
        Current conditions temporarily unavailable.{' '}
        <a href="https://forecast.weather.gov/data/obhistory/KFAR.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>View on NWS →</a>
      </div>
    );
  }

  const { latest, snowPrecip24h, totalPrecip24h, fetchedAt, stale } = wx;
  const obs = latest;

  // Format observation time
  const fetchTime = fetchedAt ? new Date(fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';

  // Determine if snow is currently falling
  const isSnowing = /snow/i.test(obs.weather || '');

  return (
    <div style={{
      background: isSnowing
        ? 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)'
        : 'linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%)',
      borderRadius: 14,
      padding: '1.25rem 1.25rem 1rem',
      border: isSnowing ? 'none' : '1px solid #bfdbfe',
      color: isSnowing ? '#fff' : '#1e3a5f',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '.9rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ fontSize: '2rem' }}>{obs.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                {obs.weather || 'N/A'}
              </div>
              <div style={{ fontSize: '.78rem', opacity: .7, marginTop: '.1rem' }}>
                Fargo Airport (KFAR) · {obs.time} CDT
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
            {obs.airTemp ? `${obs.airTemp}°F` : '—'}
          </div>
          {obs.windChill && obs.windChill !== obs.airTemp && (
            <div style={{ fontSize: '.75rem', opacity: .7 }}>Feels like {obs.windChill}°F</div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '.6rem', marginBottom: '.9rem' }}>
        {card('Wind', obs.wind || '—')}
        {card('Visibility', obs.vis ? `${obs.vis} mi` : '—')}
        {card('Humidity', obs.humidity || '—')}
        {card('Dew Point', obs.dwpt ? `${obs.dwpt}°F` : '—')}
        {card('Pressure', obs.altimeter ? `${obs.altimeter}"` : '—')}
        {snowPrecip24h
          ? card('24hr Snow', `${snowPrecip24h}"`, 'liquid equiv.')
          : totalPrecip24h
            ? card('24hr Precip', `${totalPrecip24h}"`)
            : card('Precip 1hr', obs.precip1hr ? `${obs.precip1hr}"` : 'None')}
      </div>

      {/* Sky conditions */}
      {obs.skyCond && (
        <div style={{ fontSize: '.78rem', opacity: .65, marginBottom: '.6rem' }}>
          Sky: {obs.skyCond}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.4rem' }}>
        <span style={{ fontSize: '.7rem', opacity: .55 }}>
          {stale ? '⚠️ Cached · ' : ''}Updated {fetchTime}
        </span>
        <a
          href="https://forecast.weather.gov/data/obhistory/KFAR.html"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '.72rem', color: isSnowing ? 'rgba(255,255,255,.8)' : '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
          Full Observations →
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetch('/api/services')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          // Filter out internal/admin-only services and inactive ones
          const HIDDEN_SERVICES = ['Estimates', 'Estimates ', 'Misc', 'Box building', 'Box building '];
          const mapped = data
            .filter(s => s.active !== 0 && !HIDDEN_SERVICES.includes(s.name))
            .map(s => ({
              ...s,
              icon: SERVICE_ICONS[s.name] || SERVICE_ICONS[s.name?.trim()] || '🛠️',
              note: s.starting_price && s.starting_price.trim() ? `Starting at ${s.starting_price.trim()}` : null
            }));
          setServices(mapped);
        } else {
          setServices(DEFAULT_SERVICES);
        }
      })
      .catch(() => setServices(DEFAULT_SERVICES));
  }, []);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
        color: '#fff', padding: '3rem 1rem 2.5rem', textAlign: 'center',
      }}>
        <img
          src="/logo.jpg"
          alt="Snow Bro's"
          style={{
            width: 'clamp(110px, 28vw, 180px)', height: 'clamp(110px, 28vw, 180px)',
            borderRadius: '50%', objectFit: 'cover',
            border: '4px solid rgba(255,255,255,.45)',
            boxShadow: '0 8px 32px rgba(0,0,0,.3)',
            display: 'block', margin: '0 auto 1.25rem',
          }}
        />
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 800, margin: '0 0 .4rem', color: '#fff' }}>
          Snow Bro's
        </h1>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, opacity: .95, margin: '0 auto .35rem', maxWidth: 520 }}>
          Professional Lawn Care &amp; Snow Removal
        </p>
        <p style={{ fontSize: '.9rem', opacity: .7, margin: '0 0 1.75rem' }}>
          Moorhead, MN &amp; Fargo, ND · Residential &amp; Commercial
        </p>

        {/* Primary CTAs */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <Link to="/book-request"
            style={{ background: '#fff', color: '#1e3a5f', padding: '.85rem 2rem', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.2)', whiteSpace: 'nowrap' }}>
            📨 Request a Service
          </Link>
          <Link to="/book"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', padding: '.85rem 2rem', borderRadius: 10, fontWeight: 700, fontSize: '1rem', textDecoration: 'none', border: '2px solid rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>
            📅 Book Online
          </Link>
        </div>
        <p style={{ fontSize: '.82rem', opacity: .55, margin: 0 }}>No account needed to request service</p>
      </div>

      {/* ── Google Review Banner ──────────────────────────────────── */}
      <div style={{ background: '#f9a825', padding: '.85rem 1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '.95rem' }}>
          ⭐⭐⭐⭐⭐ Rated 4.9 on Google — Happy with our service?
        </span>
        <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
          style={{ background: '#1a1a1a', color: '#fff', padding: '.45rem 1.1rem', borderRadius: '2rem', fontWeight: 700, fontSize: '.88rem', textDecoration: 'none' }}>
          Leave a Review
        </a>
      </div>

      {/* ── Services grid ────────────────────────────────────────── */}
      <div className="container" style={{ padding: '2.5rem 1rem 1.5rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.35rem', fontWeight: 700, marginBottom: '.4rem' }}>What We Do</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.75rem', fontSize: '.9rem' }}>
          Residential &amp; commercial services, every season
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {services.map(s => (
            <div key={s.id || s.name} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>{s.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#1e3a5f' }}>{s.name}</div>
              {s.note && <div style={{ fontSize: '.75rem', color: '#16a34a', fontWeight: 600, marginTop: '.2rem' }}>{s.note}</div>}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <Link to="/book-request"
            style={{ display: 'inline-block', background: '#1e3a5f', color: '#fff', padding: '.8rem 2rem', borderRadius: 10, fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
            📨 Request a One-Time Service
          </Link>
        </div>
      </div>

      {/* ── Live Weather + NWS Widgets ───────────────────────────── */}
      <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '1.5rem 1rem' }}>
        <div className="container" style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: '#1e3a5f', marginBottom: '1.25rem' }}>
            ❄️ Local Weather — Fargo-Moorhead Area
          </h2>

          {/* Live KFAR Current Conditions widget (full width) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.6rem' }}>
              <span style={{ fontWeight: 700, fontSize: '.95rem', color: '#1e3a5f' }}>🌡️ Current Conditions — Fargo Airport (KFAR)</span>
              <a
                href="https://forecast.weather.gov/data/obhistory/KFAR.html"
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
                All Observations →
              </a>
            </div>
            <WeatherWidget />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

            {/* 7-day NWS Forecast */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '.95rem', color: '#1e3a5f' }}>🌨️ 7-Day Forecast</span>
                <a
                  href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678"
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
                  Full NWS Forecast →
                </a>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <a
                  href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678"
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', lineHeight: 0 }}>
                  <img
                    src="https://forecast.weather.gov/meteograms/Plotter.php?lat=46.8738&lon=-96.7678&wfo=FGF&zimage=0&plottype=meteogram&ifDaily=0&numDays=7&FC=0&menu=1&FcstType=digital"
                    alt="NWS 7-day forecast for Moorhead MN"
                    style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover', objectPosition: 'top' }}
                    onError={e => { e.target.style.display='none'; e.target.parentElement.style.lineHeight = 'normal'; e.target.parentElement.parentElement.innerHTML='<div style="padding:2.5rem 1rem;text-align:center;color:#64748b;font-size:.85rem;line-height:1.5">Forecast temporarily unavailable<br/><a href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678" target="_blank" style="color:#1d4ed8;font-weight:600">view on NWS</a></div>'; }}
                  />
                </a>
              </div>
            </div>

            {/* 24-Hour Snow Accumulation */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '.95rem', color: '#1e3a5f' }}>📊 24-Hr Snow Accumulation</span>
                <a
                  href="https://www.nohrsc.noaa.gov/snowfall/?region=us&var=sfav&range=24&unit=0&isll=46.8738&islo=-96.7678"
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
                  NOHRSC Map →
                </a>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <a
                  href="https://www.nohrsc.noaa.gov/snowfall/?region=us&var=sfav&range=24&unit=0&isll=46.8738&islo=-96.7678"
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', lineHeight: 0 }}>
                  <img
                    src={`https://www.nohrsc.noaa.gov/snowfall_v2/data/${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}/sfav_conus_24h_${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}.jpg`}
                    alt="24-hour snow accumulation map for Fargo-Moorhead area"
                    style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover', objectPosition: 'center' }}
                    onError={e => {
                      const today = new Date();
                      const y = today.getFullYear();
                      const m = String(today.getMonth()+1).padStart(2,'0');
                      const d = String(today.getDate()-1).padStart(2,'0');
                      const fallback = `https://www.nohrsc.noaa.gov/snowfall_v2/data/${y}${m}/sfav_conus_24h_${y}${m}${d}.jpg`;
                      if (e.target.src !== fallback) {
                        e.target.src = fallback;
                      } else {
                        e.target.style.display='none';
                        e.target.parentElement.style.lineHeight = 'normal';
                        e.target.parentElement.parentElement.innerHTML='<div style="padding:2.5rem 1rem;text-align:center;color:#64748b;font-size:.85rem;line-height:1.5">Accumulation map temporarily unavailable<br/><a href="https://www.nohrsc.noaa.gov/snowfall/?region=us&var=sfav&range=24&unit=0" target="_blank" style="color:#1d4ed8;font-weight:600">view on NOHRSC</a></div>';
                      }
                    }}
                  />
                </a>
              </div>
            </div>

          </div>
          <div style={{ marginTop: '.75rem', textAlign: 'center' }}>
            <a
              href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '.78rem', color: '#94a3b8', textDecoration: 'none' }}>
              Source: National Weather Service (KFAR) · NOHRSC · NWS Grand Forks, ND
            </a>
          </div>
        </div>
      </div>

      {/* ── Why Choose Us ────────────────────────────────────────── */}
      <div style={{ background: '#f0f7ff', borderTop: '1px solid #bfdbfe', borderBottom: '1px solid #bfdbfe', padding: '2.5rem 1rem' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>Why Snow Bro's?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
            {WHY.map(w => (
              <div key={w.title} style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>{w.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.3rem', color: '#1e3a5f' }}>{w.title}</div>
                <div style={{ fontSize: '.83rem', color: '#64748b', lineHeight: 1.5 }}>{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick links ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', padding: '2.5rem 1rem' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '.5rem' }}>📨</div>
            <div style={{ fontWeight: 700, marginBottom: '.4rem' }}>Request Service</div>
            <div style={{ fontSize: '.83rem', color: '#64748b', marginBottom: '1rem' }}>No account needed</div>
            <Link to="/book-request" style={{ background: '#1e3a5f', color: '#fff', padding: '.6rem 1.25rem', borderRadius: 8, fontWeight: 700, fontSize: '.88rem', textDecoration: 'none', display: 'inline-block' }}>Get Started</Link>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '.5rem' }}>🔑</div>
            <div style={{ fontWeight: 700, marginBottom: '.4rem' }}>Client Portal</div>
            <div style={{ fontSize: '.83rem', color: '#64748b', marginBottom: '1rem' }}>View your account</div>
            <Link to="/login" style={{ background: '#1e3a5f', color: '#fff', padding: '.6rem 1.25rem', borderRadius: 8, fontWeight: 700, fontSize: '.88rem', textDecoration: 'none', display: 'inline-block' }}>Sign In</Link>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '.5rem' }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: '.4rem' }}>Get an Estimate</div>
            <div style={{ fontSize: '.83rem', color: '#64748b', marginBottom: '1rem' }}>Free, no obligation</div>
            <Link to="/book-request" style={{ background: '#1e3a5f', color: '#fff', padding: '.6rem 1.25rem', borderRadius: 8, fontWeight: 700, fontSize: '.88rem', textDecoration: 'none', display: 'inline-block' }}>Request Now</Link>
          </div>
        </div>
      </div>

      {/* ── Social + Footer ──────────────────────────────────────── */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '2rem 1rem', textAlign: 'center' }}>
        <SocialLinks />
        <p style={{ fontSize: '.8rem', opacity: .5, marginTop: '1rem', marginBottom: 0 }}>
          © {new Date().getFullYear()} Snow Bro's · Moorhead, MN &amp; Fargo, ND
        </p>
      </div>
    </div>
  );
}
