import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TIME_SLOTS = [
  '08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00',
];
const TIME_LABELS = {
  '08:00':'8 AM','09:00':'9 AM','10:00':'10 AM','11:00':'11 AM','12:00':'12 PM',
  '13:00':'1 PM','14:00':'2 PM','15:00':'3 PM','16:00':'4 PM','17:00':'5 PM',
};

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function AvailabilityCalendar() {
  const today = new Date();
  const [view, setView]           = useState('month'); // 'month' | 'week'
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth()); // 0-indexed
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  const [blocked, setBlocked]     = useState([]); // array of blocked_times rows
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState(null);
  const [modal, setModal]         = useState(null); // { date, blocks, mode:'day'|'time', slot? }
  const [reason, setReason]       = useState('');
  const [blockMode, setBlockMode] = useState('all_day'); // 'all_day' | 'time_range'
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd,   setTimeEnd]   = useState('17:00');

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Compute date range to fetch
  const fetchRange = useCallback(() => {
    if (view === 'month') {
      const start = `${year}-${String(month + 1).padStart(2,'0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      return { start, end };
    } else {
      const start = toYMD(weekStart);
      const end   = toYMD(addDays(weekStart, 6));
      return { start, end };
    }
  }, [view, year, month, weekStart]);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = fetchRange();
      const { data } = await api.get(`/availability?start=${start}&end=${end}`);
      setBlocked(data);
    } catch {
      flash('error', 'Failed to load availability');
    } finally { setLoading(false); }
  }, [fetchRange]);

  useEffect(() => { loadBlocked(); }, [loadBlocked]);

  // Helper: get blocks for a specific date string
  const blocksForDate = (dateStr) => blocked.filter(b => b.block_date?.slice(0,10) === dateStr);
  const isFullyBlocked = (dateStr) => blocksForDate(dateStr).some(b => b.all_day);

  // ── Block a date/time ──
  const doBlock = async () => {
    if (!modal) return;
    try {
      const payload = {
        block_date: modal.date,
        all_day: blockMode === 'all_day',
        reason,
        start_time: blockMode === 'time_range' ? timeStart : null,
        end_time:   blockMode === 'time_range' ? timeEnd   : null,
      };
      await api.post('/availability/block', payload);
      flash('success', `${modal.date} blocked successfully`);
      setModal(null);
      setReason('');
      await loadBlocked();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to block');
    }
  };

  // ── Unblock a specific entry ──
  const doUnblock = async (id) => {
    try {
      await api.delete(`/availability/block/${id}`);
      flash('success', 'Unblocked successfully');
      setModal(prev => prev ? { ...prev, blocks: prev.blocks.filter(b => b.id !== id) } : null);
      await loadBlocked();
    } catch {
      flash('error', 'Failed to unblock');
    }
  };

  // ── Unblock entire date ──
  const doUnblockDate = async (dateStr) => {
    if (!window.confirm(`Unblock all slots on ${dateStr}?`)) return;
    try {
      await api.delete(`/availability/block/date/${dateStr}`);
      flash('success', `All blocks removed for ${dateStr}`);
      setModal(null);
      await loadBlocked();
    } catch {
      flash('error', 'Failed to unblock date');
    }
  };

  // ── Click on a calendar day ──
  const handleDayClick = (dateStr) => {
    const blocks = blocksForDate(dateStr);
    setModal({ date: dateStr, blocks, mode: 'day' });
    setReason('');
    setBlockMode('all_day');
    setTimeStart('08:00');
    setTimeEnd('17:00');
  };

  // ── Navigation ──
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));

  // ── Build month grid ──
  const buildMonthGrid = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  // ── Build week days ──
  const buildWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const todayStr = toYMD(today);

  return (
    <div>
      <div className="flex-between page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🗓️ Availability Calendar</h1>
          <p>Block or unblock dates and time slots. Blocked days appear as unavailable to clients.</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button
            className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('month')}
          >Monthly</button>
          <button
            className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('week')}
          >Weekly</button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap', fontSize: '.85rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#dcfce7', border: '1px solid #16a34a', display: 'inline-block' }} />
          Available
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fee2e2', border: '1px solid #dc2626', display: 'inline-block' }} />
          Fully Blocked
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fef3c7', border: '1px solid #d97706', display: 'inline-block' }} />
          Partially Blocked
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#dbeafe', border: '1px solid #2563eb', display: 'inline-block' }} />
          Today
        </span>
      </div>

      {/* ── MONTH VIEW ── */}
      {view === 'month' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹ Prev</button>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{MONTHS[month]} {year}</h2>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}>Next ›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '.75rem', fontWeight: 700, color: '#64748b', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {buildMonthGrid().map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const blocks  = blocksForDate(dateStr);
                const fullyBlocked = blocks.some(b => b.all_day);
                const partialBlocked = !fullyBlocked && blocks.length > 0;
                const isToday = dateStr === todayStr;
                const isPast  = dateStr < todayStr;

                let bg = '#f0fdf4'; // available green tint
                let border = '#86efac';
                if (fullyBlocked)   { bg = '#fee2e2'; border = '#fca5a5'; }
                else if (partialBlocked) { bg = '#fef9c3'; border = '#fde047'; }
                if (isToday)        { bg = '#dbeafe'; border = '#93c5fd'; }
                if (isPast)         { bg = '#f8fafc'; border = '#e2e8f0'; }

                return (
                  <div
                    key={dateStr}
                    onClick={() => !isPast && handleDayClick(dateStr)}
                    style={{
                      minHeight: 70,
                      background: bg,
                      border: `2px solid ${border}`,
                      borderRadius: 8,
                      padding: '6px 8px',
                      cursor: isPast ? 'default' : 'pointer',
                      opacity: isPast ? 0.5 : 1,
                      transition: 'transform .1s, box-shadow .1s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!isPast) { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <div style={{ fontWeight: isToday ? 800 : 600, fontSize: '.9rem', color: isToday ? '#1d4ed8' : '#1e293b' }}>
                      {day}
                    </div>
                    {fullyBlocked && (
                      <div style={{ fontSize: '.65rem', color: '#dc2626', fontWeight: 700, marginTop: 2 }}>
                        🚫 Blocked
                      </div>
                    )}
                    {partialBlocked && (
                      <div style={{ fontSize: '.65rem', color: '#d97706', fontWeight: 700, marginTop: 2 }}>
                        ⚠️ {blocks.length} slot{blocks.length > 1 ? 's' : ''} blocked
                      </div>
                    )}
                    {!fullyBlocked && !partialBlocked && !isPast && (
                      <div style={{ fontSize: '.65rem', color: '#16a34a', marginTop: 2 }}>✓ Open</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {view === 'week' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={prevWeek}>‹ Prev Week</button>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {toYMD(weekStart)} – {toYMD(addDays(weekStart, 6))}
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={nextWeek}>Next Week ›</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ width: 70, padding: '8px', textAlign: 'left', fontSize: '.8rem', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>Time</th>
                    {buildWeekDays().map(d => {
                      const dateStr = toYMD(d);
                      const isToday = dateStr === todayStr;
                      const fullyBlocked = isFullyBlocked(dateStr);
                      return (
                        <th
                          key={dateStr}
                          style={{
                            padding: '8px 4px',
                            textAlign: 'center',
                            fontSize: '.82rem',
                            fontWeight: 700,
                            borderBottom: '2px solid #e2e8f0',
                            background: fullyBlocked ? '#fee2e2' : isToday ? '#dbeafe' : undefined,
                            color: isToday ? '#1d4ed8' : '#374151',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDayClick(dateStr)}
                        >
                          {DAYS[d.getDay()]}<br />
                          <span style={{ fontWeight: 400, fontSize: '.75rem', color: '#64748b' }}>{dateStr.slice(5)}</span>
                          {fullyBlocked && <div style={{ fontSize: '.65rem', color: '#dc2626' }}>🚫 Blocked</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(slot => (
                    <tr key={slot}>
                      <td style={{ padding: '6px 8px', fontSize: '.78rem', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {TIME_LABELS[slot]}
                      </td>
                      {buildWeekDays().map(d => {
                        const dateStr = toYMD(d);
                        const dayBlocks = blocksForDate(dateStr);
                        const fullyBlocked = dayBlocks.some(b => b.all_day);
                        const slotBlocked = !fullyBlocked && dayBlocks.some(b => {
                          if (!b.start_time || !b.end_time) return false;
                          return slot >= b.start_time.slice(0,5) && slot < b.end_time.slice(0,5);
                        });
                        const isPast = dateStr < todayStr;

                        let bg = 'transparent';
                        if (fullyBlocked) bg = '#fee2e2';
                        else if (slotBlocked) bg = '#fef3c7';

                        return (
                          <td
                            key={`${dateStr}-${slot}`}
                            style={{
                              padding: '4px',
                              borderBottom: '1px solid #f1f5f9',
                              borderLeft: '1px solid #f1f5f9',
                              background: bg,
                              textAlign: 'center',
                              cursor: isPast ? 'default' : 'pointer',
                              opacity: isPast ? 0.4 : 1,
                            }}
                            onClick={() => !isPast && handleDayClick(dateStr)}
                          >
                            {slotBlocked && <span style={{ fontSize: '.7rem', color: '#d97706' }}>⚠️</span>}
                            {fullyBlocked && <span style={{ fontSize: '.7rem', color: '#dc2626' }}>🚫</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Day Detail Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 {modal.date}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">

              {/* Existing blocks */}
              {modal.blocks.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '.5rem' }}>
                    Current Blocks
                  </div>
                  {modal.blocks.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem .75rem', background: '#fee2e2', borderRadius: 6, marginBottom: '.4rem', gap: '.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '.88rem' }}>
                          {b.all_day ? '🚫 All Day' : `⏰ ${b.start_time?.slice(0,5)} – ${b.end_time?.slice(0,5)}`}
                        </span>
                        {b.reason && <span style={{ color: '#64748b', fontSize: '.8rem', marginLeft: '.5rem' }}>— {b.reason}</span>}
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => doUnblock(b.id)}>Unblock</button>
                    </div>
                  ))}
                  {modal.blocks.length > 1 && (
                    <button className="btn btn-danger btn-sm" style={{ marginTop: '.25rem' }} onClick={() => doUnblockDate(modal.date)}>
                      Remove All Blocks
                    </button>
                  )}
                </div>
              )}

              {/* Add new block */}
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '.75rem' }}>
                Add Block
              </div>

              <div className="form-group">
                <label style={{ fontSize: '.85rem' }}>Block Type</label>
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.3rem' }}>
                  <button
                    className={`btn btn-sm ${blockMode === 'all_day' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setBlockMode('all_day')}
                  >🚫 All Day</button>
                  <button
                    className={`btn btn-sm ${blockMode === 'time_range' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setBlockMode('time_range')}
                  >⏰ Time Range</button>
                </div>
              </div>

              {blockMode === 'time_range' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '.85rem' }}>Start Time</label>
                    <select className="form-control" value={timeStart} onChange={e => setTimeStart(e.target.value)}>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{TIME_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '.85rem' }}>End Time</label>
                    <select className="form-control" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{TIME_LABELS[t]}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: '.85rem' }}>Reason (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Holiday, Equipment maintenance, Fully booked…"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={doBlock}>🚫 Block This {blockMode === 'all_day' ? 'Day' : 'Time Slot'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
