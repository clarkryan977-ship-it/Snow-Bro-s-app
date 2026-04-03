import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AdminSidebar from './components/AdminSidebar';
import EmployeeSidebar from './components/EmployeeSidebar';

// ── Lazy-loaded page components (code splitting) ──
// Public pages
const Home = lazy(() => import('./pages/Home'));
const BookService = lazy(() => import('./pages/BookService'));
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const Pay = lazy(() => import('./pages/Pay'));
const Gallery = lazy(() => import('./pages/Gallery'));
const PublicReviews = lazy(() => import('./pages/Reviews'));
// const ETALookup = lazy(() => import('./pages/ETALookup'));
const BookRequest = lazy(() => import('./pages/BookRequest'));
const SignContract = lazy(() => import('./pages/SignContract'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PortalSetup = lazy(() => import('./pages/PortalSetup'));
const Apply = lazy(() => import('./pages/Apply'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminClients = lazy(() => import('./pages/admin/Clients'));
const AdminBookings = lazy(() => import('./pages/admin/Bookings'));
const AdminInvoices = lazy(() => import('./pages/admin/Invoices'));
const AdminContracts = lazy(() => import('./pages/admin/Contracts'));
const AdminEmployees = lazy(() => import('./pages/admin/Employees'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminTimeRecords = lazy(() => import('./pages/admin/TimeRecords'));
const AdminGPS = lazy(() => import('./pages/admin/GPS'));
const AdminEmails = lazy(() => import('./pages/admin/Emails'));
const AdminServices = lazy(() => import('./pages/admin/Services'));
const AdminEstimates = lazy(() => import('./pages/admin/Estimates'));
const AdminGallery = lazy(() => import('./pages/admin/Gallery'));
const AdminRevenue = lazy(() => import('./pages/admin/Revenue'));
const AdminCalendar = lazy(() => import('./pages/admin/Calendar'));
const AdminRecurring = lazy(() => import('./pages/admin/Recurring'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminRoutePlanner = lazy(() => import('./pages/admin/RoutePlanner'));
const AdminRouteHistory = lazy(() => import('./pages/admin/RouteHistory'));
const AdminPayroll = lazy(() => import('./pages/admin/Payroll'));
const AdminAvailabilityCalendar = lazy(() => import('./pages/admin/AvailabilityCalendar'));
const AdminEmployeeDocuments = lazy(() => import('./pages/admin/EmployeeDocuments'));
const AdminBookingRequests = lazy(() => import('./pages/admin/BookingRequests'));
const AdminApplications = lazy(() => import('./pages/admin/Applications'));
const AdminTouchUpRequests = lazy(() => import('./pages/admin/TouchUpRequests'));

// Employee pages
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const ClockInOut = lazy(() => import('./pages/employee/ClockInOut'));
const EmployeeJobs = lazy(() => import('./pages/employee/Jobs'));
const EmployeeTimeRecords = lazy(() => import('./pages/employee/TimeRecords'));
const EmployeeAssignedJobs = lazy(() => import('./pages/employee/AssignedJobs'));
const EmployeeNotifications = lazy(() => import('./pages/employee/Notifications'));
const EmployeeMyDocuments = lazy(() => import('./pages/employee/MyDocuments'));

// Client pages
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'));
const ClientContracts = lazy(() => import('./pages/client/Contracts'));
const ClientInvoices = lazy(() => import('./pages/client/Invoices'));
const ClientServiceHistory = lazy(() => import('./pages/client/ServiceHistory'));
const ClientReferrals = lazy(() => import('./pages/client/Referrals'));
const ClientRecurringServices = lazy(() => import('./pages/client/RecurringServices'));
const ClientBookService = lazy(() => import('./pages/client/BookService'));

// ── Loading spinner for lazy components ──
function PageLoader() {
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh' }}>
      <div style={{
        width: 40, height: 40,
        border: '4px solid #e2e8f0',
        borderTop: '4px solid #1e40af',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
    </div>
  );
}

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      {sidebarOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', zIndex:150 }}
          onClick={() => setSidebarOpen(false)} />
      )}
      <div className="layout">
        <AdminSidebar open={sidebarOpen} />
        <main className="main-content" onClick={() => setSidebarOpen(false)}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </>
  );
}

function EmployeeLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      {sidebarOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', zIndex:150 }}
          onClick={() => setSidebarOpen(false)} />
      )}
      <div className="layout">
        <EmployeeSidebar open={sidebarOpen} />
        <main className="main-content" onClick={() => setSidebarOpen(false)}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </>
  );
}

function ClientLayout() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

function PublicLayout() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

// Allows admin OR manager roles into the admin area
function RequireAdminOrManager() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/" replace />;
  return <Outlet />;
}

// Role check — allows the specified role OR admin/manager (used for employee portal)
function RequireRole({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = [role, 'admin', 'manager'];
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<BookService />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pay" element={<Pay />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/reviews" element={<PublicReviews />} />
            {/* <Route path="/eta" element={<ETALookup />} /> */}
            <Route path="/sign-contract/:token" element={<SignContract />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/portal-setup/:token" element={<PortalSetup />} />
            <Route path="/book-request" element={<BookRequest />} />
            <Route path="/apply" element={<Apply />} />
          </Route>

          {/* Admin + Manager routes */}
          <Route element={<RequireAdminOrManager />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/clients" element={<AdminClients />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
              <Route path="/admin/invoices" element={<AdminInvoices />} />
              <Route path="/admin/contracts" element={<AdminContracts />} />
              <Route path="/admin/employees" element={<AdminEmployees />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/time-records" element={<AdminTimeRecords />} />
              <Route path="/admin/gps" element={<AdminGPS />} />
              <Route path="/admin/emails" element={<AdminEmails />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/estimates" element={<AdminEstimates />} />
              <Route path="/admin/gallery" element={<AdminGallery />} />
              <Route path="/admin/revenue" element={<AdminRevenue />} />
              <Route path="/admin/calendar" element={<AdminCalendar />} />
              <Route path="/admin/recurring" element={<AdminRecurring />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/routes" element={<AdminRoutePlanner />} />
              <Route path="/admin/route-history" element={<AdminRouteHistory />} />
              <Route path="/admin/payroll" element={<AdminPayroll />} />
              <Route path="/admin/availability" element={<AdminAvailabilityCalendar />} />
              <Route path="/admin/documents" element={<AdminEmployeeDocuments />} />
              <Route path="/admin/booking-requests" element={<AdminBookingRequests />} />
              <Route path="/admin/applications" element={<AdminApplications />} />
              <Route path="/admin/touchup" element={<AdminTouchUpRequests />} />
            </Route>
          </Route>

          {/* Employee routes */}
          <Route element={<RequireRole role="employee" />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee" element={<EmployeeDashboard />} />
              <Route path="/employee/clock" element={<ClockInOut />} />
              <Route path="/employee/jobs" element={<EmployeeJobs />} />
              <Route path="/employee/time" element={<EmployeeTimeRecords />} />
              <Route path="/employee/assigned" element={<EmployeeAssignedJobs />} />
              <Route path="/employee/notifications" element={<EmployeeNotifications />} />
              <Route path="/employee/documents" element={<EmployeeMyDocuments />} />
            </Route>
          </Route>

          {/* Client routes */}
          <Route element={<RequireAuth />}>
            <Route element={<ClientLayout />}>
              <Route path="/client" element={<ClientDashboard />} />
              <Route path="/client/contracts" element={<ClientContracts />} />
              <Route path="/client/invoices" element={<ClientInvoices />} />
              <Route path="/client/history" element={<ClientServiceHistory />} />
              <Route path="/client/referrals" element={<ClientReferrals />} />
              <Route path="/client/recurring" element={<ClientRecurringServices />} />
              <Route path="/client/book" element={<ClientBookService />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
