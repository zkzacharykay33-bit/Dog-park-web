import { useState } from 'react';
import { supabase } from './supabase';

export default function Login({ appName }) {
  const [mode, setMode] = useState('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const isSignUp = mode === 'signUp';

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ error: true, text: 'Use a password with at least 6 characters.' });
      return;
    }
    setBusy(true);
    const creds = { email: email.trim(), password };
    const { data, error } = isSignUp
      ? await supabase.auth.signUp({
          ...creds,
          options: { data: { display_name: name.trim() || 'Dog Owner' }, emailRedirectTo: window.location.origin },
        })
      : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) setMessage({ error: true, text: error.message });
    else if (isSignUp && !data.session) {
      setMessage({ error: false, text: 'Check your email to confirm your account, then sign in.' });
      setMode('signIn');
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">{appName}</div>
        <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">
          {isSignUp ? 'Find dog parks, see who’s there, and meet up.' : 'Sign in to see who’s at the park.'}
        </p>
        {isSignUp && (
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} />
        </div>
        {message && <p className={message.error ? 'error' : 'muted'} role="status">{message.text}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
        <button type="button" className="link-btn"
          onClick={() => { setMode(isSignUp ? 'signIn' : 'signUp'); setMessage(null); }}>
          {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}
