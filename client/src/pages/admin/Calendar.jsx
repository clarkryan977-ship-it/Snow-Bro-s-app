import { useState, useEffect } from 'react';
import api from '../../utils/api';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function AdminCalendar() {
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('month'); // month or week
  const [msg, setMsg] = useState(null);

  const load = () => {
    api.get('/calendar').then(r => setBookings(r.data)).catch(() => {});
    api.get('/employees').then(r => setEmployees(r.data.filter(e => e.role === 'employee'))).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const getBookingsForDate = (dateStr) => bookings.filter(b => b.preferred_date === dateStr);

  const assignEmployee = async (bookingId, employeeId) => {
    try {
      await api.put(`/calendar/${bookingId}/assign`, { employee_id: employeeId || null });
      setMsg({ type:'success', text:'Employee assigned & notified!' });
      load();
    } catch (e) { setMsg({ type:'error', text:'Failed to assign' }); }
  };

  const reschedule = async (bookingId, date, time) => {
    try {
      await api.put(`/calendar/${bookingId}/reschedule`, { preferred_date: date, preferred_time: time });
      setMsg({ type:'success', text:'Rescheduled!' });
      load();
    } catch (e) { setMsg({ type:'error', text:'Failed to reschedule' }); }
  };

  const markComplete = async (bookingId) => {
    try {
      await api.put(`/calendar/${bookingId}/complete`);
      setMsg({ type:'success', text:'Marked as completed!' });
      load();
      setSelected(null);
    } catch (e) { setMsg({ type:'error', text:'Failed' }); }
  };

  const statusColor = (s) => {
    if (s === 'completed') return '#059669';
    if (s === 'confirmed') return '#2563eb';
    if (s === 'cancelled') return '#dc2626';
    return '#d97706';
  };

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  return (
    <div>
      <div className="page-header">
        <h1>📅 Job Calendar</h1>
        <p>Visual scheduling — assign employees, reschedule, and manage jobs.</p>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom:'1rem' }}>{msg.text}</div>}

      {/* Calendar Header */}
      <div className="card" style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={prev}>← Prev</button>
          <h2 style={{ fontSize:'1.2rem', fontWeight:700 }}>{MONTHS[month]} {year}</h2>
          <button className="btn btn-secondary btn-sm" onClick={next}>Next →</button>
        </div>

        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign:'center', fontWeight:700, fontSize:'.75rem', color:'var(--gray-500)', padding:'.3rem 0' }}>{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`e${i}`} style={{ minHeight:80 }} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = getBookingsForDate(dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            return (
              <div key={day} style={{
                minHeight:80, border:'1px solid var(--blue-100)', borderRadius:6, padding:'.25rem',
                background: isToday ? 'var(--blue-50)' : '#fff', cursor:'pointer', overflow:'hidden'
              }} onClick={() => dayBookings.length > 0 && setSelected({ date: dateStr, bookings: dayBookings })}>
                <div style={{ fontSize:'.75rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--blue-700)' : 'var(--gray-700)', marginBottom:'.2rem' }}>{day}</div>
                {dayBookings.slice(0, 3).map(b => (
                  <div key={b.id} style={{
                    fontSize:'.6rem', padding:'1px 3px', borderRadius:3, marginBottom:1,
                    background: statusColor(b.status) + '20', color: statusColor(b.status),
                    fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                  }}>
                    {b.service_name || 'Job'}
                  </div>
                ))}
                {dayBookings.length > 3 && <div style={{ fontSize:'.55rem', color:'var(--gray-400)' }}>+{dayBookings.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 {selected.date}</h2>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              {selected.bookings.map(b => (
                <div key={b.id} style={{ border:'1px solid var(--blue-100)', borderRadius:'var(--radius)', padding:'1rem', marginBottom:'.75rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.5rem' }}>
                    <div>
                      <strong>{b.service_name || 'Service'}</strong>
                      <span style={{ marginLeft:'.5rem', fontSize:'.8rem', color:statusColor(b.status), fontWeight:600 }}>({b.status})</span>
                    </div>
                    <span style={{ fontSize:'.82rem', color:'var(--gray-500)' }}>{b.preferred_time || 'No time'}</span>
                  </div>
                  <div style={{ fontSize:'.85rem', color:'var(--gray-600)', marginBottom:'.5rem' }}>
                    👤 {b.client_name || b.full_client_name || 'Unknown'} {b.client_phone && `· ${b.client_phone}`}
                  </div>
                  <div style={{ display:'flex', gap:'.5rem', alignItems:'center', flexWrap:'wrap' }}>
                    <select
                      style={{ fontSize:'.82rem', padding:'.3rem .5rem', borderRadius:6, border:'1px solid var(--blue-200)' }}
                      value={b.assigned_employee_id || ''}
                      onChange={e => assignEmployee(b.id, e.target.value)}
                    >
                      <option value="">Assign Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                      ))}
                    </select>
                    {b.assigned_employee_name && <span className="badge badge-blue">{b.assigned_employee_name}</span>}
                    {b.status !== 'completed' && (
                      <button className="btn btn-primary btn-sm" onClick={() => markComplete(b.id)}>✅ Complete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
