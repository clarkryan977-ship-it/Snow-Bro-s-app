import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SocialLinks from './SocialLinks';

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        {user && (user.role === 'admin' || user.role === 'employee') && (
          <button className="sidebar-toggle" onClick={onMenuToggle} aria-label="Menu">
            ☰
          </button>
        )}
        <Link to="/" className="nav-brand" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <img
            src="/logo.jpg"
            alt="Snow Bro's Logo"
            style={{ height: 38, width: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }}
          />
          <span>Snow Bro's</span>
        </Link>
      </div>

      <div className="nav-links">
        {!user && (
          <>
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/book" className="nav-link">Book</Link>
            <Link to="/gallery" className="nav-link">Gallery</Link>
            <Link to="/reviews" className="nav-link">Reviews</Link>
            <Link to="/pay" className="nav-link">Pay</Link>
            <Link to="/register" className="nav-link">Sign Up</Link>
            <Link to="/login" className="nav-link">Login</Link>
            <SocialLinks dark={true} size="sm" />
          </>
        )}
        {user && user.role === 'client' && (
          <>
            <Link to="/client" className="nav-link">Dashboard</Link>
            <Link to="/client/history" className="nav-link">History</Link>
            <Link to="/client/invoices" className="nav-link">Invoices</Link>
            <Link to="/client/contracts" className="nav-link">Contracts</Link>
            <Link to="/client/recurring" className="nav-link">Recurring</Link>
            <Link to="/client/referrals" className="nav-link">Referrals</Link>
            <Link to="/client/book" className="nav-link">Book</Link>
            <Link to="/pay" className="nav-link">Pay</Link>
          </>
        )}
        {user && (
          <>
            <span style={{ color: 'rgba(255,255,255,.7)', fontSize: '.82rem' }}>
              {user.name}
            </span>
            <button className="nav-link nav-link-logout btn" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none', fontSize: '.82rem' }} onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
