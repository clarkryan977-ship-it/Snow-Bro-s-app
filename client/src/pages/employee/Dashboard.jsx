import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);

  useEffect(() => {
    api.get('/time/status').then(r => setStatus(r.data)).catch(() => {});
    api.get('/time/my-records').then(r => setRecentRecords(r.data.slice(0,5))).catch(() => {});
  }, []);

  const totalMins = recentRecords.reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = Math.round(totalMins % 60);

  return (
    <div>
      <div className="page-header">
        <h1>👋 Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p>Your employee dashboard.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: status?.clocked_in ? 'var(--blue-600)' : 'var(--gray-400)' }}>
            {status?.clocked_in ? '🟢 In' : '⚫ Out'}
          </div>
          <div className="stat-label">Current Status</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recentRecords.length}</div>
          <div className="stat-label">Recent Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalH}h {totalM}m</div>
          <div className="stat-label">Recent Total Hours</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'1rem' }}>
        <Link to="/employee/clock" style={{ textDecoration:'none' }}>
          <div className="card" style={{ textAlign:'center', cursor:'pointer' }}>
            <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>⏱</div>
            <div style={{ fontWeight:700 }}>Clock In / Out</div>
            <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginTop:'.25rem' }}>
              {status?.clocked_in ? 'Currently clocked in — tap to clock out' : 'Tap to clock in for your shift'}
            </div>
          </div>
        </Link>
        <Link to="/employee/jobs" style={{ textDecoration:'none' }}>
          <div className="card" style={{ textAlign:'center', cursor:'pointer' }}>
            <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>📋</div>
            <div style={{ fontWeight:700 }}>My Jobs</div>
            <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginTop:'.25rem' }}>View and edit job site details</div>
          </div>
        </Link>
        <Link to="/employee/time" style={{ textDecoration:'none' }}>
          <div className="card" style={{ textAlign:'center', cursor:'pointer' }}>
            <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>📆</div>
            <div style={{ fontWeight:700 }}>Time Records</div>
            <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginTop:'.25rem' }}>View all your hours</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
