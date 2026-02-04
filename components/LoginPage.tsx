import React, { useState, useEffect, useRef } from 'react';
import { DiscordIcon } from './DiscordIcon';
import { 
    ShieldCheck, Lock, Cpu, LogOut, Ban, Users, Search, 
    RefreshCw, ChevronLeft, ArrowUpCircle, 
    ArrowDownCircle, UserPlus, Trash2, Check, AlertTriangle, Eye,
    Send, X, Loader2, AlertCircle, History, User, Coffee, Sparkles, Volume2,
    LayoutDashboard, Terminal, Activity, Zap, Shield
} from 'lucide-react';

// ==========================================
// CONFIGURATION
// ==========================================
const DISCORD_CLIENT_ID = '1468331655646417203'; 
const TARGET_GUILD_ID = '1458138848822431770'; 
const STAFF_ROLE_ID = '1458158245700046901';

const ALLOWED_ADMIN_IDS = [
    '802105175720460318', '440704669178789888', '591281053503848469',
    '1455582084893642998', '846540575032344596', '1468330580910542868'
];

const PROD_API_URL = 'https://nullx-backend.onrender.com/api'; 
const API_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:4000/api'
    : PROD_API_URL;

const playSound = (type: 'hover' | 'click') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        if (type === 'hover') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else {
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    } catch(e) {}
};

interface RoleDef {
    id: string;
    name: string;
    color: string;
    weight: number;
    bg: string;
}

const ROLE_DEFINITIONS: Record<string, Omit<RoleDef, 'id'>> = {
    "1459285694458626222": { name: "TRAINEE", color: "text-blue-400", weight: 1, bg: "bg-blue-500/10 border-blue-500/20" },
    "1458158059187732666": { name: "JR. MODERATOR", color: "text-emerald-400", weight: 2, bg: "bg-emerald-500/10 border-emerald-500/20" },
    "1458158896894967879": { name: "MODERATOR", color: "text-purple-400", weight: 3, bg: "bg-purple-500/10 border-purple-500/20" },
    "1458159110720589944": { name: "SR. MODERATOR", color: "text-red-400", weight: 4, bg: "bg-red-500/10 border-red-500/20" },
    "1458159802105594061": { name: "CHIEF MODERATOR", color: "text-red-600", weight: 5, bg: "bg-red-600/10 border-red-600/20" },
    "1458277039399374991": { name: "CURATOR", color: "text-amber-400", weight: 6, bg: "bg-amber-500/10 border-amber-500/20" },
};

interface StaffDisplay {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    roleId: string;
    roleName: string;
    roleColor?: string;
    roleBg?: string;
    isCurrentUser: boolean;
    status: string;
    weight: number;
    loa: boolean;
}

const ParticleBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        const particles: any[] = [];
        for (let i = 0; i < 40; i++) particles.push({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, size: Math.random() * 1.5, alpha: Math.random() * 0.5 });
        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
                ctx.fillStyle = '#a855f7'; ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            });
            requestAnimationFrame(animate);
        };
        animate();
        const handleResize = () => { if(canvas) { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; } };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-20 pointer-events-none" />;
};

const LoginPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [staffList, setStaffList] = useState<StaffDisplay[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'profile' | 'history'>('profile');
  const [actionType, setActionType] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [actionReason, setActionReason] = useState('');
  const [warnCount, setWarnCount] = useState(1);
  const [targetRoleId, setTargetRoleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // LOA Modal State
  const [showLoaModal, setShowLoaModal] = useState(false);
  const [loaDuration, setLoaDuration] = useState(7);
  const [loaReason, setLoaReason] = useState('');

  const isAdmin = user && ALLOWED_ADMIN_IDS.includes(user.id);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('access_token') || localStorage.getItem('discord_token');
    if (token) {
        localStorage.setItem('discord_token', token);
        fetchUser(token);
    }
  }, []);

  const fetchUser = async (token: string) => {
      setLoading(true);
      try {
          const res = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error("Auth failed");
          const data = await res.json();
          setUser(data);
          fetchStaffList(data.id);
      } catch (e) {
          localStorage.removeItem('discord_token');
      } finally {
          setLoading(false);
      }
  };

  const fetchStaffList = async (myId: string) => {
      try {
          const res = await fetch(`${API_URL}/staff`);
          const data = await res.json();
          const formatted = data.map((m: any) => {
             let bestRole = { name: 'STAFF', color: 'text-zinc-500', weight: 0, id: '', bg: 'bg-zinc-900 border-zinc-800' };
             m.roles.forEach((rid: string) => {
                 if (ROLE_DEFINITIONS[rid] && ROLE_DEFINITIONS[rid].weight > bestRole.weight) {
                     bestRole = { ...ROLE_DEFINITIONS[rid], id: rid };
                 }
             });
             return {
                 id: m.id,
                 username: m.username,
                 displayName: m.displayName || m.username,
                 avatarUrl: m.avatar ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
                 roleId: bestRole.id,
                 roleName: bestRole.name,
                 roleColor: bestRole.color,
                 roleBg: bestRole.bg,
                 status: m.status,
                 isCurrentUser: m.id === myId,
                 loa: m.loa,
                 weight: bestRole.weight
             };
          }).sort((a: any, b: any) => b.weight - a.weight);
          setStaffList(formatted);
      } catch(e) {}
  };

  const fetchLogs = async (userId: string) => {
      try {
          const res = await fetch(`${API_URL}/logs/${userId}`);
          const data = await res.json();
          setUserLogs(data);
      } catch(e) { setUserLogs([]); }
  };

  const handleSelectStaff = (member: StaffDisplay) => {
      playSound('click');
      setSelectedStaff(member);
      setViewTab('profile');
      setActionType(null);
      fetchLogs(member.id);
  };

  const handleAction = async () => {
      if (!selectedStaff || !actionType) return;
      setIsSending(true);
      playSound('click');
      try {
        await fetch(`${API_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: actionType,
                targetId: selectedStaff.id,
                targetRoleId,
                reason: actionReason,
                warnCount,
                adminId: user.id
            })
        });
        setSuccessMsg('SYSTEM: Action Executed Successfully');
        setTimeout(() => setSuccessMsg(''), 2000);
        setActionType(null);
        fetchLogs(selectedStaff.id); 
      } catch(e) {
          alert("Execution Failed");
      } finally {
          setIsSending(false);
      }
  };

  const handleLoaClick = () => {
      const me = staffList.find(s => s.isCurrentUser);
      if (me?.loa) {
          // If active, just turn off (return from leave)
          submitLoa(false);
      } else {
          // If inactive, show modal
          setShowLoaModal(true);
      }
  };

  const submitLoa = async (active: boolean) => {
      if (!user) return;
      try {
          await fetch(`${API_URL}/loa`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                   userId: user.id, 
                   active, 
                   duration: active ? loaDuration : 0, 
                   reason: active ? loaReason : '' 
               })
          });
          
          setStaffList(prev => prev.map(s => s.id === user.id ? { ...s, loa: active } : s));
          setShowLoaModal(false);
          setSuccessMsg(active ? 'LOA ACTIVATED' : 'LOA ENDED');
          setTimeout(() => setSuccessMsg(''), 2000);
      } catch(e) {}
  }

  const filteredStaff = staffList.filter(s => s.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

  // LOGIN SCREEN
  if (!user) return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
          <ParticleBackground />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#050505_100%)] opacity-80"></div>
          <button 
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/')}&response_type=token&scope=identify%20guilds.members.read`; }}
              className="relative z-10 group"
          >
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
              <div className="relative bg-[#09090b] border border-white/10 px-10 py-6 rounded-2xl flex items-center gap-6 hover:bg-zinc-900 transition-all">
                  <div className="p-3 bg-[#5865F2]/10 rounded-xl border border-[#5865F2]/20">
                    <DiscordIcon className="w-8 h-8 text-[#5865F2]" />
                  </div>
                  <div className="text-left">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1">Nullx Access</div>
                      <div className="text-xl font-black text-white tracking-tight">AUTHENTICATE</div>
                  </div>
              </div>
          </button>
      </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#030303] text-zinc-100 overflow-hidden flex font-sans selection:bg-purple-500/30">
      <ParticleBackground />
      
      {successMsg && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
              <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 px-6 py-3 rounded-lg font-mono text-xs shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  {successMsg}
              </div>
          </div>
      )}

      {/* LOA MODAL */}
      {showLoaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
                  <button onClick={() => setShowLoaModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <Coffee className="w-5 h-5 text-amber-500" />
                      </div>
                      <h3 className="text-lg font-bold uppercase tracking-tight">Request Leave (LOA)</h3>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Duration (Days)</label>
                          <input 
                            type="number" 
                            value={loaDuration}
                            onChange={(e) => setLoaDuration(parseInt(e.target.value))}
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
                            min="1" max="30"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Reason</label>
                          <textarea 
                            value={loaReason}
                            onChange={(e) => setLoaReason(e.target.value)}
                            placeholder="Why are you going inactive?"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm h-24 outline-none focus:border-purple-500 transition-colors resize-none"
                          ></textarea>
                      </div>
                      <button 
                        onClick={() => submitLoa(true)}
                        className="w-full py-3 bg-white text-black font-black uppercase rounded-xl hover:bg-zinc-200 transition-colors text-xs tracking-widest mt-2"
                      >
                          Confirm Inactive Status
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* SIDEBAR */}
      <div className="w-[80px] md:w-[320px] bg-[#050505] border-r border-white/5 flex flex-col z-20 transition-all duration-300">
          {/* Header */}
          <div className="h-20 flex items-center justify-center md:justify-start md:px-6 border-b border-white/5">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center font-black text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]">NX</div>
                <div className="hidden md:block ml-4">
                    <div className="font-black text-lg tracking-tight">NULLX</div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Control Panel</div>
                </div>
          </div>

          {/* User Status Card */}
          <div className="hidden md:block p-6 border-b border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-10 h-10 rounded-lg bg-zinc-800" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050505]"></div>
                  </div>
                  <div className="overflow-hidden">
                      <div className="font-bold text-sm truncate">{user.username}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{user.id}</div>
                  </div>
              </div>
              <button 
                  onClick={handleLoaClick}
                  className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${staffList.find(s => s.isCurrentUser)?.loa ? 'bg-amber-900/20 border-amber-500/50 text-amber-500 hover:bg-amber-900/40' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
              >
                  <Coffee className="w-3 h-3" /> {staffList.find(s => s.isCurrentUser)?.loa ? 'End LOA' : 'Set Inactive'}
              </button>
          </div>

          {/* Search */}
          <div className="p-4 md:p-6 pb-2">
              <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-purple-500 transition-colors" />
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..." 
                      className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-9 text-xs text-zinc-300 focus:border-purple-500/50 outline-none transition-all placeholder:text-zinc-700"
                  />
              </div>
          </div>

          {/* Staff List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 space-y-1">
              {filteredStaff.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => handleSelectStaff(s)}
                    onMouseEnter={() => playSound('hover')}
                    className={`group relative p-2 md:p-3 rounded-lg cursor-pointer transition-all duration-200 border ${selectedStaff?.id === s.id ? 'bg-white/[0.03] border-purple-500/30' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                  >
                      {selectedStaff?.id === s.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-purple-500 rounded-r-full shadow-[0_0_10px_purple]"></div>}
                      
                      <div className="flex items-center justify-center md:justify-start gap-3">
                          <div className="relative shrink-0">
                              <img src={s.avatarUrl} className="w-8 h-8 rounded-md bg-zinc-900 object-cover grayscale group-hover:grayscale-0 transition-all" />
                              {s.loa && <div className="absolute -top-1 -right-1 bg-amber-600 w-2.5 h-2.5 rounded-full border-2 border-[#050505]"></div>}
                          </div>
                          <div className="hidden md:block overflow-hidden">
                              <div className={`font-bold text-xs truncate ${selectedStaff?.id === s.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{s.displayName}</div>
                              <div className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 ${s.roleColor}`}>{s.roleName}</div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
          
          <div className="p-4 border-t border-white/5">
              <button 
                  onClick={() => { localStorage.removeItem('discord_token'); window.location.reload(); }}
                  className="w-full flex items-center justify-center md:justify-start gap-3 text-zinc-600 hover:text-red-400 transition-colors p-2"
              >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline text-xs font-bold uppercase">Terminate Session</span>
              </button>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 relative flex flex-col bg-[#030303] z-10">
          {/* Header/Breadcrumbs */}
          <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#030303]/50 backdrop-blur-md sticky top-0 z-30">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <Terminal className="w-4 h-4" />
                  <span>SYSTEM</span>
                  <span>/</span>
                  <span className={selectedStaff ? 'text-purple-400' : ''}>{selectedStaff ? 'USER_MANAGEMENT' : 'IDLE'}</span>
              </div>
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600 bg-white/5 px-3 py-1.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      SERVER: ONLINE
                  </div>
              </div>
          </div>

          {selectedStaff ? (
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                  <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      {/* PROFILE HEADER CARD */}
                      <div className="w-full bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 mb-8 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                          
                          <div className="flex flex-col md:flex-row items-start gap-8 relative z-10">
                              {/* AVATAR BOX */}
                              <div className="shrink-0 relative">
                                  <div className="w-40 h-40 rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden relative shadow-2xl">
                                      <img 
                                          src={`https://minotar.net/armor/bust/${selectedStaff.displayName}/300.png`}
                                          className="w-full h-full object-cover"
                                          style={{ imageRendering: 'pixelated' }}
                                          onError={(e) => { (e.target as HTMLImageElement).src = `https://minotar.net/helm/MHF_Steve/300.png`; }}
                                      />
                                      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] opacity-20 pointer-events-none"></div>
                                      <div className="absolute bottom-0 w-full h-1 bg-purple-500 shadow-[0_0_10px_purple]"></div>
                                  </div>
                              </div>

                              {/* INFO */}
                              <div className="flex-1 w-full pt-2">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                      <div>
                                          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">{selectedStaff.displayName}</h1>
                                          <div className="flex flex-wrap items-center gap-3">
                                              <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${selectedStaff.roleBg} ${selectedStaff.roleColor}`}>
                                                  {selectedStaff.roleName}
                                              </div>
                                              <div className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-mono">
                                                  ID: {selectedStaff.id}
                                              </div>
                                              
                                              {/* STATUS INDICATOR */}
                                              <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase flex items-center gap-2 ${
                                                  selectedStaff.status === 'online' 
                                                  ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' 
                                                  : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                                              }`}>
                                                  <div className={`w-2 h-2 rounded-full ${selectedStaff.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                                                  {selectedStaff.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                              </div>

                                              {selectedStaff.loa && (
                                                  <div className="px-3 py-1 rounded bg-amber-900/20 border border-amber-500/50 text-amber-500 text-[10px] font-bold uppercase flex items-center gap-2">
                                                      <Coffee className="w-3 h-3" /> ON LEAVE
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                      
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => setViewTab('profile')}
                                              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${viewTab === 'profile' ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                                          >
                                              Overview
                                          </button>
                                          <button 
                                              onClick={() => { setViewTab('history'); fetchLogs(selectedStaff.id); }}
                                              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${viewTab === 'history' ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                                          >
                                              Audit Logs
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* CONTENT TABS */}
                      {viewTab === 'profile' ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              {/* ACTIONS */}
                              <div className="lg:col-span-2 space-y-6">
                                  {isAdmin ? (
                                      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8">
                                          <div className="flex items-center gap-3 mb-6">
                                              <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                                  <Zap className="w-5 h-5 text-purple-400" />
                                              </div>
                                              <h3 className="text-lg font-bold uppercase tracking-tight">Administrative Actions</h3>
                                          </div>

                                          {!actionType ? (
                                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                  <button onClick={() => setActionType('promote')} className="h-24 rounded-2xl bg-emerald-900/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <ArrowUpCircle className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Promote</span>
                                                  </button>
                                                  <button onClick={() => setActionType('demote')} className="h-24 rounded-2xl bg-orange-900/10 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <ArrowDownCircle className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Demote</span>
                                                  </button>
                                                  <button onClick={() => setActionType('warn')} className="h-24 rounded-2xl bg-yellow-900/10 border border-yellow-500/20 hover:bg-yellow-500/20 hover:border-yellow-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <AlertTriangle className="w-6 h-6 text-yellow-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">Warn</span>
                                                  </button>
                                                  <button onClick={() => setActionType('unwarn')} className="h-24 rounded-2xl bg-blue-900/10 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <ShieldCheck className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Unwarn</span>
                                                  </button>
                                                  <button onClick={() => setActionType('kick')} className="h-24 rounded-2xl bg-red-900/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <Trash2 className="w-6 h-6 text-red-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">Kick</span>
                                                  </button>
                                              </div>
                                          ) : (
                                              <div className="bg-black/30 rounded-2xl p-6 border border-white/5 animate-in zoom-in-95 duration-200">
                                                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                                      <div className="flex items-center gap-3">
                                                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                                                          <span className="text-sm font-black uppercase tracking-wider text-white">Protocol: {actionType}</span>
                                                      </div>
                                                      <button onClick={() => setActionType(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-zinc-500" /></button>
                                                  </div>
                                                  
                                                  <div className="space-y-4">
                                                      {(actionType === 'promote' || actionType === 'demote') && (
                                                          <div className="space-y-2">
                                                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Target Rank</label>
                                                              <select 
                                                                onChange={(e) => setTargetRoleId(e.target.value)}
                                                                className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-xs font-mono outline-none focus:border-purple-500 transition-colors appearance-none"
                                                              >
                                                                  <option value="">Select Classification...</option>
                                                                  {Object.entries(ROLE_DEFINITIONS).map(([id, def]) => (
                                                                      <option key={id} value={id}>{def.name}</option>
                                                                  ))}
                                                              </select>
                                                          </div>
                                                      )}

                                                      {actionType === 'warn' && (
                                                          <div className="space-y-2">
                                                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Severity Level</label>
                                                              <div className="flex gap-2">
                                                                  {[1,2,3].map(n => (
                                                                      <button key={n} onClick={() => setWarnCount(n)} className={`flex-1 py-3 rounded-xl font-black border transition-all ${warnCount === n ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-black border-white/10 text-zinc-500'}`}>Level {n}</button>
                                                                  ))}
                                                              </div>
                                                          </div>
                                                      )}

                                                      <div className="space-y-2">
                                                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Reason for Action</label>
                                                          <textarea 
                                                            placeholder="Enter details..." 
                                                            value={actionReason}
                                                            onChange={(e) => setActionReason(e.target.value)}
                                                            className="w-full bg-[#050505] border border-white/10 rounded-xl p-4 text-xs font-mono h-32 outline-none focus:border-purple-500 transition-colors resize-none"
                                                          ></textarea>
                                                      </div>

                                                      <button 
                                                        onClick={handleAction}
                                                        disabled={isSending}
                                                        className="w-full py-4 bg-white text-black font-black uppercase rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 mt-2 text-xs tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                                      >
                                                          {isSending ? 'PROCESSING...' : 'EXECUTE PROTOCOL'}
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ) : (
                                      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-12 text-center">
                                          <Lock className="w-8 h-8 text-zinc-700 mx-auto mb-4" />
                                          <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Restricted Access</div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 min-h-[500px]">
                              <div className="flex items-center gap-3 mb-8">
                                  <History className="w-5 h-5 text-purple-500" />
                                  <h3 className="text-lg font-bold uppercase tracking-tight">Audit Log History</h3>
                              </div>
                              
                              <div className="relative border-l border-white/10 ml-3 space-y-8">
                                  {userLogs.length === 0 ? (
                                      <div className="pl-8 text-zinc-600 text-xs font-mono">NO RECORDS FOUND</div>
                                  ) : (
                                      userLogs.map((log, idx) => (
                                          <div key={idx} className="relative pl-8 group">
                                              <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 bg-zinc-900 border border-zinc-700 rounded-full group-hover:bg-purple-500 group-hover:border-purple-300 transition-colors"></div>
                                              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl hover:bg-white/[0.04] transition-colors">
                                                  <div className="flex justify-between items-start mb-2">
                                                      <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                                                          log.action === 'promote' ? 'bg-emerald-500/10 text-emerald-400' :
                                                          log.action === 'warn' ? 'bg-yellow-500/10 text-yellow-400' :
                                                          log.action === 'kick' ? 'bg-red-500/10 text-red-400' :
                                                          log.action === 'unwarn' ? 'bg-blue-500/10 text-blue-400' :
                                                          log.action === 'loa' ? 'bg-purple-500/10 text-purple-400' :
                                                          'bg-zinc-800 text-zinc-400'
                                                      }`}>{log.action}</span>
                                                      <span className="text-[10px] font-mono text-zinc-600">{new Date(log.date).toLocaleString()}</span>
                                                  </div>
                                                  <p className="text-sm text-zinc-300 font-medium mb-2">{log.reason}</p>
                                                  <div className="text-[10px] text-zinc-500 uppercase font-bold">
                                                      Admin ID: <span className="font-mono text-zinc-400">{log.adminId}</span>
                                                  </div>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center relative">
                  <div className="w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] absolute pointer-events-none"></div>
                  <div className="relative z-10 text-center space-y-4">
                      <div className="w-24 h-24 bg-[#0a0a0a] border border-white/10 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
                          <LayoutDashboard className="w-10 h-10 text-zinc-700" />
                      </div>
                      <div>
                          <h2 className="text-2xl font-black text-white tracking-tight mb-2">AWAITING INPUT</h2>
                          <p className="text-zinc-500 text-xs uppercase tracking-widest">Select a staff member from the directory</p>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default LoginPage;