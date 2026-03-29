import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin', label: '📊 Dashboard', end: true },
  { to: '/admin/revenue', label: '💰 Revenue' },
  { section: 'Scheduling' },
  { to: '/admin/calendar', label: '📅 Calendar' },
  { to: '/admin/availability', label: '🗓️ Availability' },
  { to: '/admin/bookings', label: '📋 Bookings' },
  { to: '/admin/booking-requests', label: '📨 Booking Requests' },
  { to: '/admin/recurring', label: '🔄 Recurring' },
  { section: 'Clients' },
  { to: '/admin/clients', label: '👥 Clients' },
  { to: '/admin/reviews', label: '⭐ Reviews' },
  { section: 'Billing' },
  { to: '/admin/estimates', label: '📝 Estimates' },
  { to: '/admin/invoices', label: '🧾 Invoices' },
  { to: '/admin/contracts', label: '📄 Contracts' },
  { section: 'Operations' },
  { to: '/admin/employees', label: '👷 Employees' },
  { to: '/admin/time-records', label: '⏱ Time Records' },
  { to: '/admin/payroll', label: '💵 Payroll' },
  { to: '/admin/gps', label: '📍 GPS Tracking' },
  { to: '/admin/routes', label: '🗺️ Route Planner' },
  { to: '/admin/documents', label: '📁 Employee Docs' },
  { section: 'Marketing' },
  { to: '/admin/emails', label: '📧 Email Blast' },
  { to: '/admin/gallery', label: '🖼️ Photo Gallery' },
  { section: 'Settings' },
  { to: '/admin/services', label: '⚙️ Services' },
  { to: '/admin/users', label: '👥 User Management' },
  { to: '/admin/settings', label: '🎨 App Settings' },
];

export default function AdminSidebar({ open }) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      {links.map((l, i) =>
        l.section ? (
          <div key={i} className="sidebar-section">{l.section}</div>
        ) : (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {l.label}
          </NavLink>
        )
      )}
    </aside>
  );
}
