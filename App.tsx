import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Activity, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, Clock3, Cross, FileHeart, HeartPulse, Hospital, LockKeyhole, LogOut, MapPin, Menu, Moon, ShieldCheck, Stethoscope, Sun, UserRound, Users, X } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';

type AuthMode = 'signin' | 'signup' | 'reset';
type HospitalItem = { name: string; address: string; mapsUrl: string };

function getGoogleMapsUrl(query: string, lat?: number, lng?: number) {
  const q = lat != null && lng != null ? `hospitals near ${lat},${lng}` : query || 'hospitals near me';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [dark, setDark] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [nearbyUrl, setNearbyUrl] = useState(getGoogleMapsUrl('hospitals near me'));
  const [nearbyTitle, setNearbyTitle] = useState('Hospitals near you');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    let alive = true;
    Promise.all([
      supabase.from('appointments').select('id,starts_at,status,reason,doctors(full_name,hospitals(name))').order('starts_at', { ascending: true }).limit(5),
      supabase.from('health_records').select('id,title,record_type,created_at').order('created_at', { ascending: false }).limit(5)
    ]).then(([a, r]) => {
      if (!alive) return;
      setAppointments(a.data ?? []); setRecords(r.data ?? []);
    });
    return () => { alive = false; };
  }, [session]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    if (!supabase) { setError('Authentication is not configured yet. Add your Supabase URL and anon/publishable key to .env.local.'); return; }
    setAuthBusy(true);
    try {
      if (authMode === 'reset') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
        if (e) throw e;
        setMessage('Password reset email requested. Check your inbox and spam folder.');
      } else if (authMode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin } });
        if (e) throw e;
        if (data.session) setMessage('Account created successfully.');
        else setMessage('Account request submitted. Check your email to confirm your account before signing in.');
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        setShowAuth(false); setMessage('Signed in successfully.');
      }
    } catch (e: any) {
      const raw = String(e?.message || 'Authentication failed.');
      setError(raw.toLowerCase().includes('invalid login credentials') ? 'Email or password is incorrect. If you have not registered on this Supabase project, create an account first.' : raw);
    } finally { setAuthBusy(false); }
  }

  async function googleSignIn() {
    setError(''); setMessage('');
    if (!supabase) { setError('Google Sign-In needs Supabase configuration first. Add .env.local values and enable Google in Supabase Authentication → Providers.'); return; }
    setAuthBusy(true);
    try {
      const { error: e } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
      if (e) throw e;
    } catch (e: any) { setError(e?.message || 'Google sign-in could not start. Check Supabase Google provider settings.'); setAuthBusy(false); }
  }

  async function signOut() { if (supabase) await supabase.auth.signOut(); setSession(null); setMessage('You have signed out.'); }

  function findNearbyHospitals() {
    setNearbyError(''); setNearbyLoading(true);
    if (!navigator.geolocation) {
      setNearbyUrl(getGoogleMapsUrl('hospitals near me')); setNearbyTitle('Search hospitals on Google Maps');
      setNearbyError('Location is not supported by this browser. You can still search hospitals manually in Google Maps.'); setNearbyLoading(false); return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setNearbyUrl(getGoogleMapsUrl('', latitude, longitude)); setNearbyTitle('Hospitals near your current location'); setNearbyLoading(false);
    }, (err) => {
      setNearbyUrl(getGoogleMapsUrl('hospitals near me')); setNearbyTitle('Search hospitals on Google Maps');
      setNearbyError(err.code === 1 ? 'Location permission was denied. Allow location access in your browser, or search manually.' : 'Could not get your location. Try again or search manually.'); setNearbyLoading(false);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
  }

  const userName = session?.user.user_metadata?.full_name || session?.user.email?.split('@')[0] || 'there';
  const navItems = [{ name: 'Overview', icon: Activity }, { name: 'Appointments', icon: CalendarDays }, { name: 'Health records', icon: FileHeart }, { name: 'Nearby hospitals', icon: Hospital }, { name: 'Care guidance', icon: HeartPulse }];

  return <div className={dark ? 'app dark' : 'app light'}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <button className="brand" onClick={() => setActiveTab('Overview')} aria-label="MediBridge home"><span className="brand-mark"><Cross size={22}/></span><span><b>MediBridge</b><small>CARE, CONNECTED.</small></span></button>
      <nav className="desktop-nav">{navItems.slice(0, 4).map(n => <button key={n.name} className={activeTab === n.name ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab(n.name)}>{n.name}</button>)}</nav>
      <div className="top-actions"><button className="icon-btn" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>{session ? <><span className="user-chip"><span className="avatar">{userName[0]?.toUpperCase()}</span><span className="user-chip-name">{userName}</span></span><button className="icon-btn" title="Sign out" onClick={signOut}><LogOut size={18}/></button></> : <button className="button button-small" onClick={() => setShowAuth(true)}>Sign in <ArrowUpRight size={15}/></button>}</div>
    </header>

    <main className="main-shell">
      <section className="hero-grid">
        <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> YOUR HEALTH, IN ONE PLACE</div><h1>Better care starts<br/>with <span className="gradient-text">connection.</span></h1><p className="hero-lede">A calmer, simpler way to organize your health, connect with care teams, and find nearby hospitals when you need them.</p><div className="hero-actions"><button className="button button-primary" onClick={() => session ? setActiveTab('Overview') : setShowAuth(true)}>{session ? 'Open your dashboard' : 'Get started'} <ChevronRight size={17}/></button><button className="button button-ghost" onClick={findNearbyHospitals}><MapPin size={16}/> Find nearby hospitals</button></div><div className="trust-line"><ShieldCheck size={16}/><span>Privacy-first by design</span><span className="trust-separator">·</span><span>No AI diagnosis</span></div></div>
        <div className="hero-visual" aria-label="Decorative 3D healthcare orb"><div className="orb-halo halo-a"/><div className="orb-halo halo-b"/><div className="orb"><div className="orb-core"><HeartPulse size={54} strokeWidth={1.3}/></div><div className="orb-shine"/></div><div className="float-card float-card-top"><span className="float-icon teal"><ShieldCheck size={17}/></span><span><b>Care, secured</b><small>Your data stays yours</small></span><CheckCircle2 size={17} className="success-icon"/></div><div className="float-card float-card-bottom"><span className="float-icon violet"><MapPin size={17}/></span><span><b>Care within reach</b><small>Discover nearby hospitals</small></span></div><div className="visual-caption">CARE THAT MOVES WITH YOU <span>✳</span></div></div>
      </section>

      {!supabaseConfigured && <div className="setup-alert"><LockKeyhole size={19}/><div><b>Setup needed to enable accounts</b><p>Add your Supabase URL and anon/publishable key to <code>.env.local</code>. See README for exact steps. The UI works in demo mode, but real sign-in requires configuration.</p></div><button className="alert-close" onClick={(e) => (e.currentTarget.parentElement as HTMLElement).style.display='none'}><X size={16}/></button></div>}
      {message && <div className="notice success-notice"><CheckCircle2 size={18}/>{message}<button onClick={() => setMessage('')}><X size={15}/></button></div>}
      {error && !showAuth && <div className="notice error-notice">{error}<button onClick={() => setError('')}><X size={15}/></button></div>}

      <section className="feature-section"><div className="section-heading"><div><div className="eyebrow">THE CARE TOOLKIT</div><h2>Everything important.<br/><span className="muted-heading">Nothing overwhelming.</span></h2></div><p>Tools that help you stay organized and make more informed decisions about your care.</p></div>
        <div className="feature-grid">
          <button className="feature-card feature-featured" onClick={() => { setActiveTab('Nearby hospitals'); findNearbyHospitals(); }}><div className="feature-icon icon-teal"><Hospital size={22}/></div><span className="feature-tag">LOCATION AWARE</span><h3>Find nearby hospitals</h3><p>Use your location to open a nearby-hospital search in Google Maps, or search by area.</p><span className="feature-link">Find care <ArrowUpRight size={15}/></span><div className="card-orbit"><div/><div/><div/></div></button>
          <button className="feature-card" onClick={() => session ? setActiveTab('Appointments') : setShowAuth(true)}><div className="feature-icon icon-violet"><CalendarDays size={22}/></div><h3>Appointments</h3><p>Keep upcoming visits and care plans organized in one place.</p><span className="feature-link">Manage visits <ArrowUpRight size={15}/></span></button>
          <button className="feature-card" onClick={() => session ? setActiveTab('Health records') : setShowAuth(true)}><div className="feature-icon icon-blue"><FileHeart size={22}/></div><h3>Health records</h3><p>Access your personal records and key health information securely.</p><span className="feature-link">View records <ArrowUpRight size={15}/></span></button>
          <button className="feature-card" onClick={() => setActiveTab('Care guidance')}><div className="feature-icon icon-pink"><HeartPulse size={22}/></div><h3>Everyday care guidance</h3><p>Read general prevention and wellness information. Not a diagnosis or a substitute for a clinician.</p><span className="feature-link">Explore guidance <ArrowUpRight size={15}/></span></button>
        </div>
      </section>

      <section className="dashboard-section"><div className="section-heading compact"><div><div className="eyebrow">YOUR PERSONAL SPACE</div><h2>{session ? `Welcome back, ${userName}.` : 'Your care, organized.'}</h2></div>{session ? <span className="secure-pill"><LockKeyhole size={13}/> Private dashboard</span> : <button className="text-button" onClick={() => setShowAuth(true)}>Sign in to personalize <ArrowUpRight size={15}/></button>}</div>
        <div className="dashboard-grid"><div className="panel panel-wide"><div className="panel-title"><div className="panel-icon"><CalendarDays size={18}/></div><div><h3>Upcoming appointments</h3><p>{session ? 'Your next visits' : 'Sign in to see your appointments'}</p></div><button className="panel-action" onClick={() => session ? setActiveTab('Appointments') : setShowAuth(true)}><ArrowUpRight size={17}/></button></div>{session && appointments.length ? appointments.map((a) => <div className="list-row" key={a.id}><div className="date-tile"><b>{new Date(a.starts_at).getDate()}</b><small>{new Date(a.starts_at).toLocaleString('en',{month:'short'})}</small></div><div className="row-main"><b>{a.doctors?.full_name || 'Care appointment'}</b><small>{a.doctors?.hospitals?.name || a.reason || 'Appointment'}</small></div><span className="status-pill">{a.status || 'Scheduled'}</span></div>) : <div className="empty-state"><div className="empty-icon"><Clock3 size={22}/></div><b>{session ? 'No appointments yet' : 'A little more peace of mind'}</b><p>{session ? 'Your scheduled visits will appear here.' : 'Sign in to keep appointments and important health details together.'}</p>{!session && <button className="text-button" onClick={() => setShowAuth(true)}>Sign in <ChevronRight size={15}/></button>}</div>}</div>
          <div className="panel"><div className="panel-title"><div className="panel-icon"><FileHeart size={18}/></div><div><h3>Recent health records</h3><p>Private and organized</p></div></div>{session && records.length ? records.map(r => <div className="record-row" key={r.id}><div className="record-icon"><FileHeart size={16}/></div><div className="row-main"><b>{r.title}</b><small>{r.record_type || 'Health record'}</small></div></div>) : <div className="record-empty"><div className="record-illustration"><FileHeart size={29}/></div><b>{session ? 'No records added' : 'Your records, together'}</b><p>Keep important documents accessible when you need them.</p><button className="text-button" onClick={() => session ? setActiveTab('Health records') : setShowAuth(true)}>{session ? 'Open records' : 'Get started'} <ChevronRight size={15}/></button></div>}</div></div>
      </section>

      <section className="nearby-banner"><div className="nearby-symbol"><MapPin size={24}/><span/></div><div className="nearby-copy"><div className="eyebrow">WHEN EVERY MINUTE MATTERS</div><h2>{nearbyTitle}</h2><p>Share your location only when you choose. Results open in Google Maps; availability and directions are provided by Google.</p>{nearbyError && <p className="inline-error">{nearbyError}</p>}</div><div className="nearby-actions"><button className="button button-primary" disabled={nearbyLoading} onClick={findNearbyHospitals}>{nearbyLoading ? 'Finding location…' : 'Use my location'} <MapPin size={16}/></button><a className="button button-ghost" href={nearbyUrl} target="_blank" rel="noreferrer">Open Google Maps <ArrowUpRight size={15}/></a></div></section>

      <section className="safety-strip"><div className="safety-icon"><ShieldCheck size={20}/></div><div><b>Your health deserves careful handling.</b><p>MediBridge is a care-organization tool, not a diagnostic service. For emergencies in India, call <strong>112</strong> or go to the nearest emergency department.</p></div><div className="safety-badge">PATIENT-FIRST</div></section>
      <footer className="footer"><div className="footer-brand"><span className="brand-mark small-mark"><Cross size={15}/></span><b>MediBridge Care</b></div><span>Care connected. Access simplified.</span><span>Built with privacy and accessibility in mind.</span></footer>
    </main>

    {showAuth && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowAuth(false); setError(''); } }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => { setShowAuth(false); setError(''); }} aria-label="Close"><X size={19}/></button><div className="auth-logo"><span className="brand-mark"><Cross size={20}/></span></div><div className="eyebrow">WELCOME TO MEDIBRIDGE</div><h2 id="auth-title">{authMode === 'signup' ? 'Create your account.' : authMode === 'reset' ? 'Reset your password.' : 'Good to see you.'}</h2><p className="auth-subtitle">{authMode === 'signup' ? 'Start organizing your care in one secure place.' : authMode === 'reset' ? 'We will send a password reset link to your email.' : 'Sign in to your personal care space.'}</p>
      <button className="google-button" onClick={googleSignIn} disabled={authBusy}><GoogleMark/> Continue with Google</button><div className="auth-divider"><span/>or continue with email<span/></div>
      <form onSubmit={handleAuth} className="auth-form">{authMode === 'signup' && <label>Full name<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required/></label>}<label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required/></label>{authMode !== 'reset' && <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder={authMode === 'signup' ? 'At least 6 characters' : 'Enter your password'} required/></label>}
        {error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}<button className="button button-primary auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : authMode === 'reset' ? 'Send reset link' : 'Sign in'} <ChevronRight size={16}/></button></form>
      <div className="auth-switch">{authMode === 'signin' ? <>Forgot your password? <button onClick={() => { setAuthMode('reset'); setError(''); setMessage(''); }}>Reset it</button><br/><span>New to MediBridge?</span> <button onClick={() => { setAuthMode('signup'); setError(''); setMessage(''); }}>Create an account</button></> : <><span>Already have an account?</span> <button onClick={() => { setAuthMode('signin'); setError(''); setMessage(''); }}>Sign in</button></>}</div><div className="auth-privacy"><LockKeyhole size={13}/> Your account is protected by Supabase authentication.</div>
      </section></div>}
  </div>;
}

function GoogleMark() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.64 5.93c4.46-4.12 7.13-10.19 7.13-17.58z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.64-5.93c-2.12 1.42-4.84 2.26-8.26 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
