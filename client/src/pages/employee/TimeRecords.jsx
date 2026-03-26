import { useState, useEffect } from 'react';
import api from '../../utils/api';

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EmployeeTimeRecords() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    api.get('/time/my-records').then(r => setRecords(r.data)).catch(() => {});
  }, []);

  const totalMins = records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = Math.round(totalMins % 60);

  return (
    <div>
      <div className="page-header">
        <h1>📆 Time Records</h1>
        <p>Your complete work history.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom:'1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{records.length}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalH}h {totalM}m</div>
          <div className="stat-label">Total Time Logged</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Job Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No records yet</td></tr>
              )}
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight:600 }}>
                    {r.clock_in ? new Date(r.clock_in + 'Z').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—'}
                  </td>
                  <td style={{ fontSize:'.85rem' }}>
                    {r.clock_in ? new Date(r.clock_in + 'Z').toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'}
                  </td>
                  <td style={{ fontSize:'.85rem' }}>
                    {r.clock_out ? new Date(r.clock_out + 'Z').toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'}
                  </td>
                  <td><strong style={{ color:'var(--blue-700)' }}>{fmtDuration(r.duration_minutes)}</strong></td>
                  <td style={{ fontSize:'.82rem', color:'var(--gray-600)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {r.job_address || <span style={{ color:'var(--gray-300)' }}>—</span>}
                  </td>
                  <td>
                    {!r.clock_out
                      ? <span className="badge badge-green">Active</span>
                      : <span className="badge badge-gray">Done</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
