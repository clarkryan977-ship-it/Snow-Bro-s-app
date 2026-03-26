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
        <p style={{ fontSize: '1.05rem', opacity: .9, maxWidth: '520px', margin: '.75rem auto 2rem' }}>
          Professional residential lawn care services — mowing, trimming, aeration, snow removal, and more.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/book" className="btn btn-lg" style={{ background: '#fff', color: 'var(--navy)', fontWeight: 700 }}>
            📅 Book a Service
          </Link>
          <Link to="/register" className="btn btn-lg btn-outline" style={{ borderColor: 'rgba(255,255,255,.6)', color: '#fff' }}>
            Create Account
          </Link>
        </div>
      </div>

      {/* First-time discount promo */}
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: 0 }}>
        <FirstTimeDiscountBanner />
      </div>

      {/* Services preview */}
      <div className="container" style={{ padding: '3rem 1rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, marginBottom: '.5rem' }}>Our Services</h2>
        <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '2rem' }}>Quality lawn care for every season</p>
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

      {/* CTA row */}
      <div style={{ background: 'var(--blue-50)', borderTop: '1px solid var(--blue-100)', padding: '2.5rem 1rem' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📅</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Book Online</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Schedule a service in minutes.</p>
            <Link to="/book" className="btn btn-primary btn-block">Book Now</Link>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>💳</div>
            <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Pay Online</h3>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Pay via Venmo or Zelle — fast and easy.</p>
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
