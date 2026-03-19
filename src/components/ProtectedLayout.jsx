import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NavBar from './NavBar';

function ProtectedLayout({ children }) {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/" />;

  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

export default ProtectedLayout;
