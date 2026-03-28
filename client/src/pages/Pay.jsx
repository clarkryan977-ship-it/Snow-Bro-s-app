import PaymentSection from '../components/PaymentSection';

export default function Pay() {
  return (
    <div className="container" style={{ maxWidth: 700, padding: '2rem 1rem' }}>
      <div className="page-header">
        <h1>💳 Make a Payment</h1>
        <p>Pay your invoice quickly and securely using Cash App, Venmo, or Zelle.</p>
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
          or contact us directly. We're happy to help!
        </p>
      </div>
    </div>
  );
}
