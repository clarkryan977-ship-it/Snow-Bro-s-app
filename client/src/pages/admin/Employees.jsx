import { useState, useEffect } from 'react';
import api from '../../utils/api';

const EMPTY = { first_name:'', last_name:'', email:'', phone:'', password:'', role:'employee', active:1 };

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/employees').then(r => setEmployees(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); setMsg(null); };
  const openEdit = e  => { setForm({ ...e, password:'' }); setModal(e); setMsg(null); };
  const close    = () => { setModal(null); setMsg(null); };
  const handle   = e  => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = async e => {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      if (modal === 'add') await api.post('/employees', form);
      else await api.put(`/employees/${modal.id}`, form);
      await load(); close();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error saving');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>👷 Employees</h1><p>Manage your team.</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {employees.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No employees</td></tr>}
              {employees.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.first_name} {e.last_name}</strong></td>
                  <td>{e.email}</td>
                  <td>{e.phone}</td>
                  <td><span className={`badge ${e.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{e.role}</span></td>
                  <td><span className={`badge ${e.active ? 'badge-green' : 'badge-gray'}`}>{e.active ? 'Active' : 'Inactive'}</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => openEdit(e)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Add Employee' : 'Edit Employee'}</h2>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={save}>
                <div className="form-row">
                  <div className="form-group"><label>First Name *</label><input name="first_name" value={form.first_name} onChange={handle} required className="form-control" /></div>
                  <div className="form-group"><label>Last Name *</label><input name="last_name" value={form.last_name} onChange={handle} required className="form-control" /></div>
                </div>
                <div className="form-group"><label>Email *</label><input type="email" name="email" value={form.email} onChange={handle} required className="form-control" /></div>
                <div className="form-group"><label>Phone</label><input name="phone" value={form.phone} onChange={handle} className="form-control" /></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select name="role" value={form.role} onChange={handle} className="form-control">
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="active" value={form.active} onChange={handle} className="form-control">
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{modal === 'add' ? 'Password *' : 'New Password (leave blank to keep)'}</label>
                  <input type="password" name="password" value={form.password} onChange={handle} required={modal === 'add'} className="form-control" />
                </div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
