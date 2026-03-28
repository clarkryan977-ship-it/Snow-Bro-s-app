import PaymentSection from '../components/PaymentSection';
import SiteFooter from '../components/SiteFooter';

export default function Pay() {
  return (
    <div>
      <div className="container" style={{ maxWidth: 700, padding: '2rem 1rem' }}>
        <div className="page-header">
          <h1>💳 Pay Your Snow Bro's Invoice</h1>
          <p>Pay your lawn care or snow removal invoice quickly and securely using Cash App, Venmo, or Zelle — serving Moorhead, MN &amp; Fargo, ND.</p>
        </div>

        <div className="card">
          <p style={{ color: 'var(--gray-600)', marginBottom: '1.5rem', fontSize: '.95rem' }}>
            We accept payments via <strong>Cash App</strong>, <strong>Venmo</strong>, and <strong>Zelle</strong>. Please include your
            invoice number in the payment memo so we can apply it to your account.
          </p>
          <PaymentSection />
        </div>

        <div className="card mt-2" style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-200)' }}>
          <p style={{ fontSize: '.88rem', color: 'var(--blue-800)' }}>
            <strong>Questions about your invoice?</strong> Log in to your client account to view your invoices,
            or contact us directly at <a href="tel:2183315145" style={{ color: 'var(--blue-700)' }}>218-331-5145</a>. We're happy to help!
          </p>
        </div>

        {/* NAP mini-card */}
        <div className="card mt-2" style={{ textAlign: 'center', fontSize: '.85rem', color: 'var(--gray-600)' }}>
          <strong>Snow Bro's</strong> — Residential &amp; Commercial Lawn Care &amp; Snow Removal<br />
          1812 33rd St S, Moorhead, MN 56560 · <a href="tel:2183315145" style={{ color: 'var(--blue-700)' }}>218-331-5145</a><br />
          Serving <strong>Moorhead, MN</strong> &amp; <strong>Fargo, ND</strong>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
