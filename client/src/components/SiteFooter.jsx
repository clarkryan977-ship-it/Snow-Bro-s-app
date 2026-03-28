import SocialLinks from './SocialLinks';

const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJTl55Hg2qT4cR3iZyb4-KV1Q';

/**
 * SiteFooter — consistent NAP (Name, Address, Phone) footer used on all public pages.
 * Includes Google Review CTA and social links.
 */
export default function SiteFooter() {
  return (
    <footer
      itemScope
      itemType="https://schema.org/LocalBusiness"
      style={{
        background: 'var(--navy)',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        padding: '2.5rem 1rem',
        fontSize: '.85rem'
      }}
    >
      <img
        src="/logo.jpg"
        alt="Snow Bro's — Lawn Care &amp; Snow Removal Moorhead MN"
        itemProp="image"
        style={{
          width: 64, height: 64,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'block',
          margin: '0 auto .75rem'
        }}
      />

      {/* NAP — Name, Address, Phone */}
      <div
        style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem', marginBottom: '.2rem' }}
        itemProp="name"
      >
        Snow Bro's
      </div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '.82rem', marginBottom: '.2rem' }}>
        Residential &amp; Commercial Lawn Care &amp; Snow Removal
      </div>
      <div style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '.15rem' }}>
        Serving <strong style={{ color: '#fff' }}>Moorhead, MN</strong> &amp; <strong style={{ color: '#fff' }}>Fargo, ND</strong>
      </div>
      <address
        itemProp="address"
        itemScope
        itemType="https://schema.org/PostalAddress"
        style={{ fontStyle: 'normal', color: 'rgba(255,255,255,0.7)', marginBottom: '.25rem' }}
      >
        <span itemProp="streetAddress">1812 33rd St S</span>,{' '}
        <span itemProp="addressLocality">Moorhead</span>,{' '}
        <span itemProp="addressRegion">MN</span>{' '}
        <span itemProp="postalCode">56560</span>
      </address>
      <div style={{ marginTop: '.25rem' }}>
        <a
          href="tel:2183315145"
          itemProp="telephone"
          style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontWeight: 600 }}
        >
          218-331-5145
        </a>
        {' · '}
        <a
          href="mailto:Clarkryan977@gmail.com"
          itemProp="email"
          style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}
        >
          Clarkryan977@gmail.com
        </a>
      </div>

      {/* Google Review CTA */}
      <div style={{ marginTop: '1.25rem' }}>
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.4rem',
            background: '#fbc02d',
            color: '#1a1a1a',
            padding: '.5rem 1.25rem',
            borderRadius: '2rem',
            fontWeight: 700,
            fontSize: '.88rem',
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          ⭐ Leave us a Google Review
        </a>
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
      <div style={{ marginTop: '.75rem', fontSize: '.78rem', opacity: .4 }}>
        © {new Date().getFullYear()} Snow Bro's. All rights reserved. Moorhead, MN &amp; Fargo, ND
      </div>
    </footer>
  );
}
