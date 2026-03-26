/**
 * SocialLinks — reusable social media / contact links bar.
 * Used in the homepage footer and the Navbar.
 */

const LINKS = [
  {
    label: 'Facebook',
    url: 'https://www.facebook.com/share/1HNXScvP62/',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
    color: '#1877F2',
  },
  {
    label: 'Nextdoor',
    url: 'https://nextdoor.com/page/snow-bros-snow-removal-moorhead-mn?utm_campaign=1774487768034&share_action_id=83d220bf-e515-44f1-a37e-e7b8dac41a4b',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.236L20 8.5v7L12 19.764 4 15.5v-7L12 4.236zM12 6a1 1 0 00-.707.293l-5 5A1 1 0 007 13h2v4h6v-4h2a1 1 0 00.707-1.707l-5-5A1 1 0 0012 6z"/>
      </svg>
    ),
    color: '#00B246',
  },
  {
    label: 'Website',
    url: 'https://prosnowbros.com/',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    color: '#2563eb',
  },
];

export default function SocialLinks({ dark = false, size = 'md' }) {
  const btnSize = size === 'sm' ? 36 : 44;
  const iconScale = size === 'sm' ? '.85' : '1';

  return (
    <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {LINKS.map(link => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          aria-label={link.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: btnSize,
            height: btnSize,
            borderRadius: '50%',
            background: dark ? 'rgba(255,255,255,0.12)' : link.color + '18',
            color: dark ? '#fff' : link.color,
            border: dark ? '1.5px solid rgba(255,255,255,0.2)' : `1.5px solid ${link.color}40`,
            transition: 'all .18s',
            textDecoration: 'none',
            transform: `scale(${iconScale})`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = link.color;
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = `scale(${parseFloat(iconScale) * 1.12})`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.12)' : link.color + '18';
            e.currentTarget.style.color = dark ? '#fff' : link.color;
            e.currentTarget.style.transform = `scale(${iconScale})`;
          }}
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}
