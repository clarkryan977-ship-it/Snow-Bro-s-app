import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function EmployeeSidebar({ open }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const check = () => api.get('/notifications/unread').then(r => setUnread(r.data.count)).catch(() => {});
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const links = [
    { to: '/employee', label: '🏠 Dashboard', end: true },
    { to: '/employee/clock', label: '⏱ Clock In/Out' },
    { to: '/employee/assigned', label: '🗺️ Assigned Jobs' },
    { to: '/employee/jobs', label: '📋 Job Records' },
    { to: '/employee/time', label: '📆 Time Records' },
    { to: '/employee/notifications', label: `🔔 Notifications${unread > 0 ? ` (${unread})` : ''}` },
  ];

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      {links.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          {l.label}
        </NavLink>
      ))}
    </aside>
  );
}
