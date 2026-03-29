/**
 * openInMaps(address)
 *
 * Opens the given address in the native maps app:
 *   - iOS/macOS Safari  → maps://maps.apple.com/?q=ADDRESS
 *   - Android / other   → https://maps.google.com/?q=ADDRESS
 *
 * Falls back to Google Maps in a new tab on desktop browsers.
 */
export function openInMaps(address) {
  if (!address) return;
  const encoded = encodeURIComponent(address);

  // Detect iOS / macOS
  const isApple = /iPad|iPhone|iPod|Macintosh/i.test(navigator.userAgent) &&
    !window.MSStream;

  if (isApple) {
    // Try Apple Maps first; if the scheme is blocked, fall back to Google Maps web
    const appleUrl = `maps://maps.apple.com/?q=${encoded}`;
    const googleUrl = `https://maps.google.com/?q=${encoded}`;
    const start = Date.now();
    window.location.href = appleUrl;
    setTimeout(() => {
      // If we're still here after 500ms, Apple Maps didn't open — open Google Maps
      if (Date.now() - start < 1500) {
        window.open(googleUrl, '_blank', 'noopener');
      }
    }, 500);
  } else {
    // Android / desktop — open Google Maps in new tab
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank', 'noopener');
  }
}

/**
 * MapsButton — a small reusable button that opens an address in maps.
 * Usage: <MapsButton address="123 Main St, Moorhead MN" />
 */
export default function MapsButton({ address, label, style = {} }) {
  if (!address) return null;
  return (
    <button
      onClick={() => openInMaps(address)}
      title={`Open in Maps: ${address}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        background: '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: '.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      📍 {label || 'Navigate'}
    </button>
  );
}
