function openVenmo(e) {
  e.preventDefault();
  const deepLink = 'venmo://paycharge?txn=pay&recipients=snowbros&note=Invoice%20Payment';
  const webFallback = 'https://www.paypal.com/qrcodes/venmocs/90262e17-2bae-475f-b440-57449f5eaf05?created=1774482943';

  let appOpened = false;
  const timer = setTimeout(() => {
    if (!appOpened && !document.hidden) {
      window.open(webFallback, '_blank');
    }
  }, 1200);

  const onVisibilityChange = () => {
    if (document.hidden) {
      appOpened = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.location.href = deepLink;
}

function openCashApp(e) {
  e.preventDefault();
  const deepLink = 'cashme://cash.app/$snowbros218';
  const webFallback = 'https://cash.app/$snowbros218';

  let appOpened = false;
  const timer = setTimeout(() => {
    if (!appOpened && !document.hidden) {
      window.open(webFallback, '_blank');
    }
  }, 1200);

  const onVisibilityChange = () => {
    if (document.hidden) {
      appOpened = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.location.href = deepLink;
}

export default function PaymentSection({ invoiceTotal, invoiceNumber }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="flex-between mb-2">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
          💳 Pay Your Invoice
        </h2>
        {invoiceTotal && (
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--blue-700)' }}>
            ${Number(invoiceTotal).toFixed(2)}
          </span>
        )}
      </div>

      {invoiceNumber && (
        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
          Invoice <strong>{invoiceNumber}</strong> — please include your invoice number in the payment memo.
        </p>
      )}

      <div className="payment-grid">
        {/* ── Cash App ── */}
        <div className="payment-card" style={{ borderColor: '#00D632' }}>
          <h3 style={{ color: '#00D632' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#00D632" style={{ flexShrink: 0 }}>
              <path d="M23.59 3.47A5.1 5.1 0 0020.55.42C19.54.14 18.04 0 16.03 0h-8.06C7.17 0 6.53.14 5.5.42A5.1 5.1 0 002.47 3.47C.14 5.54 0 7.17 0 7.97v8.06c0 .8.14 2.43 2.47 4.5a5.1 5.1 0 003.03 3.05c1.01.28 2.51.42 4.53.42h8.06c2.01 0 3.51-.14 4.52-.42a5.1 5.1 0 003.04-3.05C23.86 18.46 24 16.83 24 16.03V7.97c0-.8-.14-2.43-2.41-4.5zM17.2 7.63a.96.96 0 01-.04.14l-1.6 5.12c-.08.24-.24.4-.48.48a.87.87 0 01-.68-.04.78.78 0 01-.4-.52l-.56-2.16a.8.8 0 00-.56-.56l-2.16-.56a.78.78 0 01-.52-.4.87.87 0 01-.04-.68c.08-.24.24-.4.48-.48l5.12-1.6a.96.96 0 01.14-.04c.16 0 .32.08.44.2s.2.28.2.44c0 .04 0 .08-.04.14z"/>
            </svg>
            Pay with Cash App
          </h3>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
            Tap the button below — opens Cash App directly on your phone, or the Cash App website.
          </p>
          <a
            href="https://cash.app/$snowbros218"
            onClick={openCashApp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-cashapp btn-block"
            style={{ borderRadius: 'var(--radius)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M23.59 3.47A5.1 5.1 0 0020.55.42C19.54.14 18.04 0 16.03 0h-8.06C7.17 0 6.53.14 5.5.42A5.1 5.1 0 002.47 3.47C.14 5.54 0 7.17 0 7.97v8.06c0 .8.14 2.43 2.47 4.5a5.1 5.1 0 003.03 3.05c1.01.28 2.51.42 4.53.42h8.06c2.01 0 3.51-.14 4.52-.42a5.1 5.1 0 003.04-3.05C23.86 18.46 24 16.83 24 16.03V7.97c0-.8-.14-2.43-2.41-4.5zM17.2 7.63a.96.96 0 01-.04.14l-1.6 5.12c-.08.24-.24.4-.48.48a.87.87 0 01-.68-.04.78.78 0 01-.4-.52l-.56-2.16a.8.8 0 00-.56-.56l-2.16-.56a.78.78 0 01-.52-.4.87.87 0 01-.04-.68c.08-.24.24-.4.48-.48l5.12-1.6a.96.96 0 01.14-.04c.16 0 .32.08.44.2s.2.28.2.44c0 .04 0 .08-.04.14z"/>
            </svg>
            Pay with Cash App — $snowbros218
          </a>
        </div>

        {/* ── Venmo ── */}
        <div className="payment-card">
          <h3 style={{ color: '#008CFF' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#008CFF" style={{ flexShrink: 0 }}>
              <path d="M19.5 2C20.88 2 22 3.12 22 4.5v15c0 1.38-1.12 2.5-2.5 2.5h-15C3.12 22 2 20.88 2 19.5v-15C2 3.12 3.12 2 4.5 2h15zm-3.06 4.5c-.28.46-.4.94-.4 1.54 0 1.22.78 2.88 1.44 3.84l-3.3 8.12h-3.44l-1.34-7.02c-.38.28-.78.52-1.2.72l-.42-1.96c1.3-.7 2.6-1.88 3.46-3.26h-3.6V6.5h8.8z"/>
            </svg>
            Pay with Venmo
          </h3>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
            Tap the button below — opens the Venmo app directly, or the Venmo website if the app isn't installed.
          </p>
          <a
            href="https://www.paypal.com/qrcodes/venmocs/90262e17-2bae-475f-b440-57449f5eaf05?created=1774482943"
            onClick={openVenmo}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-venmo btn-block"
            style={{ borderRadius: 'var(--radius)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M19.5 2C20.88 2 22 3.12 22 4.5v15c0 1.38-1.12 2.5-2.5 2.5h-15C3.12 22 2 20.88 2 19.5v-15C2 3.12 3.12 2 4.5 2h15zm-3.06 4.5c-.28.46-.4.94-.4 1.54 0 1.22.78 2.88 1.44 3.84l-3.3 8.12h-3.44l-1.34-7.02c-.38.28-.78.52-1.2.72l-.42-1.96c1.3-.7 2.6-1.88 3.46-3.26h-3.6V6.5h8.8z"/>
            </svg>
            Pay with Venmo
          </a>
        </div>

        {/* ── Zelle ── */}
        <div className="payment-card">
          <h3 style={{ color: '#6D1ED4' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#6D1ED4" style={{ flexShrink: 0 }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            Pay with Zelle
          </h3>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '.75rem' }}>
            Open your bank's Zelle feature and send payment to either:
          </p>
          <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '.75rem', marginBottom: '.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem' }}>
              <span style={{ fontSize: '1rem' }}>📱</span>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Phone</div>
                <a href="tel:2183315145" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-800)', letterSpacing: '.03em' }}>
                  218-331-5145
                </a>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '.4rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontSize: '1rem' }}>✉️</span>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Email</div>
                <a href="mailto:Clarkryan977@gmail.com" style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--gray-800)' }}>
                  Clarkryan977@gmail.com
                </a>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '.78rem', color: 'var(--gray-400)' }}>
            💡 Include your invoice number in the memo field.
          </p>
        </div>
      </div>
    </div>
  );
}
