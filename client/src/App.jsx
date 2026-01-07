import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

// Normalizes the API base URL so fetch calls can safely concatenate paths.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api').replace(
  /\/$/,
  '',
);

// Canonical shapes for form and auth state so resets stay consistent.
const initialFormState = {
  name: '',
  color: '',
  price: '',
};

const initialAuthState = {
  token: '',
  user: null,
  expiresAt: null,
};

const STORAGE_KEY = 'flowershop_auth';

// Hydrates previously stored login information from localStorage across reloads.
const readStoredAuth = () => {
  if (typeof window === 'undefined') {
    return initialAuthState;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : initialAuthState;
  } catch {
    return initialAuthState;
  }
};

function App() {
  // Application state split by concerns (inventory, auth, login form UX, etc.).
  const [flowers, setFlowers] = useState([]);
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Derived helpers let render logic stay readable.
  const isAuthenticated = Boolean(auth.token);
  const hasFlowers = useMemo(() => flowers.length > 0, [flowers]);

  // Syncs auth details to localStorage whenever login/logout happens.
  const persistAuth = useCallback((payload) => {
    setAuth(payload);
    if (typeof window === 'undefined') {
      return;
    }
    if (payload && payload.token) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearAuth = useCallback(() => {
    // Resetting also wipes the cached flowers so stale data never flashes.
    persistAuth(initialAuthState);
    setFlowers([]);
  }, [persistAuth]);

  // Pulls the latest flowers list for authenticated users.
  const fetchFlowers = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/flowers`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });
      if (response.status === 401) {
        clearAuth();
        throw new Error('Session expired. Please log in again.');
      }
      if (!response.ok) {
        throw new Error('Unable to load flowers from the API');
      }
      const data = await response.json();
      setFlowers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token, clearAuth]);

  useEffect(() => {
    // Whenever the token changes (login/logout), re-query the backend.
    if (auth.token) {
      fetchFlowers();
    } else {
      setLoading(false);
    }
  }, [auth.token, fetchFlowers]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handles create-flower submissions after validating price/name fields.
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!auth.token) {
      setError('Please login before adding flowers.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/flowers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          color: form.color.trim(),
          price: Number(form.price),
        }),
      });
      const payloadText = await response.text();
      let payload;
      try {
        payload = payloadText ? JSON.parse(payloadText) : null;
      } catch {
        payload = null;
      }
      if (response.status === 401) {
        clearAuth();
        throw new Error('Session expired. Please log in again.');
      }
      if (!response.ok) {
        const message =
          (payload && payload.message) || payloadText || 'Unable to add flower. Check the API.';
        throw new Error(message);
      }
      const inserted = payload;
      setFlowers((prev) => [inserted, ...prev]);
      setForm(initialFormState);
      setMessage(`Added ${inserted.name}!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  // Validates credentials client-side, then hits the /auth/login endpoint.
  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');

    const email = loginForm.email.trim();
    const password = loginForm.password;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError('Enter a valid email address.');
      return;
    }

    if (password.trim().length < 8) {
      setLoginError('Password must be at least 8 characters.');
      return;
    }

    setLoginLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Unable to login. Check your credentials.');
      }

      const nextAuth = {
        token: data.token,
        user: data.user,
        expiresAt: data.expiresAt,
      };
      persistAuth(nextAuth);
      setLoginForm({ email: '', password: '' });
      setMessage('Logged in successfully.');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setMessage('');
    setError('');
  };

  if (!isAuthenticated) {
    // Logged-out view focuses solely on credential entry.
    return (
      <main className="auth-screen">
        <section className="login-panel">
          <h1>Sign in to manage the catalog</h1>
          <p className="subtitle">
            Use the credentials configured in the backend (see README or .env defaults).
          </p>
          <form onSubmit={handleLoginSubmit} className="panel-form">
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="Admin@helfy.com"
                autoComplete="username"
                value={loginForm.email}
                onChange={handleLoginChange}
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={8}
                placeholder="••••••••"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={handleLoginChange}
                required
              />
            </label>
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? 'Signing in...' : 'Login'}
            </button>
            {loginError && <p className="message error">{loginError}</p>}
          </form>
        </section>
      </main>
    );
  }

  // Authenticated view shows catalog management UI.
  return (
    <main className="app">
      <header>
        <p className="eyebrow">TiDB powered</p>
        <h1>Flowershop Catalog</h1>
        <p className="subtitle">
          Simple React UI backed by a Node + Express REST API that reads and writes to TiDB.
        </p>
        <div className="user-banner">
          <div>
            <p className="user-name">{auth.user?.display_name}</p>
            <p className="user-email">{auth.user?.email}</p>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="panels">
        <article className="panel">
          <div className="panel-header">
            <h2>Add a flower</h2>
            <p>Use the form to create a new record in TiDB.</p>
          </div>
          <form className="panel-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input
                name="name"
                type="text"
                minLength={2}
                placeholder="Peony"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Color
              <input
                name="color"
                type="text"
                minLength={2}
                placeholder="Pink"
                value={form.color}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Price (USD)
              <input
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="12.50"
                value={form.price}
                onChange={handleChange}
                required
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save to TiDB'}
            </button>
            {message && <p className="message success">{message}</p>}
          </form>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Inventory</h2>
            <p>Records stored in TiDB appear here instantly.</p>
          </div>

          {loading && <p className="info">Loading flowers...</p>}
          {error && <p className="message error">{error}</p>}
          {!loading && !hasFlowers && !error && (
            <p className="info">No flowers yet. Add your first item on the left.</p>
          )}
          <ul className="list">
            {flowers.map((flower) => (
              <li key={flower.id} className="list-row">
                <div>
                  <p className="row-title">{flower.name}</p>
                  <p className="row-meta">
                    {flower.color} · ${Number(flower.price).toFixed(2)}
                  </p>
                </div>
                <p className="row-date">
                  {new Date(flower.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}

export default App;
