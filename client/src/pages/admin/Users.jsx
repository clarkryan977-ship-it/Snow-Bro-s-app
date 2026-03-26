import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const EMPTY = {
  first_name: '', last_name: '', email: '', phone: '',
  password: '', role: 'employee', title: '', active: 1
};

const ROLE_CONFIG = {
  admin:    { label: 'Admin',    badge: 'badge-red',    icon: '🔑', color: '#dc2626' },
  manager:  { label: 'Manager', badge: 'badge-purple',  icon: '⭐', color: '#7c3aed' },
  employee: { label: 'Employee', badge: 'badge-blue',   icon: '👷', color: '#2563eb' },
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/employees');
      setUsers(data);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setMsg(null); setModal('add'); };
  const openEdit = (u) => {
    setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone || '', password: '', role: u.role, title: u.title || '', active: u.active });
    setEditId(u.id); setMsg(null); setModal('edit');
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      setMsg({ type: 'error', text: 'First name, last name, and email are required.' }); return;
    }
    if (modal === 'add' && !form.password) {
      setMsg({ type: 'error', text: 'Password is required for new accounts.' }); return;
    }
    setSaving(true); setMsg(null);
    try {
      if (modal === 'add') {
        await api.post('/employees', form);
        setMsg({ type: 'success', text: 'Account created successfully.' });
      } else {
        await api.put(`/employees/${editId}`, form);
        setMsg({ type: 'success', text: 'Account updated successfully.' });
      }
      await load();
      setTimeout(() => { setModal(null); setMsg(null); }, 1200);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Save failed.' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete account for ${u.first_name} ${u.last_name}? This cannot be undone.`)) return;
    try { await api.delete(`/employees/${u.id}`); await load(); }
    catch (e) { alert(e.response?.data?.error || 'Delete failed.'); }
  };

  const handleRoleChange = async (u, newRole) => {
    if (newRole === u.role) return;
    if (!window.confirm(`Change ${u.first_name} ${u.last_name}'s role to ${newRole}?`)) return;
    try { await api.put(`/employees/${u.id}`, { ...u, role: newRole, password: '' }); await load(); }
    catch (e) { alert(e.response?.data?.error || 'Role change failed.'); }
  };

  const filtered = users.filter(u => {
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const q = search.toLowerCase();
    const matchSearch = !q || `${u.first_name} ${u.last_name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const counts = {
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    manager: users.filter(u => u.role === 'manager').length,
    employee: users.filter(u => u.role === 'employee').length,
  };

  return (
    <div className="container" style={{ maxWidth: 960, padding: '1.25rem 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>👥 User Management</h1>
          <p style={{ margin: '.25rem 0 0', color: 'var(--gray-500)', fontSize: '.88rem' }}>Manage all staff accounts — admins, managers, and employees.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} style={{ whiteSpace: 'nowrap' }}>+ Add Account</button>
      </div>

      {/* Info banner */}
      <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-200)', borderRadius: 'var(--radius)', padding: '.65rem .9rem', marginBottom: '1rem', fontSize: '.82rem', color: 'var(--blue-800)' }}>
        <strong>⭐ Manager Role:</strong> Managers have full access to all admin features. Only admins can create admin accounts or delete accounts.
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all','All'], ['admin','Admins'], ['manager','Managers'], ['employee','Employees']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterRole(val)} style={{
            padding: '.35rem .8rem', borderRadius: 20, border: '1.5px solid',
            borderColor: filterRole === val ? 'var(--blue-600)' : 'var(--gray-200)',
            background: filterRole === val ? 'var(--blue-600)' : '#fff',
            color: filterRole === val ? '#fff' : 'var(--gray-600)',
            fontWeight: 600, fontSize: '.78rem', cursor: 'pointer', flexShrink: 0
          }}>
            {label} <span style={{ opacity: .7 }}>({counts[val]})</span>
          </button>
        ))}
        <input
          className="form-control"
          style={{ flex: '1 1 160px', minWidth: 0, fontSize: '.85rem' }}
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* User cards (mobile-first) */}
      {loading ? (
        <div className="text-center" style={{ padding: '3rem' }}><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center" style={{ padding: '2.5rem', color: 'var(--gray-400)' }}>No accounts found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {filtered.map(u => {
            const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.employee;
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="card" style={{ padding: '1rem', borderLeft: `4px solid ${rc.color}` }}>
                {/* Top row: name + status badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>
                      {u.first_name} {u.last_name}
                      {isSelf && <span style={{ marginLeft: '.4rem', fontSize: '.72rem', color: 'var(--blue-500)', fontWeight: 600 }}>(you)</span>}
                    </div>
                    {u.title && <div style={{ fontSize: '.8rem', color: 'var(--gray-500)', marginTop: '.1rem' }}>{u.title}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${rc.badge}`}>{rc.icon} {rc.label}</span>
                    <span className={`badge ${u.active ? 'badge-green' : 'badge-gray'}`}>{u.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                {/* Contact info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem .75rem', marginBottom: '.75rem' }}>
                  <span style={{ fontSize: '.83rem', color: 'var(--gray-600)' }}>✉️ {u.email}</span>
                  {u.phone && <span style={{ fontSize: '.83rem', color: 'var(--gray-500)' }}>📱 {u.phone}</span>}
                </div>

                {/* Bottom row: role changer + action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
                  {/* Quick role change (admin only, not self) */}
                  {currentUser?.role === 'admin' && !isSelf ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <span style={{ fontSize: '.75rem', color: 'var(--gray-400)', fontWeight: 600 }}>ROLE:</span>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u, e.target.value)}
                        style={{ fontSize: '.8rem', padding: '3px 6px', borderRadius: 6, border: '1px solid var(--gray-200)', color: 'var(--gray-700)', cursor: 'pointer', background: '#fff' }}
                      >
                        <option value="employee">👷 Employee</option>
                        <option value="manager">⭐ Manager</option>
                        <option value="admin">🔑 Admin</option>
                      </select>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️ Edit</button>
                    {currentUser?.role === 'admin' && !isSelf && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                        onClick={() => handleDelete(u)}
                      >
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 520, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? '+ Add Account' : '✏️ Edit Account'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>First Name *</label>
                  <input className="form-control" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input className="form-control" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Phone</label>
                  <input className="form-control" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="218-000-0000" />
                </div>
                <div className="form-group">
                  <label>Title / Position</label>
                  <input className="form-control" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Operations Manager" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Role *</label>
                  <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="employee">👷 Employee</option>
                    <option value="manager">⭐ Manager (full admin access)</option>
                    {currentUser?.role === 'admin' && <option value="admin">🔑 Admin</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={form.active} onChange={e => setForm(f => ({ ...f, active: parseInt(e.target.value) }))}>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>
                  {modal === 'add' ? 'Password *' : 'New Password'}
                  {modal === 'edit' && <span style={{ fontSize: '.78rem', color: 'var(--gray-400)', marginLeft: '.4rem' }}>(leave blank to keep current)</span>}
                </label>
                <input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={modal === 'add' ? 'Set a password' : 'Leave blank to keep current'} />
              </div>

              {form.role === 'manager' && (
                <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-200)', borderRadius: 'var(--radius)', padding: '.75rem', fontSize: '.82rem', color: 'var(--blue-800)' }}>
                  ⭐ <strong>Manager accounts</strong> have access to all admin features: dashboard, clients, bookings, invoices, estimates, contracts, employees, GPS tracking, email blasts, and more.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : (modal === 'add' ? 'Create Account' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
