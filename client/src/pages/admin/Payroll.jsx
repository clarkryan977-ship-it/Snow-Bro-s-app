import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

function fmtHours(mins) {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PERIOD_PRESETS = [
  { label: 'This Week',       days: 7  },
  { label: 'Last 2 Weeks',    days: 14 },
  { label: 'This Month',      days: 30 },
  { label: 'Last 30 Days',    days: 30 },
  { label: 'Custom Range',    days: 0  },
];

function getDateRange(days) {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  };
}

export default function Payroll() {
  const [employees, setEmployees]   = useState([]);
  const [records,   setRecords]     = useState([]);
  const [rates,     setRates]       = useState({});   // { empId: hourlyRate }
  const [loading,   setLoading]     = useState(true);
  const [saving,    setSaving]      = useState({});
  const [msg,       setMsg]         = useState(null);
  const [preset,    setPreset]      = useState(1);    // index into PERIOD_PRESETS
  const [dateRange, setDateRange]   = useState(getDateRange(14));
  const [periods,   setPeriods]     = useState([]);   // saved pay periods
  const [showPeriods, setShowPeriods] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [empRecords,  setEmpRecords]  = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, recRes, periodRes] = await Promise.all([
        api.get('/employees'),
        api.get(`/payroll/summary?start=${dateRange.start}&end=${dateRange.end}`),
        api.get('/payroll/periods'),
      ]);
      setEmployees(empRes.data);
      setRecords(recRes.data);
      setPeriods(periodRes.data);
      // Initialize rates from server data
      const rateMap = {};
      empRes.data.forEach(e => { rateMap[e.id] = e.hourly_rate || ''; });
      recRes.data.forEach(r => { if (r.hourly_rate) rateMap[r.employee_id] = r.hourly_rate; });
      setRates(prev => ({ ...rateMap, ...prev }));
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to load payroll data' });
    } finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyPreset = (idx) => {
    setPreset(idx);
    if (PERIOD_PRESETS[idx].days > 0) {
      setDateRange(getDateRange(PERIOD_PRESETS[idx].days));
    }
  };

  const saveRate = async (empId) => {
    setSaving(s => ({ ...s, [empId]: true }));
    try {
      await api.put(`/payroll/rate/${empId}`, { hourly_rate: parseFloat(rates[empId]) || 0 });
      setMsg({ type: 'success', text: 'Hourly rate saved!' });
      setTimeout(() => setMsg(null), 3000);
      await loadData();
    } catch {
      setMsg({ type: 'error', text: 'Failed to save rate' });
    } finally { setSaving(s => ({ ...s, [empId]: false })); }
  };

  const markPaid = async () => {
    if (!window.confirm(`Mark this pay period (${dateRange.start} – ${dateRange.end}) as PAID for all employees?`)) return;
    try {
      await api.post('/payroll/mark-paid', {
        start_date: dateRange.start,
        end_date:   dateRange.end,
        summary:    records,
      });
      setMsg({ type: 'success', text: '✅ Pay period marked as paid!' });
      await loadData();
    } catch {
      setMsg({ type: 'error', text: 'Failed to mark as paid' });
    }
  };

  const loadEmpRecords = async (empId) => {
    if (expandedEmp === empId) { setExpandedEmp(null); return; }
    try {
      const { data } = await api.get(`/time/employee/${empId}?start=${dateRange.start}&end=${dateRange.end}`);
      setEmpRecords(prev => ({ ...prev, [empId]: data }));
      setExpandedEmp(empId);
    } catch { setMsg({ type: 'error', text: 'Failed to load records' }); }
  };

  const printPayroll = () => {
    const rows = records.map(r => {
      const rate = parseFloat(rates[r.employee_id]) || 0;
      const hrs  = (r.total_minutes || 0) / 60;
      const gross = (hrs * rate).toFixed(2);
      return `<tr>
        <td>${r.employee_name}</td>
        <td>${fmtHours(r.total_minutes)}</td>
        <td>$${rate.toFixed(2)}/hr</td>
        <td><strong>$${gross}</strong></td>
        <td>${r.shift_count} shifts</td>
      </tr>`;
    }).join('');

    const totalGross = records.reduce((s, r) => {
      const rate = parseFloat(rates[r.employee_id]) || 0;
      const hrs  = (r.total_minutes || 0) / 60;
      return s + hrs * rate;
    }, 0);

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Payroll Summary</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 2rem; color: #1e293b; }
      h1 { color: #1d4ed8; } h2 { color: #374151; font-size: 1rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th { background: #1d4ed8; color: #fff; padding: 8px 12px; text-align: left; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) td { background: #f8fafc; }
      .total { font-size: 1.1rem; font-weight: 700; color: #1d4ed8; margin-top: 1rem; text-align: right; }
      .footer { margin-top: 2rem; font-size: .8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
    </style></head><body>
    <h1>❄️ Snow Bro's — Payroll Summary</h1>
    <h2>Pay Period: ${fmtDate(dateRange.start)} – ${fmtDate(dateRange.end)}</h2>
    <table>
      <thead><tr><th>Employee</th><th>Total Hours</th><th>Rate</th><th>Gross Pay</th><th>Shifts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total Gross Payroll: ${fmtMoney(totalGross)}</div>
    <div class="footer">Generated ${new Date().toLocaleString()} &middot; Snow Bro's Lawn Care &amp; Snow Removal</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const totalGross = records.reduce((s, r) => {
    const rate = parseFloat(rates[r.employee_id]) || 0;
    const hrs  = (r.total_minutes || 0) / 60;
    return s + hrs * rate;
  }, 0);

  const totalHours = records.reduce((s, r) => s + (r.total_minutes || 0), 0);

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1>💰 Payroll</h1>
          <p>Calculate hours worked, set rates, and manage pay periods.</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowPeriods(s => !s)}>
            📋 Pay History
          </button>
          <button className="btn btn-secondary" onClick={printPayroll}>
            🖨️ Print / Export
          </button>
          <button className="btn btn-primary" onClick={markPaid}>
            ✅ Mark Period Paid
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Date range selector */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          {PERIOD_PRESETS.map((p, i) => (
            <button
              key={i}
              className={`btn btn-sm ${preset === i ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => applyPreset(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '.8rem' }}>Start Date</label>
            <input
              type="date"
              className="form-control"
              value={dateRange.start}
              onChange={e => { setPreset(4); setDateRange(d => ({ ...d, start: e.target.value })); }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '.8rem' }}>End Date</label>
            <input
              type="date"
              className="form-control"
              value={dateRange.end}
              onChange={e => { setPreset(4); setDateRange(d => ({ ...d, end: e.target.value })); }}
            />
          </div>
          <div style={{ paddingTop: '1.2rem' }}>
            <button className="btn btn-primary btn-sm" onClick={loadData}>Apply</button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d4ed8' }}>{fmtHours(totalHours)}</div>
          <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '.25rem' }}>Total Hours</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>{fmtMoney(totalGross)}</div>
          <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '.25rem' }}>Total Gross Pay</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed' }}>{records.length}</div>
          <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '.25rem' }}>Employees Active</div>
        </div>
      </div>

      {/* Payroll table */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
            Pay Period: {fmtDate(dateRange.start)} – {fmtDate(dateRange.end)}
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shifts</th>
                  <th>Total Hours</th>
                  <th>Hourly Rate</th>
                  <th>Gross Pay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem' }}>
                      No time records for this period
                    </td>
                  </tr>
                )}
                {records.map(r => {
                  const rate  = parseFloat(rates[r.employee_id]) || 0;
                  const hrs   = (r.total_minutes || 0) / 60;
                  const gross = hrs * rate;
                  const isExpanded = expandedEmp === r.employee_id;

                  return (
                    <>
                      <tr key={r.employee_id} style={{ background: isExpanded ? '#eff6ff' : undefined }}>
                        <td>
                          <strong>{r.employee_name}</strong>
                          <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{r.employee_email}</div>
                        </td>
                        <td>{r.shift_count}</td>
                        <td><strong>{fmtHours(r.total_minutes)}</strong></td>
                        <td>
                          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '.85rem' }}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={rates[r.employee_id] || ''}
                              onChange={e => setRates(prev => ({ ...prev, [r.employee_id]: e.target.value }))}
                              className="form-control"
                              style={{ width: 80, padding: '.3rem .5rem', fontSize: '.88rem' }}
                              placeholder="0.00"
                            />
                            <span style={{ color: '#64748b', fontSize: '.8rem' }}>/hr</span>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => saveRate(r.employee_id)}
                              disabled={saving[r.employee_id]}
                            >
                              {saving[r.employee_id] ? <span className="spinner" /> : '💾'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#16a34a', fontSize: '1rem' }}>
                            {rate > 0 ? fmtMoney(gross) : <span style={{ color: '#94a3b8' }}>Set rate</span>}
                          </strong>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => loadEmpRecords(r.employee_id)}
                          >
                            {isExpanded ? '▲ Hide' : '▼ Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail rows */}
                      {isExpanded && empRecords[r.employee_id] && (
                        <tr key={`${r.employee_id}-detail`}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0' }}>
                              <table style={{ width: '100%', fontSize: '.85rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: '#64748b' }}>
                                    <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                                    <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Clock In</th>
                                    <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Clock Out</th>
                                    <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>Hours</th>
                                    <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Job</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {empRecords[r.employee_id].map(rec => (
                                    <tr key={rec.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                      <td style={{ padding: '5px 8px', color: '#374151' }}>
                                        {new Date(rec.clock_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </td>
                                      <td style={{ padding: '5px 8px', color: '#374151' }}>
                                        {new Date(rec.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                      </td>
                                      <td style={{ padding: '5px 8px', color: '#374151' }}>
                                        {rec.clock_out
                                          ? new Date(rec.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                                          : <span style={{ color: '#16a34a', fontWeight: 600 }}>Active</span>}
                                      </td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#1e40af' }}>
                                        {rec.hours_worked != null ? `${rec.hours_worked}h` : '—'}
                                      </td>
                                      <td style={{ padding: '5px 8px', color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {rec.job_address || rec.scope_of_work || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {/* Totals row */}
                {records.length > 0 && (
                  <tr style={{ background: '#eff6ff', fontWeight: 700 }}>
                    <td>TOTAL</td>
                    <td>{records.reduce((s, r) => s + (r.shift_count || 0), 0)} shifts</td>
                    <td>{fmtHours(totalHours)}</td>
                    <td>—</td>
                    <td style={{ color: '#16a34a', fontSize: '1.05rem' }}>{fmtMoney(totalGross)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Period History */}
      {showPeriods && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>📋 Pay Period History</h3>
          {periods.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '.9rem' }}>No pay periods recorded yet. Use "Mark Period Paid" to save a period.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Employees</th>
                    <th>Total Hours</th>
                    <th>Total Gross</th>
                    <th>Status</th>
                    <th>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map(p => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</td>
                      <td>{p.employee_count}</td>
                      <td>{fmtHours(p.total_minutes)}</td>
                      <td><strong style={{ color: '#16a34a' }}>{fmtMoney(p.total_gross)}</strong></td>
                      <td><span className="badge badge-green">Paid</span></td>
                      <td style={{ color: '#94a3b8', fontSize: '.85rem' }}>{fmtDate(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
