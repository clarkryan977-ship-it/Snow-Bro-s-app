import { useState, useEffect } from 'react';
import api from '../../utils/api';
import PaymentSection from '../../components/PaymentSection';
import PrintInvoiceButton from '../../components/PrintableInvoice';

const STATUS_COLORS = { draft:'badge-gray', sent:'badge-blue', paid:'badge-green', overdue:'badge-red' };

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [viewInv, setViewInv] = useState(null);

  useEffect(() => {
    // Clients see invoices via admin endpoint — in a full app you'd have a client-specific endpoint
    // For now we show all invoices (the backend already filters by token role if needed)
    api.get('/invoices').then(r => setInvoices(r.data)).catch(() => {});
  }, []);

  const viewFull = async inv => {
    const { data } = await api.get(`/invoices/${inv.id}`);
    setViewInv(data);
  };

  return (
    <div className="container" style={{ maxWidth:800, padding:'2rem 1rem' }}>
      <div className="page-header">
        <h1>🧾 My Invoices</h1>
        <p>View your invoices and make payments.</p>
      </div>

      {invoices.length === 0 && (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>🧾</div>
          <p style={{ color:'var(--gray-500)' }}>No invoices yet.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
        {invoices.map(inv => (
          <div key={inv.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'.5rem' }}>
              <div>
                <div style={{ fontWeight:700 }}>{inv.invoice_number}</div>
                <div style={{ fontSize:'.82rem', color:'var(--gray-400)' }}>{inv.created_at?.slice(0,10)}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--blue-700)' }}>${Number(inv.total).toFixed(2)}</div>
                <span className={`badge ${STATUS_COLORS[inv.status] || 'badge-gray'}`}>{inv.status}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => viewFull(inv)}>View</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice detail modal */}
      {viewInv && (
        <div className="modal-overlay" onClick={() => setViewInv(null)}>
          <div className="modal" style={{ maxWidth:620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Invoice {viewInv.invoice_number}</h2>
              <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                <PrintInvoiceButton invoice={viewInv} label="🖨️ Print" />
                <button className="modal-close" onClick={() => setViewInv(null)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:'.5rem' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{viewInv.client_name}</div>
                  <div style={{ fontSize:'.85rem', color:'var(--gray-500)' }}>{viewInv.client_email}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span className={`badge ${STATUS_COLORS[viewInv.status] || 'badge-gray'}`}>{viewInv.status}</span>
                  <div style={{ fontSize:'.8rem', color:'var(--gray-400)', marginTop:'.25rem' }}>{viewInv.created_at?.slice(0,10)}</div>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {(viewInv.items||[]).map(it => (
                      <tr key={it.id}>
                        <td>{it.description}</td>
                        <td>{it.quantity}</td>
                        <td>${Number(it.unit_price).toFixed(2)}</td>
                        <td>${Number(it.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign:'right', marginTop:'1rem' }}>
                <div style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>Subtotal: ${Number(viewInv.subtotal).toFixed(2)}</div>
                {viewInv.tax_rate > 0 && <div style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>Tax ({viewInv.tax_rate}%): ${Number(viewInv.tax_amount).toFixed(2)}</div>}
                <div style={{ fontWeight:800, fontSize:'1.2rem', color:'var(--blue-700)' }}>Total: ${Number(viewInv.total).toFixed(2)}</div>
              </div>

              {/* Payment section */}
              <hr className="divider" />
              <PaymentSection invoiceTotal={viewInv.total} invoiceNumber={viewInv.invoice_number} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
