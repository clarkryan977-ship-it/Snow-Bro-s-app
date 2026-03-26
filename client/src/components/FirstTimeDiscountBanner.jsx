import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Displays the first-time customer discount banner if enabled.
 * Fetches from the public /api/settings/public endpoint (no auth required).
 * Pass compact={true} for a smaller inline version (e.g. inside booking form).
 */
export default function FirstTimeDiscountBanner({ compact = false }) {
  const [promo, setPromo] = useState(null);

  useEffect(() => {
    api.get('/settings/public')
      .then(({ data }) => {
        if (data.first_time_discount_enabled === '1') {
          setPromo(data);
        }
      })
      .catch(() => {}); // silently ignore errors
  }, []);

  if (!promo) return null;

  const type = promo.first_time_discount_type || 'fixed';
  const amount = promo.first_time_discount_amount || '10';
  const message = promo.first_time_discount_message || `Get ${type === 'fixed' ? '$' + amount : amount + '%'} off your first service!`;
  const code = promo.first_time_discount_code;
  const headline = type === 'fixed' ? `$${amount} Off Your First Service!` : `${amount}% Off Your First Service!`;

  if (compact) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e40af, #1e3a5f)',
        borderRadius: 'var(--radius)',
        padding: '.75rem 1rem',
        color: '#fff',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '.75rem',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '1.4rem' }}>🎉</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{headline}</div>
          <div style={{ fontSize: '.8rem', opacity: .85 }}>{message}</div>
        </div>
        {code && (
          <div style={{
            background: 'rgba(255,255,255,.18)',
            borderRadius: 6,
            padding: '.25rem .65rem',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '.85rem',
            letterSpacing: '.06em',
            whiteSpace: 'nowrap'
          }}>
            {code}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e40af, #1e3a5f)',
      borderRadius: 'var(--radius-lg, 12px)',
      padding: '1.5rem 2rem',
      color: '#fff',
      marginBottom: '1.5rem',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(30,58,175,.35)'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🎉</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '.4rem' }}>{headline}</div>
      <div style={{ fontSize: '1rem', opacity: .9, marginBottom: code ? '.75rem' : 0 }}>{message}</div>
      {code && (
        <div style={{ display: 'inline-block', marginTop: '.5rem' }}>
          <span style={{ fontSize: '.78rem', opacity: .75, display: 'block', marginBottom: '.2rem' }}>Use code at booking:</span>
          <span style={{
            background: 'rgba(255,255,255,.2)',
            borderRadius: 8,
            padding: '.4rem 1.2rem',
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '1.1rem',
            letterSpacing: '.12em',
            border: '1.5px dashed rgba(255,255,255,.5)'
          }}>
            {code}
          </span>
        </div>
      )}
    </div>
  );
}
