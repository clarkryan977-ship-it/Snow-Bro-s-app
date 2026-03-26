/**
 * BusinessHeader — reusable header for all documents (invoices, estimates, contracts, emails).
 * Shows the Snow Bro's logo + full business contact info + social links.
 */
export default function BusinessHeader({ style = {}, compact = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1.25rem',
      padding: compact ? '.9rem 1.25rem' : '1.25rem 1.5rem',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      borderRadius: 'var(--radius) var(--radius) 0 0',
      color: '#fff',
      ...style
    }}>
      <img
        src="/logo.jpg"
        alt="Snow Bro's Logo"
        style={{
          width: compact ? 54 : 72,
          height: compact ? 54 : 72,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.4)',
          flexShrink: 0
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: compact ? '1.15rem' : '1.4rem', fontWeight: 800, letterSpacing: '.01em', lineHeight: 1.1 }}>
          Snow Bro's
        </div>
        <div style={{ fontSize: '.8rem', opacity: .85, marginTop: '.3rem', lineHeight: 1.7 }}>
          1812 33rd St S, Moorhead, MN 56560<br />
          <a href="tel:2183315145" style={{ color: 'rgba(255,255,255,0.9)', textDecoration: 'none' }}>218-331-5145</a>
          {' · '}
          <a href="mailto:Clarkryan977@gmail.com" style={{ color: 'rgba(255,255,255,0.9)', textDecoration: 'none' }}>Clarkryan977@gmail.com</a>
        </div>
      </div>
      {/* Social icons */}
      <div style={{ display: 'flex', gap: '.45rem', flexShrink: 0 }}>
        <a href="https://www.facebook.com/share/1HNXScvP62/" target="_blank" rel="noopener noreferrer" title="Facebook"
          style={{ color: 'rgba(255,255,255,0.8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', textDecoration: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
        </a>
        <a href="https://nextdoor.com/page/snow-bros-snow-removal-moorhead-mn?utm_campaign=1774487768034&share_action_id=83d220bf-e515-44f1-a37e-e7b8dac41a4b" target="_blank" rel="noopener noreferrer" title="Nextdoor"
          style={{ color: 'rgba(255,255,255,0.8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', textDecoration: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.236L20 8.5v7L12 19.764 4 15.5v-7L12 4.236zM12 6a1 1 0 00-.707.293l-5 5A1 1 0 007 13h2v4h6v-4h2a1 1 0 00.707-1.707l-5-5A1 1 0 0012 6z"/>
          </svg>
        </a>
        <a href="https://prosnowbros.com/" target="_blank" rel="noopener noreferrer" title="Website"
          style={{ color: 'rgba(255,255,255,0.8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', textDecoration: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
