import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import api from '../../utils/api';

const STATUS_COLORS = {
  pending:   { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  confirmed: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
  completed: { bg: '#d1fae5', border: '#059669', text: '#065f46' },
  cancelled: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
};

const EMPTY_FORM = {
  service_id: '', preferred_date: '', preferred_time: '',
  client_id: '', client_name: '', client_email: '', client_phone: '',
  assigned_employee_id: '', status: 'pending', notes: '',
};

export default function AdminCalendar() {
  const [bookings, setBookings]     = useState([]);
  const [services, setServices]     = useState([]);
  const [clients, setClients]       = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [modal, setModal]           = useState(null); // null | { mode:'add'|'edit', booking?, form }
  const [saving, setSaving]         = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [msg, setMsg]               = useState(null);
  const calRef                      = useRef(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = async () => {
    try {
      const [bRes, sRes, cRes, eRes] = await Promise.all([
        api.get('/calendar'),
        api.get('/services'),
        api.get('/clients'),
        api.get('/employees'),
      ]);
      setBookings(bRes.data);
      setServices(sRes.data);
      setClients(cRes.data);
      setEmployees(eRes.data.filter(e => e.role === 'employee' || e.role === 'manager'));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  // Convert bookings → FullCalendar events
  const events = bookings.map(b => {
    const col = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
    const title = [b.service_name, b.full_client_name || b.client_name].filter(Boolean).join(' — ');
    const start = b.preferred_time
      ? `${b.preferred_date}T${b.preferred_time}`
      : b.preferred_date;
    return {
      id: String(b.id),
      title,
      start,
      allDay: !b.preferred_time,
      backgroundColor: col.bg,
      borderColor: col.border,
      textColor: col.text,
      extendedProps: { booking: b },
    };
  });

  // Click on empty date/slot → open Add modal
  const handleDateClick = (info) => {
    const date = info.dateStr.split('T')[0];
    const time = info.dateStr.includes('T') ? info.dateStr.split('T')[1].slice(0, 5) : '';
    setModal({ mode: 'add', form: { ...EMPTY_FORM, preferred_date: date, preferred_time: time } });
  };

  // Click on existing event → open Edit modal
  const handleEventClick = (info) => {
    const b = info.event.extendedProps.booking;
    setModal({
      mode: 'edit',
      booking: b,
      form: {
        service_id:          String(b.service_id || ''),
        preferred_date:      b.preferred_date || '',
        preferred_time:      b.preferred_time || '',
        client_id:           String(b.client_id || ''),
        client_name:         b.client_name || b.full_client_name || '',
        client_email:        b.client_email || '',
        client_phone:        b.client_phone || '',
        assigned_employee_id: String(b.assigned_employee_id || ''),
        status:              b.status || 'pending',
        notes:               b.notes || '',
      },
    });
  };

  // Drag-and-drop reschedule
  const handleEventDrop = async (info) => {
    const id = info.event.id;
    const newDate = info.event.startStr.split('T')[0];
    const newTime = info.event.startStr.includes('T')
      ? info.event.startStr.split('T')[1].slice(0, 5) : '';
    try {
      await api.put(`/calendar/${id}/reschedule`, { preferred_date: newDate, preferred_time: newTime });
      flash('success', 'Appointment rescheduled!');
      load();
    } catch (e) {
      info.revert();
      flash('error', 'Failed to reschedule');
    }
  };

  // Resize event (timegrid) → update time
  const handleEventResize = async (info) => {
    const id = info.event.id;
    const newDate = info.event.startStr.split('T')[0];
    const newTime = info.event.startStr.includes('T')
      ? info.event.startStr.split('T')[1].slice(0, 5) : '';
    try {
      await api.put(`/calendar/${id}/reschedule`, { preferred_date: newDate, preferred_time: newTime });
      flash('success', 'Appointment updated!');
      load();
    } catch (e) {
      info.revert();
      flash('error', 'Failed to update');
    }
  };

  const handleSave = async () => {
    const f = modal.form;
    if (!f.service_id || !f.preferred_date) {
      flash('error', 'Service and date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        service_id:          Number(f.service_id),
        preferred_date:      f.preferred_date,
        preferred_time:      f.preferred_time,
        client_id:           f.client_id ? Number(f.client_id) : null,
        client_name:         f.client_name,
        client_email:        f.client_email,
        client_phone:        f.client_phone,
        assigned_employee_id: f.assigned_employee_id ? Number(f.assigned_employee_id) : null,
        status:              f.status,
        notes:               f.notes,
      };
      if (modal.mode === 'add') {
        await api.post('/calendar', payload);
        flash('success', 'Appointment added!');
      } else {
        await api.put(`/calendar/${modal.booking.id}/edit`, payload);
        flash('success', 'Appointment saved!');
      }
      setModal(null);
      load();
    } catch (e) {
      flash('error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this appointment? This cannot be undone.')) return;
    setSaving(true);
    try {
      await api.delete(`/calendar/${modal.booking.id}`);
      flash('success', 'Appointment deleted');
      setModal(null);
      load();
    } catch (e) {
      flash('error', 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, val) =>
    setModal(m => ({ ...m, form: { ...m.form, [key]: val } }));

  // When a client is selected from the dropdown, auto-fill name/email/phone
  const handleClientSelect = (clientId) => {
    setField('client_id', clientId);
    if (clientId) {
      const c = clients.find(c => String(c.id) === String(clientId));
      if (c) {
        setModal(m => ({
          ...m,
          form: {
            ...m.form,
            client_id:    String(clientId),
            client_name:  `${c.first_name} ${c.last_name}`.trim(),
            client_email: c.email || '',
            client_phone: c.phone || '',
          },
        }));
      }
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1>📅 Job Calendar</h1>
          <p>Click a date to add · Click an event to edit · Drag to reschedule</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ mode:'add', form: { ...EMPTY_FORM } })}>
          + New Appointment
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}
             style={{ marginBottom:'1rem' }}>
          {msg.text}
        </div>
      )}

      <div className="card" style={{ padding:'1rem' }}>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          events={events}
          editable={true}
          droppable={true}
          selectable={true}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
          height="auto"
          dayMaxEvents={4}
          eventDisplay="block"
          nowIndicator={true}
        />
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.mode === 'add' ? '➕ New Appointment' : '✏️ Edit Appointment'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>

              {/* Service */}
              <div>
                <label style={labelStyle}>Service *</label>
                <select style={inputStyle} value={modal.form.service_id}
                        onChange={e => setField('service_id', e.target.value)}>
                  <option value="">— Select service —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" style={inputStyle} value={modal.form.preferred_date}
                         onChange={e => setField('preferred_date', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  <input type="time" style={inputStyle} value={modal.form.preferred_time}
                         onChange={e => setField('preferred_time', e.target.value)} />
                </div>
              </div>

              {/* Customer — pick from list or type */}
              <div>
                <label style={labelStyle}>Customer (select existing or type below)</label>
                <select style={inputStyle} value={modal.form.client_id}
                        onChange={e => handleClientSelect(e.target.value)}>
                  <option value="">— Select customer —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.address ? `· ${c.address}` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
                <div>
                  <label style={labelStyle}>Customer Name</label>
                  <input style={inputStyle} placeholder="Full name" value={modal.form.client_name}
                         onChange={e => setField('client_name', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} placeholder="Phone" value={modal.form.client_phone}
                         onChange={e => setField('client_phone', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Customer Email</label>
                <input style={inputStyle} placeholder="Email" value={modal.form.client_email}
                       onChange={e => setField('client_email', e.target.value)} />
              </div>

              {/* Assign Employee */}
              <div>
                <label style={labelStyle}>Assigned Employee</label>
                <select style={inputStyle} value={modal.form.assigned_employee_id}
                        onChange={e => setField('assigned_employee_id', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={modal.form.status}
                        onChange={e => setField('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize:'vertical' }}
                          placeholder="Any notes…" value={modal.form.notes}
                          onChange={e => setField('notes', e.target.value)} />
              </div>

              {/* Send Confirmation Email — only in edit mode when status is confirmed and email exists */}
              {modal.mode === 'edit' && modal.form.status === 'confirmed' && modal.form.client_email && (
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                  <div style={{ fontSize:'.82rem', color:'#1e40af' }}>
                    📧 Notify <strong>{modal.form.client_name || modal.form.client_email}</strong> that this job is confirmed?
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ background:'#1d4ed8', color:'#fff', whiteSpace:'nowrap', flexShrink:0 }}
                    disabled={sendingEmail || saving}
                    onClick={async () => {
                      setSendingEmail(true);
                      try {
                        await api.post(`/calendar/${modal.booking.id}/confirm-email`);
                        flash('success', `Confirmation email sent to ${modal.form.client_email}`);
                      } catch (e) {
                        flash('error', e.response?.data?.error || 'Failed to send email');
                      } finally {
                        setSendingEmail(false);
                      }
                    }}
                  >
                    {sendingEmail ? 'Sending…' : '✉️ Send Confirmation'}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:'.5rem', justifyContent:'flex-end', paddingTop:'.5rem', borderTop:'1px solid var(--blue-100)' }}>
                {modal.mode === 'edit' && (
                  <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={saving}>
                    🗑 Delete
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setModal(null)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : modal.mode === 'add' ? '➕ Add Appointment' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '.8rem',
  fontWeight: 600,
  color: 'var(--gray-600)',
  marginBottom: '.25rem',
};

const inputStyle = {
  width: '100%',
  padding: '.45rem .6rem',
  borderRadius: 6,
  border: '1px solid var(--blue-200)',
  fontSize: '.9rem',
  boxSizing: 'border-box',
};
