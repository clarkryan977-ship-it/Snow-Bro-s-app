import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function EmployeeNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/notifications/my').then(r => setNotifications(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); load(); } catch (e) {}
  };

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); load(); } catch (e) {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <div className="flex-center" style={{ height:'60vh' }}><span className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'.75rem' }}>
          <div>
            <h1>🔔 Notifications</h1>
            <p>{unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}</p>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={markAllRead}>✅ Mark All Read</button>
          )}
        </div>
      </div>

      {notifications.length === 0 && (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>🔔</div>
          <p style={{ color:'var(--gray-500)' }}>No notifications yet.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
        {notifications.map(n => (
          <div key={n.id} className="card" style={{
            borderLeft: n.read ? '4px solid var(--gray-200)' : '4px solid var(--blue-600)',
            background: n.read ? '#fff' : 'var(--blue-50)',
            cursor: n.read ? 'default' : 'pointer'
          }} onClick={() => !n.read && markRead(n.id)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'.5rem' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'.95rem', color: n.read ? 'var(--gray-600)' : 'var(--blue-700)' }}>
                  {n.type === 'job_assigned' ? '📋' : '🔔'} {n.title}
                </div>
                <p style={{ fontSize:'.85rem', color:'var(--gray-600)', marginTop:'.25rem' }}>{n.message}</p>
              </div>
              <div style={{ fontSize:'.72rem', color:'var(--gray-400)', whiteSpace:'nowrap' }}>
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
            {!n.read && <div style={{ fontSize:'.7rem', color:'var(--blue-500)', marginTop:'.25rem' }}>Tap to mark as read</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
