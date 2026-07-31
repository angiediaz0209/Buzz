import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedLayout from './components/ProtectedLayout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CreateEvent from './pages/CreateEvent';
import EventDetails from './pages/EventDetails';
import CreateQueue from './pages/CreateQueue';
import ManageQueue from './pages/ManageQueue';
import ClientJoin from './pages/ClientJoin';
import ArtistProfile from './pages/ArtistProfile';
import CustomerView from './pages/CustomerView';
import DisplayScreen from './pages/DisplayScreen';
import FindTurn from './pages/FindTurn';
import Kiosk from './pages/Kiosk';
import SharePage from './pages/SharePage';
import Landing from './pages/Landing';

// Public Route (redirect if logged in)
function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  return !currentUser ? children : <Navigate to="/dashboard" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-center" />
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
      </Router>
    </AuthProvider>
  );
}

export default App;
