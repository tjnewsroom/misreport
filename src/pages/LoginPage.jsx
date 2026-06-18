import { useState } from 'react';
import { sb } from '../lib/supabase';

const BASE_URL = import.meta.env.BASE_URL;
const PETALS = ['🌸','🌺','🌼','🌻','✨','🎊','💫','⭐'];

function FlowerShower() {
  const petals = Array.from({ length: 32 }, (_, i) => ({
    id: i, emoji: PETALS[i % PETALS.length],
    left: Math.random() * 100,
    size: 14 + Math.random() * 16,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 3,
  }));
  return (
    <div className="flower-shower" aria-hidden="true">
      {petals.map(p => (
        <span key={p.id} className="petal" style={{
          left:`${p.left}%`, fontSize:`${p.size}px`,
          animationDelay:`${p.delay}s`, animationDuration:`${p.duration}s`,
        }}>{p.emoji}</span>
      ))}
    </div>
  );
}

function WelcomeOverlay({ user, empName, onDismiss }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const msg = hour < 12 ? 'Ready to make today count? 💪' : hour < 17 ? 'Keep up the great work! 🌟' : 'Evening shift — you\'ve got this! 🌙';
  const name = empName || user?.email?.split('@')[0] || 'Team';
  return (
    <div className="welcome-overlay">
      <FlowerShower />
      <div className="welcome-card">
        <img src={`${BASE_URL}tj-logo.png`} alt="TamilJanam" style={{ width: 140, marginBottom: 16, objectFit: 'contain' }} />
        <div className="welcome-greeting">{greeting}!</div>
        <div className="welcome-name">{name}</div>
        <p className="welcome-msg">{msg}</p>
        <button className="btn btn-p welcome-btn" onClick={onDismiss}>Let's Go 🚀</button>
      </div>
    </div>
  );
}

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [loginData, setLoginData]     = useState(null);
  const [showPw, setShowPw]     = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      setLoginData(data);
      setShowWelcome(true);
      setLoading(false);
    } catch {
      setError('Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  if (showWelcome && loginData) {
    return (
      <WelcomeOverlay
        user={loginData.user}
        empName={loginData.user?.user_metadata?.emp_name}
        onDismiss={() => { setShowWelcome(false); onLogin(loginData); }}
      />
    );
  }

  return (
    <div className="login-screen">
      {/* Animated gradient background */}
      <div style={{
        position:'absolute', inset:0, zIndex:0,
        background:'linear-gradient(135deg, #0f1f3d 0%, #1a3a6e 40%, #0d4a7a 70%, #0a2d5a 100%)',
      }} />
      {/* Subtle animated circles */}
      <div style={{position:'absolute',inset:0,zIndex:0,overflow:'hidden',pointerEvents:'none'}}>
        {[
          {w:500,h:500,t:'-150px',l:'-150px',bg:'rgba(79,142,247,.12)'},
          {w:400,h:400,b:'-100px',r:'-100px',bg:'rgba(56,182,232,.1)'},
          {w:300,h:300,t:'30%',l:'55%',bg:'rgba(166,125,245,.08)'},
        ].map((c,i)=>(
          <div key={i} style={{
            position:'absolute',width:c.w,height:c.h,borderRadius:'50%',
            background:c.bg,filter:'blur(80px)',
            top:c.t,left:c.l,bottom:c.b,right:c.r
          }}/>
        ))}
      </div>

      {/* Login card */}
      <div style={{
        position:'relative', zIndex:1,
        background:'rgba(255,255,255,0.97)',
        borderRadius:24, padding:'44px 40px',
        width:'100%', maxWidth:420,
        boxShadow:'0 24px 64px rgba(0,0,0,.28), 0 4px 16px rgba(0,0,0,.12)',
        animation:'fadeUp .35s ease',
      }}>
        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:28}}>
          <img src={`${BASE_URL}tj-logo.png`} alt="TamilJanam" style={{
            width:200, maxHeight:90, objectFit:'contain', display:'inline-block'
          }}/>
          <div style={{
            marginTop:10, fontSize:'.78rem', fontWeight:600,
            color:'#52637a', letterSpacing:'.06em', textTransform:'uppercase'
          }}>Media Information System</div>
        </div>

        {error && (
          <div style={{
            background:'#fff0f0', color:'#c0392b',
            border:'1px solid #f5c6cb', borderRadius:10,
            padding:'10px 14px', fontSize:'.82rem', marginBottom:18
          }}>{error}</div>
        )}

        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:18}}>
          {/* Email */}
          <div>
            <label style={{display:'block', fontSize:'11px', fontWeight:700, color:'#52637a', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6}}>
              Email Address
            </label>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:16,color:'#94a3b8'}}>✉️</span>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="you@tamiljanam.tv" autoComplete="email"
                style={{
                  width:'100%', padding:'11px 14px 11px 40px',
                  border:'1.5px solid #dde5ef', borderRadius:10,
                  fontSize:14, background:'#f8fafc', color:'#0d1829',
                  transition:'border .15s, box-shadow .15s', outline:'none',
                  fontFamily:'Inter, sans-serif',
                }}
                onFocus={e=>{e.target.style.border='1.5px solid #2361d4';e.target.style.boxShadow='0 0 0 3px rgba(35,97,212,.12)';e.target.style.background='#fff'}}
                onBlur={e=>{e.target.style.border='1.5px solid #dde5ef';e.target.style.boxShadow='none';e.target.style.background='#f8fafc'}}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{display:'block', fontSize:'11px', fontWeight:700, color:'#52637a', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6}}>
              Password
            </label>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:16,color:'#94a3b8'}}>🔒</span>
              <input
                type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••••" autoComplete="current-password"
                style={{
                  width:'100%', padding:'11px 44px 11px 40px',
                  border:'1.5px solid #dde5ef', borderRadius:10,
                  fontSize:14, background:'#f8fafc', color:'#0d1829',
                  transition:'border .15s, box-shadow .15s', outline:'none',
                  fontFamily:'Inter, sans-serif',
                }}
                onFocus={e=>{e.target.style.border='1.5px solid #2361d4';e.target.style.boxShadow='0 0 0 3px rgba(35,97,212,.12)';e.target.style.background='#fff'}}
                onBlur={e=>{e.target.style.border='1.5px solid #dde5ef';e.target.style.boxShadow='none';e.target.style.background='#f8fafc'}}
              />
              <button type="button" onClick={()=>setShowPw(s=>!s)} style={{
                position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#94a3b8',
                display:'flex',alignItems:'center'
              }}>{showPw?'🙈':'👁'}</button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            marginTop:4, padding:'13px', borderRadius:12, border:'none',
            background:'linear-gradient(135deg,#2361d4,#0786b3)',
            color:'#fff', fontSize:'1rem', fontWeight:700,
            cursor:loading?'not-allowed':'pointer',
            opacity:loading?0.7:1,
            boxShadow:'0 4px 16px rgba(35,97,212,.35)',
            transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontFamily:'Inter, sans-serif',
          }}
          onMouseEnter={e=>{if(!loading){e.target.style.transform='translateY(-1px)';e.target.style.boxShadow='0 6px 22px rgba(35,97,212,.45)';}}}
          onMouseLeave={e=>{e.target.style.transform='none';e.target.style.boxShadow='0 4px 16px rgba(35,97,212,.35)';}}>
            {loading ? <><span className="spinner"/>Signing in…</> : 'Sign In →'}
          </button>
        </form>

        <div style={{marginTop:22, textAlign:'center', fontSize:'.7rem', color:'#94a3b8'}}>
          TamilJanam © {new Date().getFullYear()} · All rights reserved
        </div>
      </div>
    </div>
  );
}
