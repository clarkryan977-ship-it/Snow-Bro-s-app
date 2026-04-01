import { Link } from 'react-router-dom';
import SocialLinks from '../components/SocialLinks';

const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJTl55Hg2qT4cR3iZyb4-KV1Q';

const SERVICES = [
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

export default function Home() {
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
          {SERVICES.map(s => (
            <div key={s.name} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem 1rem', textAlign: 'center' }}>
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

      {/* ── NWS Weather Widget ─────────────────────────────────── */}
      <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '1.5rem 1rem' }}>
        <div className="container" style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem', marginBottom: '.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🌨️</span>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e3a5f' }}>Moorhead, MN Forecast</span>
              <span style={{ fontSize: '.78rem', color: '#64748b' }}>· 56560</span>
            </div>
            <a
              href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
              Full NWS Forecast →
            </a>
          </div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', lineHeight: 0 }}>
            <a
              href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678"
              target="_blank" rel="noopener noreferrer">
              <img
                src="https://forecast.weather.gov/meteograms/Plotter.php?lat=46.8738&lon=-96.7678&wfo=FGF&zimage=0&plottype=meteogram&ifDaily=0&numDays=7&FC=0&menu=1&FcstType=digital"
                alt="NWS 7-day forecast for Moorhead MN"
                style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover', objectPosition: 'top' }}
                onError={e => { e.target.style.display='none'; e.target.parentElement.parentElement.innerHTML='<div style="padding:1rem;text-align:center;color:#64748b;font-size:.85rem">Forecast temporarily unavailable — <a href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678" target="_blank" style="color:#1d4ed8">view on NWS</a></div>'; }}
              />
            </a>
          </div>
          <div style={{ marginTop: '.6rem', textAlign: 'center' }}>
            <a
              href="https://forecast.weather.gov/MapClick.php?CityName=Moorhead&state=MN&site=FGF&textField1=46.8738&textField2=-96.7678"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '.8rem', color: '#64748b', textDecoration: 'none' }}>
              Source: National Weather Service · Forecast Office Grand Forks, ND
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
            <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>💳</div>
            <div style={{ fontWeight: 700, marginBottom: '.3rem' }}>Pay Online</div>
            <div style={{ fontSize: '.83rem', color: '#64748b', marginBottom: '1rem' }}>Cash App, Venmo, or Zelle</div>
            <Link to="/pay" style={{ display: 'block', background: '#1e3a5f', color: '#fff', padding: '.6rem 0', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: '.9rem' }}>Pay Now</Link>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>📸</div>
            <div style={{ fontWeight: 700, marginBottom: '.3rem' }}>Our Work</div>
            <div style={{ fontSize: '.83rem', color: '#64748b', marginBottom: '1rem' }}>Before &amp; after photos</div>
            <Link to="/gallery" style={{ display: 'block', background: '#1e3a5f', color: '#fff', padding: '.6rem 0', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: '.9rem' }}>View Gallery</Link>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>👤</div>
            <div style={{ fontWeight: 700, marginBottom: '.3rem' }}>Client Portal</div>
            <div style={{ fontSize: '.83rem', color: '#64748b', marginBottom: '1rem' }}>Contracts, invoices &amp; ETA</div>
            <Link to="/client-login" style={{ display: 'block', background: '#1e3a5f', color: '#fff', padding: '.6rem 0', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: '.9rem' }}>Sign In</Link>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{ background: '#1e3a5f', color: 'rgba(255,255,255,.7)', textAlign: 'center', padding: '2rem 1rem', fontSize: '.85rem' }}>
        <img src="/logo.jpg" alt="Snow Bro's" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto .75rem', border: '2px solid rgba(255,255,255,.3)' }} />
        <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: '.2rem' }}>Snow Bro's</div>
        <div style={{ marginBottom: '.2rem' }}>1812 33rd St S, Moorhead, MN 56560</div>
        <div>
          <a href="tel:2183315145" style={{ color: 'rgba(255,255,255,.8)', textDecoration: 'none' }}>218-331-5145</a>
          {' · '}
          <a href="mailto:Clarkryan977@gmail.com" style={{ color: 'rgba(255,255,255,.8)', textDecoration: 'none' }}>Clarkryan977@gmail.com</a>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', background: '#fbc02d', color: '#1a1a1a', padding: '.45rem 1.1rem', borderRadius: '2rem', fontWeight: 700, fontSize: '.85rem', textDecoration: 'none' }}>
            ⭐ Leave a Google Review
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <SocialLinks dark={true} />
        </div>
        <div style={{ marginTop: '.75rem', fontSize: '.75rem', opacity: .4 }}>
          © {new Date().getFullYear()} Snow Bro's · Moorhead, MN &amp; Fargo, ND
        </div>
      </footer>
    </div>
  );
}
