import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

type Props = { children: React.ReactNode };

export default function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setMessage(error.message);
  };

  const signInWithMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setMessage(error.message);
    else setMessage('Check your email for the login link.');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 380, border: '1px solid #e2e2e2', borderRadius: 12, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>CryptoSage</h2>
          <p>Sign in to continue</p>
          <button onClick={signInWithGoogle} style={{ width: '100%', padding: '10px 14px', marginBottom: 12 }}>Continue with Google</button>
          <form onSubmit={signInWithMagicLink} style={{ display: 'flex', gap: 8 }}>
            <input type="email" placeholder="Email for magic link" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, padding: '10px 12px' }} required />
            <button type="submit">Send</button>
          </form>
          {message && <p style={{ color: '#666', marginTop: 12 }}>{message}</p>}
          <p style={{ fontSize: 12, color: '#888' }}>We use Supabase Auth. Your data remains private to your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: 8, background: '#fafafa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
        <span>Signed in</span>
        <button onClick={signOut}>Sign out</button>
      </div>
      {children}
    </div>
  );
}

export async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}


