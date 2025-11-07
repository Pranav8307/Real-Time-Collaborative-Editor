import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import './App.css';

// Lazy load components
const Login = lazy(() => import('./components/Login'));
const DocumentList = lazy(() => import('./components/DocumentList'));
const Editor = lazy(() => import('./components/Editor'));
const Profile = lazy(() => import('./components/Profile'));

// Loading fallback
const LoadingFallback = () => (
  <div className="app-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

function App() {
  const { checkAuth, isAuthenticated, isLoading } = useAuthStore();
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('App mounted, checking auth...');
    checkAuth().catch((error) => {
      console.error('Auth check failed:', error);
      setError(error.message);
    });
  }, []);

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#c33' }}>Error</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  console.log('Rendering app, isAuthenticated:', isAuthenticated);

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/"
            element={
              isAuthenticated ? <DocumentList /> : <Navigate to="/login" replace />
            }
          />
        <Route
          path="/documents/:id"
          element={
            isAuthenticated ? <Editor /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/profile"
          element={
            isAuthenticated ? <Profile /> : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

