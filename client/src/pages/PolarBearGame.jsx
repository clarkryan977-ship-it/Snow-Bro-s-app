import { useState } from 'react';
import SiteFooter from '../components/SiteFooter';

export default function PolarBearGame() {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#061426', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      {!fullscreen && (
        <div style={{
          background: 'linear-gradient(135deg, #0d2a52 0%, #071a33 100%)',
          borderBottom: '1px solid rgba(100,180,255,0.15)',
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{ color: '#eaf6ff', fontSize: 'clamp(1.1rem,4vw,1.6rem)', fontWeight: 900, margin: 0, letterSpacing: 1 }}>
              ❄️ Polar Bear Snow Catch
            </h1>
            <p style={{ color: 'rgba(180,220,255,0.75)', fontSize: '.8rem', margin: '4px 0 0', lineHeight: 1.4 }}>
              Catch snowflakes, dodge icicles — brought to you by Snow Bro's!
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '6px 12px', fontSize: '.75rem', color: 'rgba(180,220,255,0.8)',
              lineHeight: 1.5,
            }}>
              📱 Tap left/right to move &nbsp;|&nbsp; ⌨️ Arrow keys or A/D &nbsp;|&nbsp; P to pause
            </div>
            <button
              onClick={() => setFullscreen(true)}
              style={{
                background: 'linear-gradient(180deg,#c9ecff,#7bc8ff)', color: '#06233d',
                border: 'none', borderRadius: 999, padding: '8px 18px',
                fontWeight: 800, fontSize: '.85rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              ⛶ Full Screen
            </button>
          </div>
        </div>
      )}

      {/* Game iframe */}
      <div style={{
        flex: fullscreen ? 'none' : 1,
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : 'auto',
        zIndex: fullscreen ? 9999 : 'auto',
        width: '100%',
        height: fullscreen ? '100dvh' : 'clamp(400px, calc(100vw * 1.2), 700px)',
        background: '#061426',
      }}>
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10000,
              background: 'rgba(0,0,0,0.55)', color: '#eaf6ff', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
            }}
          >
            ✕ Exit
          </button>
        )}
        <iframe
          src="/polar-bear-game.html"
          title="Polar Bear Snow Catch"
          style={{
            width: '100%', height: '100%', border: 'none', display: 'block',
          }}
          allow="autoplay"
          scrolling="no"
        />
      </div>

      {/* Footer — only shown when not fullscreen */}
      {!fullscreen && (
        <div style={{ marginTop: 'auto' }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(100,180,255,0.1)',
            padding: '20px', textAlign: 'center',
          }}>
            <p style={{ color: 'rgba(180,220,255,0.6)', fontSize: '.8rem', margin: 0 }}>
              🐻‍❄️ A fun little game from the Snow Bro's team — we hope it keeps you entertained while the snow falls!
            </p>
            <p style={{ color: 'rgba(180,220,255,0.4)', fontSize: '.72rem', margin: '6px 0 0' }}>
              Need snow removal? <a href="/book-request" style={{ color: '#7bc8ff' }}>Book a service →</a>
            </p>
          </div>
          <SiteFooter />
        </div>
      )}
    </div>
  );
}
