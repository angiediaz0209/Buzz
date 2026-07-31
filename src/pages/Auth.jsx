import { useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checkUsernameAvailable = async (username) => {
    const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    return !usernameDoc.exists();
  };

  const createArtistProfile = async (userId, email, username) => {
    // Create artist profile
    await setDoc(doc(db, 'artists', userId), {
      email,
      username: username.toLowerCase(),
      displayName: username,
      createdAt: new Date()
    });

    // Reserve username
    await setDoc(doc(db, 'usernames', username.toLowerCase()), {
      userId,
      createdAt: new Date()
    });
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        // Sign up - validate username
        if (!username || username.length < 3) {
          toast.error('Username must be at least 3 characters');
          setLoading(false);
          return;
        }

        // Check if username is available
        const isAvailable = await checkUsernameAvailable(username);
        if (!isAvailable) {
          toast.error('Username already taken. Please choose another.');
          setLoading(false);
          return;
        }

        // Create account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create artist profile
        await createArtistProfile(userCredential.user.uid, email, username);
        
        toast.success('Account created — welcome to Buzz!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email already in use. Try logging in!');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else if (error.code === 'auth/user-not-found') {
        toast.error('No account found. Try signing up!');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Incorrect password');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Check if artist profile exists
      const artistDoc = await getDoc(doc(db, 'artists', result.user.uid));
      
      if (!artistDoc.exists()) {
        // New user - need username
        const suggestedUsername = result.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // For now, auto-create with email-based username
        // TODO: Show username picker modal
        let finalUsername = suggestedUsername;
        let counter = 1;
        
        while (!(await checkUsernameAvailable(finalUsername))) {
          finalUsername = `${suggestedUsername}${counter}`;
          counter++;
        }
        
        await createArtistProfile(result.user.uid, result.user.email, finalUsername);
      }
      
      toast.success('Welcome to Buzz!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast.error('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-ink-900 mb-2">
            Buzz
          </h1>
          <p className="text-stone-600">
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required={!isLogin}
                  minLength={3}
                  maxLength={30}
                  className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                  placeholder="your-username"
                />
                <p className="text-xs text-stone-500 mt-1">
                  This will be your permanent link: artistline.com/{username || 'your-username'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                placeholder="artist@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-honey-500 text-ink-900 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Loading...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-cream-300"></div>
            <span className="px-4 text-sm text-stone-500">or</span>
            <div className="flex-1 border-t border-cream-300"></div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white border-2 border-cream-300 text-ink-700 py-3 rounded-lg font-semibold hover:bg-cream-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Toggle Login/Signup */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-ink-900 hover:text-ink-900 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-stone-500 mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

export default Auth;