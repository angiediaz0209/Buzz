import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ROUTER_BASE } from './utils/urls';
import ProtectedLayout from './components/ProtectedLayout';

// Client-facing screens stay in the main bundle. These are what someone scans a
// code to reach, on venue wifi, and they must not wait on a second download.
import ClientJoin from './pages/ClientJoin';
import ArtistProfile from './pages/ArtistProfile';
import CustomerView from './pages/CustomerView';
import FindTurn from './pages/FindTurn';

// Artist-only screens load on demand. A client joining a line was downloading
// the dashboard, event editor, queue manager and QR/share page — none of which
// they can even open.
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateEvent = lazy(() => import('./pages/CreateEvent'));
const EventDetails = lazy(() => import('./pages/EventDetails'));
const CreateQueue = lazy(() => import('./pages/CreateQueue'));
const ManageQueue = lazy(() => import('./pages/ManageQueue'));
const DisplayScreen = lazy(() => import('./pages/DisplayScreen'));
const Kiosk = lazy(() => import('./pages/Kiosk'));
const SharePage = lazy(() => import('./pages/SharePage'));
const Landing = lazy(() => import('./pages/Landing'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-honey-500" />
    </div>
  );
}

// Public Route (redirect if logged in)
function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  return !currentUser ? children : <Navigate to="/dashboard" />;
}

function App() {
  return (
    <AuthProvider>
      <Router basename={ROUTER_BASE}>
        <Toaster position="top-center" />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/kiosk/:eventId" element={<Kiosk />} />
          <Route path="/kiosk/:eventId/:queueId" element={<Kiosk />} />
          <Route path="/event/:eventId/find" element={<FindTurn />} />
          <Route path="/display/:eventId" element={<DisplayScreen />} />
          <Route path="/customer/:customerId" element={<CustomerView />} />
          <Route path="/artist/:username" element={<ArtistProfile />} />
          <Route path="/join/:eventId" element={<ClientJoin />} />
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          } />

          {/* Protected routes with nav bar */}
          <Route path="/dashboard" element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          } />
          <Route path="/share" element={
            <ProtectedLayout>
              <SharePage />
            </ProtectedLayout>
          } />
          <Route path="/create-event" element={
            <ProtectedLayout>
              <CreateEvent />
            </ProtectedLayout>
          } />
          <Route path="/event/:eventId" element={
            <ProtectedLayout>
              <EventDetails />
            </ProtectedLayout>
          } />
          <Route path="/event/:eventId/create-queue" element={
            <ProtectedLayout>
              <CreateQueue />
            </ProtectedLayout>
          } />
          <Route path="/queue/:queueId/manage" element={
            <ProtectedLayout>
              <ManageQueue />
            </ProtectedLayout>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
