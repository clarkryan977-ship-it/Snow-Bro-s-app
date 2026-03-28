import { Link } from 'react-router-dom';
import SocialLinks from '../components/SocialLinks';
import FirstTimeDiscountBanner from '../components/FirstTimeDiscountBanner';

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--blue-700) 100%)',
        color: '#fff', padding: '3.5rem 1rem 3rem', textAlign: 'center'
      }}>
        <img
          src="/logo.jpg"
          alt="Snow Bro's Logo"
          style={{
            width: 'clamp(140px, 35vw, 220px)',
            height: 'clamp(140px, 35vw, 220px)',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '4px solid rgba(255,255,255,0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            marginBottom: '1.25rem',
            display: 'block',
            margin: '0 auto 1.25rem'
          }}
        />
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 800, marginBottom: '.5rem', color: '#fff' }}>
          Snow Bro's
        </h1>
        <p style={{ fontSize: '.9rem', opacity: .75, marginBottom: '.25rem' }}>
          1812 33rd St S, Moorhead, MN 56560
        </p>
        <p style={{ fontSize: '1.1rem', opacity: .95, maxWidth: '580px', margin: '.75rem auto .5rem', fontWeight: 600 }}>
          Professional Lawn Care &amp; Snow Removal
        </p>
        <p style={{ fontSize: '1rem', opacity: .85, maxWidth: '560px', margin: '0 auto 2rem' }}>
          Serving residential homeowners and commercial properties — mowing, snow removal, aeration, property maintenance, and more.
        </p>
        {/* Residential / Commercial badges */}
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
          <span style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '2rem', padding: '.35rem 1rem', fontSize: '.88rem', fontWeight: 600 }}>
            🏠 Residential
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '2rem', padding: '.35rem 1rem', fontSize: '.88rem', fontWeight: 600 }}>
            🏢 Commercial
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '2rem', padding: '.35rem 1rem', fontSize: '.88rem', fontWeight: 600 }}>
            🏘️ HOA &amp; Multi-Family
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/book" className="btn btn-lg" style={{ background: '#fff', color: 'var(--navy)', fontWeight: 700 }}>
            📅 Book a Service
          </Link>
          <a href="https://cash.app/$snowbros218" target="_blank" rel="noopener noreferrer" className="btn btn-lg btn-cashapp" style={{ textDecoration: 'none' }}>
            💲 Pay with Cash App
          </a>
          <Link to="/register" className="btn btn-lg btn-outline" style={{ borderColor: 'rgba(255,255,255,.6)', color: '#fff' }}>
            Create Account
          </Link>
        </div>
      </div>

      {/* First-time discount promo */}
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: 0 }}>
        <FirstTimeDiscountBanner />
      </div>

      {/* Residential Services */}
      <div className="container" style={{ padding: '3rem 1rem 1.5rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, marginBottom: '.5rem' }}>🏠 Residential Services</h2>
        <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '2rem' }}>Quality lawn care for your home, every season</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          {[
            { icon: '🌿', name: 'Grass Mowing' },
            { icon: '✂️', name: 'Tree Trimming' },
            { icon: '🌱', name: 'Dethatching' },
            { icon: '💨', name: 'Aeration' },
            { icon: '❄️', name: 'Snow Removal' },
            { icon: '🍂', name: 'Gutter Cleaning' },
          ].map(s => (
            <div key={s.name} className="card" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>{s.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{s.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Commercial Services */}
      <div style={{ background: 'var(--navy)', padding: '3rem 1rem' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, marginBottom: '.5rem', color: '#fff' }}>🏢 Commercial Services</h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
            Reliable, professional property maintenance for businesses, HOAs, and commercial properties
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {[
              { icon: '🅿️', name: 'Parking Lot Snow Removal', desc: 'Keep lots clear and safe all winter with scheduled plowing and salting.' },
              { icon: '🏢', name: 'Commercial Lawn Care', desc: 'Regular mowing, edging, and trimming contracts for offices and retail properties.' },
              { icon: '🏘️', name: 'HOA Services', desc: 'Full-season lawn and snow maintenance for homeowners associations and communities.' },
              { icon: '🌳', name: 'Property Maintenance', desc: 'Comprehensive grounds keeping — mulching, bed maintenance, and seasonal clean-ups.' },
              { icon: '🧂', name: 'Ice Management', desc: 'De-icing and salting services for walkways, entrances, and parking areas.' },
              { icon: '📋', name: 'Service Contracts', desc: 'Flexible seasonal and annual contracts tailored to your commercial property needs.' },
            ].map(s => (
              <div key={s.name} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                padding: '1.5rem',
                color: '#fff'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '.6rem' }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '.4rem' }}>{s.name}</div>
                <div style={{ fontSize: '.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Link to="/book" className="btn btn-lg" style={{ background: '#fff', color: 'var(--navy)', fontWeight: 700 }}>
              📋 Request a Commercial Quote
            </Link>
          </div>
        </div>
      </div>

      {/* Why Choose Us */}
      <div style={{ background: 'var(--blue-50)', borderTop: '1px solid var(--blue-100)', padding: '3rem 1rem' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 700, marginBottom: '.5rem' }}>Why Choose Snow Bro's?</h2>
          <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '2rem' }}>
            Serving the Fargo-Moorhead area with pride
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {[
              { icon: '✅', title: 'Residential & Commercial', desc: 'From single-family homes to large commercial properties — we do it all.' },
              { icon: '📅', title: 'Flexible Scheduling', desc: 'One-time, recurring, or seasonal contracts to fit your needs.' },
              { icon: '🤝', title: 'Locally Owned', desc: 'Proudly serving Moorhead, Fargo, and surrounding communities.' },
              { icon: '⭐', title: 'Trusted & Reviewed', desc: 'Hundreds of satisfied residential and commercial clients.' },
            ].map(item => (
              <div key={item.title} className="card" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>{item.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: '.4rem' }}>{item.title}</div>
                <div style={{ fontSize: '.85rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA row */}
      <div style={{ background: '#fff', borderTop: '1px solid var(--blue-100)', padding: '2.5rem 1rem' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📅</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Book Online</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Schedule residential or commercial service in minutes.</p>
            <Link to="/book" className="btn btn-primary btn-block">Book Now</Link>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>💳</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Pay Online</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Pay via Cash App, Venmo, or Zelle — fast and easy.</p>
            <Link to="/pay" className="btn btn-primary btn-block">Pay Now</Link>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📸</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Our Work</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>See photos of completed jobs.</p>
            <Link to="/gallery" className="btn btn-primary btn-block">View Gallery</Link>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>⭐</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Reviews</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>See what our customers say.</p>
            <Link to="/reviews" className="btn btn-primary btn-block">Read Reviews</Link>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>👤</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Client Portal</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>View contracts, invoices, and more.</p>
            <Link to="/login" className="btn btn-primary btn-block">Sign In</Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: 'var(--navy)', color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '2.5rem 1rem', fontSize: '.85rem' }}>
        <img src="/logo.jpg" alt="Snow Bro's" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: '.75rem', border: '2px solid rgba(255,255,255,0.3)', display: 'block', margin: '0 auto .75rem' }} />
        <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem', marginBottom: '.25rem' }}>Snow Bro's</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '.82rem', marginBottom: '.25rem' }}>Residential &amp; Commercial Lawn Care &amp; Snow Removal</div>
        <div>1812 33rd St S, Moorhead, MN 56560</div>
        <div style={{ marginTop: '.25rem' }}>
          <a href="tel:2183315145" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>218-331-5145</a>
          {' · '}
          <a href="mailto:Clarkryan977@gmail.com" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Clarkryan977@gmail.com</a>
        </div>
        {/* Social links */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem', marginBottom: '.5rem' }}>
          <SocialLinks dark={true} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '.5rem', fontSize: '.8rem', flexWrap: 'wrap' }}>
          <a href="https://www.facebook.com/share/1HNXScvP62/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Facebook</a>
          <a href="https://nextdoor.com/page/snow-bros-snow-removal-moorhead-mn?utm_campaign=1774487768034&share_action_id=83d220bf-e515-44f1-a37e-e7b8dac41a4b" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Nextdoor</a>
          <a href="https://prosnowbros.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>prosnowbros.com</a>
        </div>
        <div style={{ marginTop: '.75rem', fontSize: '.78rem', opacity: .4 }}>© {new Date().getFullYear()} Snow Bro's. All rights reserved.</div>
      </footer>
    </div>
  );
}
