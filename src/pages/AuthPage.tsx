import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import PageTransition from '@/components/PageTransition';

const AuthPage: React.FC = () => {
  const { user, role, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-orbitron text-primary text-glow-red animate-pulse-emergency">LOADING...</div>
      </div>
    );
  }

  if (user && role) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/user" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (!fullName.trim()) { setError('Full name is required'); setSubmitting(false); return; }
      const { error } = await signUp(email, password, fullName);
      if (error) setError(error);
      else setSuccess('Account created! Please check your email to verify your account.');
    }
    setSubmitting(false);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Top red bar */}
        <header className="red-bar py-3 px-4 md:px-6 flex items-center justify-between">
          <h1 className="font-orbitron text-primary-foreground text-xs sm:text-sm md:text-xl font-bold tracking-widest text-center flex-1 text-glow-red">
            🚑 EMERGENCY AMBULANCE RESPONSE SYSTEM
          </h1>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-md panel-gradient border border-border rounded-lg p-6 md:p-8"
          >
            <h2 className="font-orbitron text-foreground text-lg md:text-xl font-bold text-center mb-6">
              {isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-1 font-rajdhani">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground font-mono-tech focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your full name"
                    maxLength={100}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-muted-foreground mb-1 font-rajdhani">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground font-mono-tech focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="email@example.com"
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1 font-rajdhani">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground font-mono-tech focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  maxLength={72}
                />
              </div>

              {error && <p className="text-primary text-sm font-rajdhani">{error}</p>}
              {success && <p className="text-accent text-sm font-rajdhani">{success}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full red-bar text-primary-foreground font-orbitron text-sm py-3 rounded font-bold tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'PROCESSING...' : isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4 font-rajdhani">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                className="text-emergency-blue hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>

            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground text-center font-rajdhani">
              <p>📞 Emergency? Call <span className="text-primary font-bold">108</span> directly</p>
              <p className="mt-1">Roles: User (report emergencies) • Driver (respond) • Admin (manage)</p>
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AuthPage;
