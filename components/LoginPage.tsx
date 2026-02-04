import React, { useState, useEffect, useRef } from 'react';
import { DiscordIcon } from './DiscordIcon';
import { 
    ShieldCheck, Lock, Cpu, LogOut, Ban, Users, Search, 
    RefreshCw, ChevronLeft, ArrowUpCircle, 
    ArrowDownCircle, UserPlus, Trash2, Check, AlertTriangle, Eye,
    Send, X, Loader2, AlertCircle, History, User, Coffee, Sparkles, Volume2
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

// === SOUND EFFECTS (Base64 for reliability) ===
const SOUNDS = {
    hover: "data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...", // Placeholder short beep (browser might ignore invalid base64, so we use dummy or empty if needed, but here is a trick: create AudioContext beeps)
    click: "data:audio/wav;base64,..."
};

// Simple Audio Synthesizer to avoid 404s
const playSound = (type: 'hover' | 'click') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'hover') {
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.05);
        } else {
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        }
    } catch(e) {}
};

interface RoleDef {
    id: string;
    name: string;
    color: string;
    weight: number;
}

const ROLE_DEFINITIONS: Record<string, Omit<RoleDef, 'id'>> = {
    "1459285694458626222": { name: "Стажёр", color: "text-blue-400", weight: 1 },
    "1458158059187732666": { name: "Мл. Модератор", color: "text-emerald-400", weight: 2 },
    "1458158896894967879": { name: "Модератор", color: "text-purple-400", weight: 3 },
    "1458159110720589944": { name: "Ст. Модератор", color: "text-red-500", weight: 4 },
    "1458159802105594061": { name: "Шеф Модератор", color: "text-red-600", weight: 5 },
    "1458277039399374991": { name: "Куратор", color: "text-amber-400", weight: 6 },
};

interface StaffDisplay {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    roleId: string;
    roleName: string;
    roleColor?: string;
    isCurrentUser: boolean;
    status: string;
    weight: number;
    loa: boolean;
}

// === PARTICLE SYSTEM ===
const ParticleBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const particles: {x: number, y: number, vx: number, vy: number, size: number, alpha: number}[] = [];

        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2,
                alpha: Math.random() * 0.5
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#8b5cf6'; // Purple

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw connecting lines
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 0.5;
            for(let i=0; i<particles.length; i++) {
                for(let j=i+1; j<particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if(dist < 100) {
                        ctx.globalAlpha = 0.1 * (1 - dist/100);
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animate);
        };

        animate();

        const handleResize = () => {
            if(canvas) {
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-30 pointer-events-none" />;
};

const LoginPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [staffList, setStaffList] = useState<StaffDisplay[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffDisplay | null>(null);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'profile' | 'history'>('profile');
  const [actionType, setActionType] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Data States
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [actionReason, setActionReason] = useState('');
  const [warnCount, setWarnCount] = useState(1);
  const [targetRoleId, setTargetRoleId] = useState('');
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

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
             // Find best role
             let bestRole = { name: 'Staff', color: 'text-zinc-500', weight: 0, id: '' };
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
        setSuccessMsg('Действие выполнено!');
        setTimeout(() => setSuccessMsg(''), 2000);
        setActionType(null);
        fetchLogs(selectedStaff.id); // Refresh logs
      } catch(e) {
          alert("Ошибка!");
      } finally {
          setIsSending(false);
      }
  };

  const toggleLOA = async () => {
      if (!user) return;
      playSound('click');
      const me = staffList.find(s => s.isCurrentUser);
      if (!me) return;

      const newState = !me.loa;
      
      try {
          await fetch(`${API_URL}/loa`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, active: newState, duration: 7 })
          });
          
          // Optimistic update
          setStaffList(prev => prev.map(s => s.id === user.id ? { ...s, loa: newState } : s));
      } catch(e) {}
  };

  const filteredStaff = staffList.filter(s => s.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

  // === RENDER HELPERS ===

  if (!user) return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
          <ParticleBackground />
          <button 
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/')}&response_type=token&scope=identify%20guilds.members.read`; }}
              className="relative z-10 bg-white/5 border border-white/10 p-8 rounded-3xl flex items-center gap-4 hover:bg-white/10 hover:scale-105 transition-all group backdrop-blur-md"
          >
              <DiscordIcon className="w-8 h-8 text-[#5865F2]" />
              <div className="text-left">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Система Доступа</div>
                  <div className="text-xl font-black text-white">Войти через Discord</div>
              </div>
          </button>
      </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white overflow-hidden flex flex-col font-sans relative">
      <ParticleBackground />
      
      {/* SUCCESS TOAST */}
      {successMsg && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/20 border border-emerald-500 text-emerald-300 px-6 py-3 rounded-full font-bold animate-bounce flex items-center gap-2 backdrop-blur-xl">
              <Check className="w-5 h-5" /> {successMsg}
          </div>
      )}

      {/* DASHBOARD LAYOUT */}
      <div className="flex-1 flex overflow-hidden z-10 relative">
          
          {/* SIDEBAR LIST */}
          <div className="w-[300px] md:w-[380px] border-r border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl flex flex-col">
              <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3 mb-6">
                       <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center font-black text-black">NX</div>
                       <div>
                           <div className="font-black text-lg leading-none">NULLX</div>
                           <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Panel v2.0</div>
                       </div>
                  </div>
                  
                  {/* Current User Card */}
                  <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between border border-white/5 mb-4">
                      <div className="flex items-center gap-3">
                          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-8 h-8 rounded-lg" />
                          <div>
                              <div className="font-bold text-xs">{user.username}</div>
                              <div className="text-[9px] text-emerald-400">Online</div>
                          </div>
                      </div>
                      <button 
                        onClick={toggleLOA} 
                        onMouseEnter={() => playSound('hover')}
                        className={`p-2 rounded-lg transition-colors ${staffList.find(s => s.isCurrentUser)?.loa ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                        title="Уйти в неактив (LOA)"
                      >
                          <Coffee className="w-4 h-4" />
                      </button>
                  </div>

                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск агента..." 
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 text-sm focus:border-purple-500 outline-none transition-colors"
                      />
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                  {filteredStaff.map(s => (
                      <div 
                        key={s.id}
                        onClick={() => handleSelectStaff(s)}
                        onMouseEnter={() => playSound('hover')}
                        className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${selectedStaff?.id === s.id ? 'bg-white/10 border-purple-500/50' : 'hover:bg-white/5 border-transparent'}`}
                      >
                          <div className="flex items-center gap-3">
                              <div className="relative">
                                  <img src={s.avatarUrl} className="w-9 h-9 rounded-lg bg-zinc-800 object-cover" />
                                  {s.loa && <div className="absolute -top-1 -right-1 bg-purple-500 w-3 h-3 rounded-full border-2 border-black" title="В отпуске"></div>}
                              </div>
                              <div>
                                  <div className="font-bold text-sm text-zinc-200">{s.displayName}</div>
                                  <div className={`text-[9px] uppercase font-bold tracking-wider ${s.roleColor}`}>{s.roleName}</div>
                              </div>
                          </div>
                          {selectedStaff?.id === s.id && <ChevronLeft className="w-4 h-4 text-purple-400 rotate-180" />}
                      </div>
                  ))}
              </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 bg-[#050505] relative flex flex-col">
              {selectedStaff ? (
                  <div className="flex-1 overflow-y-auto p-8 md:p-12">
                      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-500">
                          
                          {/* Top Navigation for Profile */}
                          <div className="flex items-center gap-4 mb-8">
                              <button 
                                onClick={() => { setViewTab('profile'); playSound('click'); }}
                                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${viewTab === 'profile' ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
                              >
                                  <User className="w-3 h-3 inline-block mr-2" /> Профиль
                              </button>
                              <button 
                                onClick={() => { setViewTab('history'); playSound('click'); fetchLogs(selectedStaff.id); }}
                                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${viewTab === 'history' ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
                              >
                                  <History className="w-3 h-3 inline-block mr-2" /> История (Logs)
                              </button>
                          </div>

                          {viewTab === 'profile' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                                  {/* LEFT: 3D MODEL / FULL BODY */}
                                  <div className="relative group">
                                      <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent opacity-50 rounded-[3rem]"></div>
                                      <div className="h-[500px] w-full bg-white/[0.02] border border-white/5 rounded-[3rem] flex items-center justify-center relative overflow-hidden backdrop-blur-sm">
                                          {/* Cyberpunk Grid Background */}
                                          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                                          
                                          {/* Full Body Render API */}
                                          <img 
                                            src={`https://visage.surgeplay.com/full/512/${selectedStaff.id}`} 
                                            onError={(e) => { 
                                                // Fallback to username if ID lookup fails (cracked server support usually works by name)
                                                (e.target as HTMLImageElement).src = `https://visage.surgeplay.com/full/512/X-Steve`; 
                                                // Try secondary source
                                                (e.target as HTMLImageElement).src = `https://starlightskins.lunareclipse.studio/render/model/${selectedStaff.displayName}/full`;
                                            }}
                                            className="h-[90%] object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10 transition-transform group-hover:scale-105 duration-500"
                                            alt="Skin"
                                          />

                                          {/* Name Badge Overlay */}
                                          <div className="absolute bottom-6 left-6 right-6 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                                              <div>
                                                  <div className="text-2xl font-black">{selectedStaff.displayName}</div>
                                                  <div className={`text-[10px] uppercase font-bold tracking-widest ${selectedStaff.roleColor}`}>{selectedStaff.roleName}</div>
                                              </div>
                                              {selectedStaff.loa && (
                                                  <div className="px-3 py-1 bg-purple-500/20 text-purple-300 text-[9px] font-bold rounded border border-purple-500/50 uppercase">LOA Active</div>
                                              )}
                                          </div>
                                      </div>
                                  </div>

                                  {/* RIGHT: CONTROLS */}
                                  <div className="space-y-6">
                                      {isAdmin ? (
                                          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                                              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                  <Sparkles className="w-4 h-4 text-purple-500" /> Управление
                                              </h3>

                                              {!actionType ? (
                                                  <div className="grid grid-cols-2 gap-3">
                                                      <button onClick={() => setActionType('promote')} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase transition-all">Повысить</button>
                                                      <button onClick={() => setActionType('demote')} className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 text-orange-300 text-xs font-bold uppercase transition-all">Понизить</button>
                                                      <button onClick={() => setActionType('warn')} className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/20 text-yellow-300 text-xs font-bold uppercase transition-all">Варн</button>
                                                      <button onClick={() => setActionType('kick')} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 text-red-300 text-xs font-bold uppercase transition-all">Кикнуть</button>
                                                  </div>
                                              ) : (
                                                  <div className="space-y-4 animate-in fade-in slide-in-from-right-5">
                                                      <div className="flex items-center justify-between">
                                                          <span className="text-lg font-black uppercase">{actionType}</span>
                                                          <button onClick={() => setActionType(null)}><X className="w-5 h-5 text-zinc-500" /></button>
                                                      </div>
                                                      
                                                      {(actionType === 'promote' || actionType === 'demote') && (
                                                          <select 
                                                            onChange={(e) => setTargetRoleId(e.target.value)}
                                                            className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm outline-none"
                                                          >
                                                              <option value="">Выберите роль...</option>
                                                              {Object.entries(ROLE_DEFINITIONS).map(([id, def]) => (
                                                                  <option key={id} value={id}>{def.name}</option>
                                                              ))}
                                                          </select>
                                                      )}

                                                      {actionType === 'warn' && (
                                                          <div className="flex items-center gap-2">
                                                              <span className="text-xs font-bold text-zinc-500">Уровень:</span>
                                                              {[1,2,3].map(n => (
                                                                  <button key={n} onClick={() => setWarnCount(n)} className={`w-8 h-8 rounded-lg font-bold border ${warnCount === n ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-transparent border-white/10'}`}>{n}</button>
                                                              ))}
                                                          </div>
                                                      )}

                                                      <textarea 
                                                        placeholder="Причина действия..." 
                                                        value={actionReason}
                                                        onChange={(e) => setActionReason(e.target.value)}
                                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm h-24 outline-none focus:border-purple-500 transition-colors"
                                                      ></textarea>

                                                      <button 
                                                        onClick={handleAction}
                                                        disabled={isSending}
                                                        className="w-full py-4 bg-white text-black font-black uppercase rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
                                                      >
                                                          {isSending ? 'Обработка...' : 'Подтвердить'}
                                                      </button>
                                                      
                                                      {actionType === 'warn' && <p className="text-[10px] text-zinc-500 text-center">Сотрудник получит ЛС с кнопкой объяснительной.</p>}
                                                  </div>
                                              )}
                                          </div>
                                      ) : (
                                          <div className="p-6 border border-white/5 rounded-3xl text-center text-zinc-500 text-xs">
                                              Режим просмотра (Нет прав)
                                          </div>
                                      )}

                                      {/* Info Card */}
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                                              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Статус</div>
                                              <div className="text-sm font-bold text-emerald-400 capitalize">{selectedStaff.status || 'Offline'}</div>
                                          </div>
                                          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                                              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">ID</div>
                                              <div className="text-sm font-mono text-zinc-300 truncate">{selectedStaff.id}</div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ) : (
                              // HISTORY VIEW
                              <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 min-h-[500px]">
                                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><History className="w-5 h-5 text-zinc-500" /> Журнал Действий</h3>
                                  
                                  {userLogs.length === 0 ? (
                                      <div className="text-center text-zinc-600 py-20">История пуста</div>
                                  ) : (
                                      <div className="space-y-4">
                                          {userLogs.map((log, idx) => (
                                              <div key={idx} className="bg-black/20 border border-white/5 p-4 rounded-xl flex items-start justify-between">
                                                  <div>
                                                      <div className="font-bold text-sm uppercase text-zinc-300">{log.action}</div>
                                                      <div className="text-xs text-zinc-500 mt-1">{log.reason}</div>
                                                      <div className="text-[10px] text-zinc-600 mt-2 font-mono">{new Date(log.date).toLocaleString()}</div>
                                                  </div>
                                                  <div className="text-right">
                                                      <div className="text-[10px] uppercase text-zinc-600">Issued By</div>
                                                      <div className="text-xs font-bold text-purple-400">ID: {log.adminId}</div>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
              ) : (
                  // EMPTY STATE
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                      <div className="w-20 h-20 rounded-full border-2 border-zinc-800 flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 opacity-50" />
                      </div>
                      <div className="text-sm uppercase tracking-widest">Выберите агента из списка</div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default LoginPage;