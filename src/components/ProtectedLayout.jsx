import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NavBar from './NavBar';

function ProtectedLayout({ children }) {
  const { currentUser } = useAuth();

  // Straight to the login form — they were trying to reach the app, not the pitch
  if (!currentUser) return <Navigate to="/login" />;

  return (
    <>
      <NavBar />
      {/* Bottom padding clears the mobile tab bar, including the iPhone home bar.
          Arbitrary value rather than an inline style so md:pb-0 can still win. */}
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
    </>
  );
}

export default ProtectedLayout;
