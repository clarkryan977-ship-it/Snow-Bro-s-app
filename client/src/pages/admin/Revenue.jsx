import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

function BarChart({ data, labelKey, valueKey, color = '#2563eb', height = 220 }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, padding:'0 .25rem' }}>
      {data.map((d, i) => {
        const h = (d[valueKey] / max) * (height - 30);
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <div style={{ fontSize:'.65rem', fontWeight:600, color:'var(--blue-700)' }}>${d[valueKey]?.toFixed?.(0) ?? d[valueKey]}</div>
            <div style={{ width:'100%', maxWidth:40, height:Math.max(h, 2), background:color, borderRadius:'4px 4px 0 0', transition:'height .3s' }} />
            <div style={{ fontSize:'.6rem', color:'var(--gray-500)', textAlign:'center', lineHeight:1.1 }}>{d[labelKey]?.slice?.(5) || d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminRevenue() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/revenue/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ height:'60vh' }}><span className="spinner" /></div>;
  if (!stats) return <div className="card">Failed to load revenue data.</div>;

  const growth = stats.lastMonthRev > 0 ? (((stats.thisMonthRev - stats.lastMonthRev) / stats.lastMonthRev) * 100).toFixed(1) : 'N/A';

  return (
    <div>
      <div className="page-header">
        <h1>📊 Revenue Dashboard</h1>
        <p>Key business metrics and financial overview.</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { label:'Total Revenue', value:`$${stats.totalRevenue.toFixed(2)}`, icon:'💰', color:'var(--blue-700)' },
          { label:'This Month', value:`$${stats.thisMonthRev.toFixed(2)}`, icon:'📈', color:'#059669' },
          { label:'Last Month', value:`$${stats.lastMonthRev.toFixed(2)}`, icon:'📉', color:'var(--gray-600)' },
          { label:'Growth', value: growth === 'N/A' ? 'N/A' : `${growth}%`, icon:'🚀', color: parseFloat(growth) >= 0 ? '#059669' : '#dc2626' },
          { label:'Total Clients', value:stats.totalClients, icon:'👥', color:'var(--blue-700)' },
          { label:'Total Bookings', value:stats.totalBookings, icon:'📅', color:'var(--blue-700)' },
          { label:'Avg Rating', value: stats.totalReviews > 0 ? `${stats.avgRating.toFixed(1)} ⭐` : 'No reviews', icon:'⭐', color:'#d97706' },
          { label:'Pending Jobs', value:stats.pendingBookings, icon:'⏳', color:'#d97706' },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign:'center', padding:'1.25rem 1rem' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'.3rem' }}>{k.icon}</div>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:'.78rem', color:'var(--gray-500)', marginTop:'.2rem' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>📊 Monthly Revenue</h3>
        {stats.monthly.length > 0 ? (
          <BarChart data={stats.monthly} labelKey="month" valueKey="revenue" />
        ) : (
          <p style={{ color:'var(--gray-400)', textAlign:'center', padding:'2rem' }}>No invoice data yet.</p>
        )}
      </div>

      {/* Top Services */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>🏆 Top Services by Bookings</h3>
        {stats.topServices.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Service</th><th>Bookings</th><th>Est. Revenue</th></tr></thead>
              <tbody>
                {stats.topServices.map(s => (
                  <tr key={s.name}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.booking_count}</td>
                    <td style={{ fontWeight:600, color:'var(--blue-700)' }}>${s.total_revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color:'var(--gray-400)', textAlign:'center', padding:'2rem' }}>No bookings yet.</p>
        )}
      </div>

      {/* Bookings by Status */}
      <div className="card">
        <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>📋 Bookings by Status</h3>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          {stats.bookingsByStatus.map(s => (
            <div key={s.status} style={{ background:'var(--blue-50)', borderRadius:'var(--radius)', padding:'.75rem 1.25rem', textAlign:'center' }}>
              <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--blue-700)' }}>{s.count}</div>
              <div style={{ fontSize:'.78rem', color:'var(--gray-500)', textTransform:'capitalize' }}>{s.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
