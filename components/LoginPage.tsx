import React, { useState, useEffect, useRef } from 'react';
import { DiscordIcon } from './DiscordIcon';
import { 
    ShieldCheck, Lock, Cpu, LogOut, Ban, Users, Search, 
    RefreshCw, ChevronLeft, ArrowUpCircle, 
    ArrowDownCircle, UserPlus, Trash2, Check, AlertTriangle, Eye,
    Send, X, Loader2, AlertCircle, History, User, Coffee, Sparkles, Volume2,
    LayoutDashboard, Terminal, Activity, Zap, Shield, Calendar, FileText, Bell, PenSquare, Gamepad2, ShieldAlert, Image, Plane, Info, BarChart3, Gavel, FileSearch, Clock, Wallet, Coins
} from 'lucide-react';

// ==========================================
// CONFIGURATION
// ==========================================
const DISCORD_CLIENT_ID = '1468331655646417203'; 
const TARGET_GUILD_ID = '1458138848822431770'; 
const STAFF_ROLE_ID = '1458158245700046901';
const CURATOR_ROLE_ID = '1458277039399374991';
const TWO_FA_EXPIRY_KEY = 'two_fa_expiry';

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
    "1459285694458626222": { name: "СТАЖЁР", color: "text-blue-400", weight: 1, bg: "bg-blue-500/10 border-blue-500/20" },
    "1458158059187732666": { name: "МЛ. МОДЕРАТОР", color: "text-emerald-400", weight: 2, bg: "bg-emerald-500/10 border-emerald-500/20" },
    "1458158896894967879": { name: "МОДЕРАТОР", color: "text-purple-400", weight: 3, bg: "bg-purple-500/10 border-purple-500/20" },
    "1458159110720589944": { name: "СТ. МОДЕРАТОР", color: "text-red-400", weight: 4, bg: "bg-red-500/10 border-red-500/20" },
    "1458159802105594061": { name: "ШЕФ МОДЕРАТОР", color: "text-red-600", weight: 5, bg: "bg-red-600/10 border-red-600/20" },
    "1458277039399374991": { name: "КУРАТОР", color: "text-amber-400", weight: 6, bg: "bg-amber-500/10 border-amber-500/20" },
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
    loa: { active: boolean, start: number, end: number, reason: string } | null;
    minecraftNick: string | null;
    bannerUrl: string | null;
    warnCount: number;
    balance?: number;
}

// Toast System Types
interface Toast {
    id: number;
    title: string;
    message: string;
    type: 'success' | 'info' | 'error' | 'warning';
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

// --- Calendar Component ---
const CalendarView = ({ loa }: { loa: StaffDisplay['loa'] }) => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const isLoaDay = (day: number) => {
        if (!loa || !loa.active) return false;
        const checkDate = new Date(today.getFullYear(), today.getMonth(), day).getTime();
        return checkDate >= loa.start && checkDate <= loa.end;
    };

    return (
        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 mt-6">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Календарь Активности (Текущий месяц)
            </h3>
            <div className="grid grid-cols-7 gap-2">
                {days.map(d => (
                    <div 
                        key={d} 
                        className={`
                            h-10 rounded-lg flex items-center justify-center text-xs font-bold border transition-all
                            ${isLoaDay(d) 
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                                : 'bg-black/50 border-white/5 text-zinc-600'
                            }
                            ${d === today.getDate() ? 'border-white text-white' : ''}
                        `}
                    >
                        {d}
                    </div>
                ))}
            </div>
            {loa && loa.active && (
                <div className="mt-4 p-3 bg-amber-900/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    <span>Сотрудник в отпуске до {new Date(loa.end).toLocaleDateString()}</span>
                </div>
            )}
        </div>
    );
};

// Helper: Format duration from ms
const formatDuration = (ms: number) => {
    if (ms <= 0) return '0с';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}д ${hours % 24}ч`;
    if (hours > 0) return `${hours}ч ${minutes % 60}м`;
    if (minutes > 0) return `${minutes}м ${seconds % 60}с`;
    return `${seconds}с`;
};

// Helper: Format seconds to Hours Mins
const formatSecondsToHours = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '0ч 0м';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}ч ${minutes}м`;
};

const LoginPage: React.FC = () => {
  // Auth State
  const [authStep, setAuthStep] = useState<'login' | 'dashboard'>('login');
  const [user, setUser] = useState<any>(null); // Authenticated user
  
  const [staffList, setStaffList] = useState<StaffDisplay[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'profile' | 'history' | 'appeals' | 'loa_requests' | 'stats' | 'wallet'>('profile');
  const [actionType, setActionType] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loaRequests, setLoaRequests] = useState<any[]>([]);
  const [statsData, setStatsData] = useState({ bans: 0, mutes: 0, checks: 0, playtimeSeconds: 0, history: [] });
  const [statsRange, setStatsRange] = useState<'all' | 'month' | 'week'>('all');
  const [actionReason, setActionReason] = useState('');
  const [warnCount, setWarnCount] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Wallet State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [walletHistory, setWalletHistory] = useState<any[]>([]);
  const [lastWithdrawTime, setLastWithdrawTime] = useState<number>(0);
  
  // Polling tracking
  const [lastLogCount, setLastLogCount] = useState(0);
  const [lastAppealCount, setLastAppealCount] = useState(0);
  const [lastLoaRequestCount, setLastLoaRequestCount] = useState(0);

  // Nickname Edit State
  const [showNickModal, setShowNickModal] = useState(false);
  const [newNick, setNewNick] = useState('');

  // Banner Edit State
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [newBannerUrl, setNewBannerUrl] = useState('');

  // LOA Modal State
  const [showLoaModal, setShowLoaModal] = useState(false);
  const [loaDuration, setLoaDuration] = useState(7);
  const [loaReason, setLoaReason] = useState('');

  const isAdmin = user && ALLOWED_ADMIN_IDS.includes(user.id);
  const isCurator = staffList.find(s => s.isCurrentUser)?.roleId === CURATOR_ROLE_ID;

  // TOAST HELPER
  const addToast = (title: string, message: string, type: Toast['type'] = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, title, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
      
      // Play sound based on type
      if (type === 'success') playSound('click');
      if (type === 'error') playSound('click'); // could use different sound
  };

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('access_token') || localStorage.getItem('discord_token');
    if (token) {
        localStorage.setItem('discord_token', token);
        fetchUser(token);
    }
  }, []);

  // Polling for Real-Time Updates
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/updates`);
            const data = await res.json();
            
            // New Action Logged
            if (lastLogCount > 0 && data.logsCount > lastLogCount) {
                const newLog = data.lastLog;
                if (newLog && newLog.adminId !== user.id) { // Don't notify if I did it (handled locally)
                    addToast("Новое действие", `${newLog.action.toUpperCase()} от Admin ID ${newLog.adminId}`, 'info');
                }
                // Refresh data
                fetchStaffList(user.id);
                if (selectedStaff) fetchLogs(selectedStaff.id);
            }
            if (data.logsCount !== lastLogCount) setLastLogCount(data.logsCount);

            // New Appeal
            if (lastAppealCount > 0 && data.appealsCount > lastAppealCount) {
                 addToast("Новая апелляция", "Поступила новая объяснительная!", 'warning');
                 if (isAdmin && viewTab === 'appeals') fetchAppeals();
            }
            if (data.appealsCount !== lastAppealCount) setLastAppealCount(data.appealsCount);

             // New LOA Request
             if (lastLoaRequestCount > 0 && data.loaRequestsCount > lastLoaRequestCount) {
                if (isCurator) addToast("Заявка на отпуск", "Поступил новый запрос на неактив", 'info');
                if (isCurator && viewTab === 'loa_requests') fetchLoaRequests();
           }
           if (data.loaRequestsCount !== lastLoaRequestCount) setLastLoaRequestCount(data.loaRequestsCount);

        } catch(e) {}
    }, 5000); // Check every 5 sec

    return () => clearInterval(interval);
  }, [user, lastLogCount, lastAppealCount, lastLoaRequestCount, selectedStaff, viewTab, isCurator, isAdmin]);

  const fetchUser = async (token: string) => {
      setLoading(true);
      try {
          const res = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error("Auth failed");
          const data = await res.json();
          
          setUser(data);
          fetchStaffList(data.id);
          setAuthStep('dashboard');

      } catch (e: any) {
          console.error(e);
          // Only clear token if it's a hard auth failure
          if (e.message === "Auth failed") localStorage.removeItem('discord_token');
      } finally {
          setLoading(false);
      }
  };

  const fetchStaffList = async (myId: string) => {
      try {
          const res = await fetch(`${API_URL}/staff`);
          
          if (res.status === 503) {
             addToast("Сервер запускается", "Бот подключается к Discord API...", "info");
             setTimeout(() => fetchStaffList(myId), 2000);
             return;
          }

          const data = await res.json();
          
          if (!Array.isArray(data)) {
              if (data.error) throw new Error(data.error);
              throw new Error("Invalid response");
          }

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
                 loa: m.loa ? { ...m.loa, active: m.loa.active } : null,
                 weight: bestRole.weight,
                 minecraftNick: m.minecraftNick,
                 bannerUrl: m.bannerUrl,
                 warnCount: m.warnCount || 0,
                 balance: m.balance || 0
             };
          }).sort((a: any, b: any) => b.weight - a.weight);
          
          setStaffList(formatted);
          
          // REAL-TIME SYNC: Update selectedStaff if it exists to match new data
          setSelectedStaff(prev => {
              if (!prev) return null;
              const updated = formatted.find((s: StaffDisplay) => s.id === prev.id);
              return updated || prev;
          });

      } catch(e: any) {
          console.error("Failed to fetch staff list:", e);
          addToast("Ошибка соединения", "Не удалось загрузить список сотрудников. Сервер недоступен.", "error");
      }
  };

  const fetchLogs = async (userId: string) => {
      try {
          const res = await fetch(`${API_URL}/logs/${userId}`);
          const data = await res.json();
          setUserLogs(data);
      } catch(e) { setUserLogs([]); }
  };

  const fetchStats = async (ign: string, range: string) => {
      try {
          const res = await fetch(`${API_URL}/stats/${ign}?range=${range}`);
          const data = await res.json();
          setStatsData(data);
      } catch(e) { setStatsData({ bans: 0, mutes: 0, checks: 0, playtimeSeconds: 0, history: [] }); }
  };

  const fetchWalletHistory = async (userId: string) => {
      try {
          const res = await fetch(`${API_URL}/economy/history/${userId}`);
          const data = await res.json();
          setWalletHistory(data.logs);
          setLastWithdrawTime(data.lastWithdraw);
      } catch(e) { setWalletHistory([]); }
  }

  const fetchAppeals = async () => {
      try {
          const res = await fetch(`${API_URL}/appeals`);
          const data = await res.json();
          setAppeals(data);
      } catch(e) {}
  };

  const fetchLoaRequests = async () => {
      try {
          const res = await fetch(`${API_URL}/loa/requests`);
          const data = await res.json();
          setLoaRequests(data);
      } catch(e) {}
  };

  const handleSelectStaff = (member: StaffDisplay) => {
      playSound('click');
      setSelectedStaff(member);
      setViewTab('profile');
      setActionType(null);
      fetchLogs(member.id);
  };

  const handleSelfClick = () => {
      if (!user) return;
      const me = staffList.find(s => s.isCurrentUser);
      if (me) handleSelectStaff(me);
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
                targetRoleId: null, // Auto calculated on server
                reason: actionReason,
                warnCount,
                adminId: user.id
            })
        });
        
        addToast('Успешно', `Действие ${actionType} выполнено`, 'success');

        setActionType(null);
        fetchLogs(selectedStaff.id); 
        fetchStaffList(user.id); 
      } catch(e) {
          addToast('Ошибка', 'Не удалось выполнить действие', 'error');
      } finally {
          setIsSending(false);
      }
  };

  const handleAppealResolve = async (appealId: string, action: 'approve' | 'reject') => {
      try {
          await fetch(`${API_URL}/appeals/resolve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appealId, action, adminId: user.id })
          });
          addToast('Решение принято', action === 'approve' ? 'Апелляция принята' : 'Апелляция отклонена', 'success');
          fetchAppeals();
      } catch(e) {
        addToast('Ошибка', 'Не удалось обработать апелляцию', 'error');
      }
  };

  const handleLoaResolve = async (requestId: string, action: 'approve' | 'reject') => {
      try {
          await fetch(`${API_URL}/loa/resolve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId, action, adminId: user.id })
          });
          addToast('Решение принято', action === 'approve' ? 'Отпуск одобрен' : 'Отпуск отклонен', 'success');
          fetchLoaRequests();
          fetchStaffList(user.id);
      } catch(e) {
          addToast('Ошибка', 'Не удалось обработать заявку', 'error');
      }
  };

  const handleSaveNick = async () => {
      if (!selectedStaff) return;
      try {
          await fetch(`${API_URL}/set-nickname`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetId: selectedStaff.id, nickname: newNick })
          });
          
          addToast('Успешно', 'IGN обновлен', 'success');
          setShowNickModal(false);
          await fetchStaffList(user.id);
      } catch(e) { addToast('Ошибка', 'Не удалось сохранить ник', 'error'); }
  };

  const handleSaveBanner = async () => {
      if (!selectedStaff && !newBannerUrl.includes('http')) return;
      const targetId = selectedStaff ? selectedStaff.id : user.id;

      try {
          await fetch(`${API_URL}/set-banner`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetId: targetId, bannerUrl: newBannerUrl })
          });
          
          addToast('Успешно', 'Баннер обновлен', 'success');
          setShowBannerModal(false);
          setNewBannerUrl('');
          await fetchStaffList(user.id);
      } catch(e) { addToast('Ошибка', 'Не удалось сохранить баннер', 'error'); }
  }

  const handleDeleteBanner = async () => {
      if (!selectedStaff) return;
      try {
          await fetch(`${API_URL}/set-banner`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetId: selectedStaff.id, bannerUrl: '' })
          });
          
          addToast('Успешно', 'Баннер удален', 'success');
          await fetchStaffList(user.id);
      } catch(e) { addToast('Ошибка', 'Не удалось удалить баннер', 'error'); }
  }

  const handleLoaClick = (e: React.MouseEvent) => {
      e.stopPropagation(); 
      const me = staffList.find(s => s.isCurrentUser);
      if (me?.loa && me.loa.active) {
          submitStopLoa();
      } else {
          setShowLoaModal(true);
      }
  };

  const requestLoa = async () => {
      if (!user) return;
      try {
          const res = await fetch(`${API_URL}/loa/request`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                   userId: user.id, 
                   username: user.username,
                   duration: loaDuration, 
                   reason: loaReason
               })
          });
          
          if (!res.ok) {
              const err = await res.json();
              addToast('Ошибка', err.error, 'error');
              return;
          }

          setShowLoaModal(false);
          addToast('Успешно', 'Заявка отправлена куратору', 'success');
      } catch(e) {}
  }

  const submitStopLoa = async () => {
      if (!user) return;
      try {
          await fetch(`${API_URL}/loa/stop`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id })
          });
          await fetchStaffList(user.id);
          addToast('Успешно', 'Вы вернулись из неактива', 'success');
      } catch(e) {}
  }

  const handleWithdraw = async () => {
      if (!selectedStaff || !user) return;
      if (!selectedStaff.minecraftNick) {
          addToast('Ошибка', 'Необходимо установить IGN (Minecraft) для вывода', 'error');
          return;
      }
      if (withdrawAmount <= 0) {
          addToast('Ошибка', 'Сумма должна быть больше 0', 'error');
          return;
      }

      setIsSending(true);
      try {
          const res = await fetch(`${API_URL}/economy/withdraw`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  userId: selectedStaff.id,
                  amount: withdrawAmount,
                  minecraftNick: selectedStaff.minecraftNick
              })
          });

          const data = await res.json();
          if (!res.ok) {
              addToast('Ошибка', data.error || 'Ошибка вывода', 'error');
          } else {
              addToast('Успешно', data.message, 'success');
              setWithdrawAmount(0);
              fetchStaffList(user.id); // Refresh balance
              fetchWalletHistory(selectedStaff.id);
          }
      } catch(e) {
          addToast('Ошибка', 'Не удалось выполнить запрос', 'error');
      } finally {
          setIsSending(false);
      }
  };

  const handleAdminEconomy = async (action: 'give' | 'take' | 'set') => {
      if (!selectedStaff || !user || !isAdmin) return;
      
      const amount = parseInt(prompt(`Введите количество (${action.toUpperCase()}):`, '0') || '0');
      if (amount <= 0) return;

      try {
          const res = await fetch(`${API_URL}/economy/manage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  adminId: user.id,
                  targetId: selectedStaff.id,
                  amount: amount,
                  action: action
              })
          });
          
          if (res.ok) {
              addToast('Успешно', 'Баланс обновлен', 'success');
              fetchStaffList(user.id);
              fetchWalletHistory(selectedStaff.id);
          } else {
              addToast('Ошибка', 'Не удалось обновить баланс', 'error');
          }
      } catch(e) { addToast('Ошибка', 'Сбой запроса', 'error'); }
  };

  const filteredStaff = staffList.filter(s => s.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

  // ============================
  // RENDER: LOGIN SCREEN (Step 1)
  // ============================
  if (authStep === 'login') return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
          <ParticleBackground />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#050505_100%)] opacity-80"></div>
          
          {loading ? (
             <div className="relative z-10 flex flex-col items-center gap-4 animate-pulse">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                <div className="text-zinc-500 text-xs font-bold tracking-widest uppercase">Загрузка...</div>
             </div>
          ) : (
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
                        <div className="text-xl font-black text-white tracking-tight">АВТОРИЗАЦИЯ</div>
                    </div>
                </div>
            </button>
          )}
      </div>
  );

  // ============================
  // RENDER: DASHBOARD (Step 2)
  // ============================
  return (
    <div className="min-h-screen w-full bg-[#030303] text-zinc-100 overflow-hidden flex font-sans selection:bg-purple-500/30">
      <ParticleBackground />
      
      {/* TOAST CONTAINER */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
          {toasts.map(toast => (
              <div 
                  key={toast.id} 
                  className="bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl w-80 pointer-events-auto animate-in slide-in-from-right fade-in duration-300 flex items-start gap-3"
              >
                  <div className={`p-2 rounded-lg ${
                      toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                      toast.type === 'error' ? 'bg-red-500/10 text-red-500' :
                      toast.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-500'
                  }`}>
                      {toast.type === 'success' ? <Check className="w-4 h-4" /> :
                       toast.type === 'error' ? <X className="w-4 h-4" /> :
                       toast.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                       <Info className="w-4 h-4" />}
                  </div>
                  <div>
                      <h4 className={`text-xs font-bold uppercase mb-0.5 ${
                          toast.type === 'success' ? 'text-emerald-400' :
                          toast.type === 'error' ? 'text-red-400' :
                          toast.type === 'warning' ? 'text-amber-400' :
                          'text-blue-400'
                      }`}>{toast.title}</h4>
                      <p className="text-[11px] text-zinc-400 leading-tight">{toast.message}</p>
                  </div>
              </div>
          ))}
      </div>

      {/* BANNER MODAL */}
      {showBannerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-200">
                  <button onClick={() => setShowBannerModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                  <h3 className="text-lg font-bold uppercase tracking-tight mb-4">Изменить баннер</h3>
                  <div className="space-y-4">
                      <input 
                        type="text" 
                        value={newBannerUrl}
                        onChange={(e) => setNewBannerUrl(e.target.value)}
                        placeholder="Ссылка на изображение (https://...)"
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
                      />
                      <button 
                        onClick={handleSaveBanner}
                        className="w-full py-3 bg-white text-black font-black uppercase rounded-xl hover:bg-zinc-200 transition-colors text-xs tracking-widest"
                      >
                          Сохранить
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* NICKNAME MODAL */}
      {showNickModal && selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-200">
                  <button onClick={() => setShowNickModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                  <h3 className="text-lg font-bold uppercase tracking-tight mb-4">Установить IGN (Minecraft)</h3>
                  <div className="space-y-4">
                      <input 
                        type="text" 
                        value={newNick}
                        onChange={(e) => setNewNick(e.target.value)}
                        placeholder="Введите никнейм..."
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
                      />
                      <button 
                        onClick={handleSaveNick}
                        className="w-full py-3 bg-white text-black font-black uppercase rounded-xl hover:bg-zinc-200 transition-colors text-xs tracking-widest"
                      >
                          Сохранить
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* LOA REQUEST MODAL */}
      {showLoaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
                  <button onClick={() => setShowLoaModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <Plane className="w-5 h-5 text-amber-500" />
                      </div>
                      <h3 className="text-lg font-bold uppercase tracking-tight">Заявка на Неактив</h3>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 mb-4">
                          ⚠️ Заявка будет отправлена на рассмотрение Куратору. Статус неактива не будет активирован моментально.
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Длительность (Дней)</label>
                          <input 
                            type="number" 
                            value={loaDuration}
                            onChange={(e) => setLoaDuration(parseInt(e.target.value))}
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
                            min="1" max="30"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Причина</label>
                          <textarea 
                            value={loaReason}
                            onChange={(e) => setLoaReason(e.target.value)}
                            placeholder="Почему вам нужен отпуск?"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm h-24 outline-none focus:border-purple-500 transition-colors resize-none"
                          ></textarea>
                      </div>
                      <button 
                        onClick={requestLoa}
                        className="w-full py-3 bg-white text-black font-black uppercase rounded-xl hover:bg-zinc-200 transition-colors text-xs tracking-widest mt-2"
                      >
                          Отправить заявку
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* SIDEBAR */}
      <div className="w-[80px] md:w-[320px] bg-[#050505] border-r border-white/5 flex flex-col z-20 transition-all duration-300">
          {/* Header */}
          <div className="h-20 flex items-center justify-center md:justify-start md:px-6 border-b border-white/5">
                <img src="/images/logo.png" alt="NULLX" className="w-auto h-8 object-contain" />
                <div className="hidden md:block ml-4">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mt-1">Панель Управления</div>
                </div>
          </div>

          {/* User Status Card */}
          <div className="hidden md:block p-6 border-b border-white/5 bg-white/[0.01]">
              <div 
                  className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors group"
                  onClick={handleSelfClick}
                  title="Открыть мой профиль"
              >
                  <div className="relative">
                    <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-10 h-10 rounded-lg bg-zinc-800" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050505]"></div>
                  </div>
                  <div className="overflow-hidden">
                      <div className="font-bold text-sm truncate group-hover:text-purple-400 transition-colors">{user.username}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{user.id}</div>
                  </div>
              </div>
              <button 
                  onClick={handleLoaClick}
                  className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${staffList.find(s => s.isCurrentUser)?.loa?.active ? 'bg-amber-900/20 border-amber-500/50 text-amber-500 hover:bg-amber-900/40' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
              >
                  <Coffee className="w-3 h-3" /> {staffList.find(s => s.isCurrentUser)?.loa?.active ? 'Снять Неактив' : 'Взять Неактив'}
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
                      placeholder="Поиск..." 
                      className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-9 text-xs text-zinc-300 focus:border-purple-500/50 outline-none transition-all placeholder:text-zinc-700"
                  />
              </div>
          </div>

          {/* Staff List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 space-y-1">
              {staffList.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                      <div className="text-[10px] font-bold uppercase tracking-widest">Загрузка...</div>
                  </div>
              )}
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
                              {s.loa && s.loa.active && <div className="absolute -top-1 -right-1 bg-amber-600 w-2.5 h-2.5 rounded-full border-2 border-[#050505]" title="В отпуске"></div>}
                          </div>
                          <div className="hidden md:block overflow-hidden">
                              <div className={`font-bold text-xs truncate ${selectedStaff?.id === s.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{s.displayName}</div>
                              {s.minecraftNick && (
                                  <div className={`text-[8px] font-mono flex items-center gap-1 mb-0.5 ${selectedStaff?.id === s.id ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                      <Gamepad2 className="w-2 h-2" /> {s.minecraftNick}
                                  </div>
                              )}
                              <div className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 ${s.roleColor}`}>{s.roleName}</div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
          
          <div className="p-4 border-t border-white/5">
              <button 
                  onClick={() => { localStorage.removeItem('discord_token'); localStorage.removeItem(TWO_FA_EXPIRY_KEY); window.location.reload(); }}
                  className="w-full flex items-center justify-center md:justify-start gap-3 text-zinc-600 hover:text-red-400 transition-colors p-2"
              >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline text-xs font-bold uppercase">Выйти</span>
              </button>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 relative flex flex-col bg-[#030303] z-10">
          {/* Header/Breadcrumbs */}
          <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#030303]/50 backdrop-blur-md sticky top-0 z-30">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <Terminal className="w-4 h-4" />
                  <span>СИСТЕМА</span>
                  <span>/</span>
                  <span className={selectedStaff ? 'text-purple-400' : ''}>{selectedStaff ? 'УПРАВЛЕНИЕ_ПЕРСОНАЛОМ' : 'ОЖИДАНИЕ'}</span>
              </div>
              <div className="flex items-center gap-4">
                  {isCurator && (
                    <button 
                        onClick={() => { setViewTab('loa_requests'); fetchLoaRequests(); setSelectedStaff(null); }}
                        className="flex items-center gap-2 text-[10px] text-zinc-300 bg-white/5 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <Plane className="w-3 h-3 text-blue-500" />
                        ОТПУСКИ
                        {loaRequests.length > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>}
                    </button>
                  )}
                  {isAdmin && (
                    <button 
                        onClick={() => { setViewTab('appeals'); fetchAppeals(); setSelectedStaff(null); }}
                        className="flex items-center gap-2 text-[10px] text-zinc-300 bg-white/5 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <Bell className="w-3 h-3 text-amber-500" />
                        АПЕЛЛЯЦИИ
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600 bg-white/5 px-3 py-1.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      СЕРВЕР: ONLINE
                  </div>
              </div>
          </div>

          {viewTab === 'loa_requests' && isCurator ? (
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <Plane className="w-6 h-6 text-blue-500" />
                        ЗАЯВКИ НА ОТПУСК
                    </h2>
                    {loaRequests.length === 0 ? (
                        <div className="p-12 text-center border border-white/5 rounded-3xl bg-[#0a0a0a]">
                            <Check className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <div className="text-zinc-500 font-bold">Нет активных заявок</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {loaRequests.map(req => (
                                <div key={req.id} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative group hover:border-blue-500/30 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-lg font-bold text-white mb-1">{req.username}</div>
                                            <div className="text-xs text-zinc-500 font-mono">ID: {req.userId}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-blue-400 mb-1">{req.duration} дней</div>
                                            <div className="text-[10px] font-mono text-zinc-600">{new Date(req.date).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-xl text-sm text-zinc-300 font-medium mb-6">
                                        Причина: "{req.reason}"
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleLoaResolve(req.id, 'approve')}
                                            className="px-4 py-2 bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold uppercase hover:bg-emerald-900/40 transition-colors flex items-center gap-2"
                                        >
                                            <Check className="w-4 h-4" /> Одобрить
                                        </button>
                                        <button 
                                            onClick={() => handleLoaResolve(req.id, 'reject')}
                                            className="px-4 py-2 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold uppercase hover:bg-red-900/40 transition-colors flex items-center gap-2"
                                        >
                                            <X className="w-4 h-4" /> Отклонить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </div>
          ) : viewTab === 'appeals' && isAdmin ? (
             <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <FileText className="w-6 h-6 text-purple-500" />
                        АКТИВНЫЕ АПЕЛЛЯЦИИ
                    </h2>
                    {appeals.length === 0 ? (
                        <div className="p-12 text-center border border-white/5 rounded-3xl bg-[#0a0a0a]">
                            <Check className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <div className="text-zinc-500 font-bold">Нет активных объяснительных</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {appeals.map(app => (
                                <div key={app.id} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative group hover:border-purple-500/30 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-lg font-bold text-white mb-1">{app.username}</div>
                                            <div className="text-xs text-zinc-500 font-mono">ID: {app.userId}</div>
                                        </div>
                                        <div className="text-[10px] font-mono text-zinc-600">{new Date(app.date).toLocaleString()}</div>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-xl text-sm text-zinc-300 font-medium mb-6">
                                        "{app.text}"
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleAppealResolve(app.id, 'approve')}
                                            className="px-4 py-2 bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold uppercase hover:bg-emerald-900/40 transition-colors flex items-center gap-2"
                                        >
                                            <Check className="w-4 h-4" /> Принять (Снять варн)
                                        </button>
                                        <button 
                                            onClick={() => handleAppealResolve(app.id, 'reject')}
                                            className="px-4 py-2 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold uppercase hover:bg-red-900/40 transition-colors flex items-center gap-2"
                                        >
                                            <X className="w-4 h-4" /> Отклонить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </div>
          ) : selectedStaff ? (
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                  <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      {/* PROFILE HEADER CARD */}
                      <div className="w-full bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 mb-8 relative overflow-hidden group">
                          {/* BANNER BACKGROUND */}
                          {selectedStaff.bannerUrl ? (
                              <>
                                <div 
                                    className="absolute inset-0 bg-cover bg-center z-0 opacity-40 group-hover:opacity-50 transition-opacity duration-500"
                                    style={{ backgroundImage: `url(${selectedStaff.bannerUrl})` }}
                                ></div>
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent z-0"></div>
                              </>
                          ) : (
                              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                          )}
                          
                          <div className="flex flex-col md:flex-row items-start gap-8 relative z-10">
                              {/* AVATAR BOX */}
                              <div className="shrink-0 relative group/avatar">
                                  <div className="w-40 h-40 rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden relative shadow-2xl">
                                      <img 
                                          src={`https://minotar.net/armor/bust/${selectedStaff.minecraftNick || selectedStaff.displayName}/300.png`}
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
                                          <div className="flex items-center gap-3 mb-2">
                                            {/* RED ARROW SPOT: MINECRAFT NICK (or DisplayName fallback) */}
                                            <h1 className="text-4xl font-black text-white tracking-tighter uppercase drop-shadow-lg">
                                                {selectedStaff.minecraftNick || selectedStaff.displayName}
                                            </h1>
                                            
                                            {/* BLUE ARROW SPOT: DISCORD USERNAME */}
                                            <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded text-[10px] text-zinc-400 font-mono" title="Discord Username">
                                                <DiscordIcon className="w-3 h-3" />
                                                {selectedStaff.username}
                                            </div>
                                          </div>
                                          
                                          <div className="flex flex-col gap-2">
                                              {/* ROW 1: ROLE | STATUS | LOA | SET BANNER */}
                                              <div className="flex flex-wrap items-center gap-3">
                                                  <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${selectedStaff.roleBg} ${selectedStaff.roleColor} shadow-lg backdrop-blur-sm`}>
                                                      {selectedStaff.roleName}
                                                  </div>
                                                  
                                                  {/* STATUS INDICATOR */}
                                                  <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase flex items-center gap-2 backdrop-blur-sm ${
                                                      selectedStaff.status === 'online' || selectedStaff.status === 'dnd' || selectedStaff.status === 'idle'
                                                      ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' 
                                                      : 'bg-zinc-900/80 border-zinc-700 text-zinc-500'
                                                  }`}>
                                                      <div className={`w-2 h-2 rounded-full ${selectedStaff.status === 'online' || selectedStaff.status === 'dnd' || selectedStaff.status === 'idle' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                                                      {selectedStaff.status === 'offline' ? 'OFFLINE' : 'ONLINE'}
                                                  </div>

                                                  {selectedStaff.loa && selectedStaff.loa.active && (
                                                      <div className="px-3 py-1 rounded bg-amber-900/20 border border-amber-500/50 text-amber-500 text-[10px] font-bold uppercase flex items-center gap-2 backdrop-blur-sm">
                                                          <Coffee className="w-3 h-3" /> В ОТПУСКЕ
                                                      </div>
                                                  )}

                                                  {/* SET BANNER (User only) */}
                                                  {selectedStaff.isCurrentUser && (
                                                      <button 
                                                        onClick={() => { setNewBannerUrl(selectedStaff.bannerUrl || ''); setShowBannerModal(true); }}
                                                        className="px-2 py-1 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 rounded text-purple-300 transition-colors flex items-center gap-1 text-[10px] font-bold backdrop-blur-sm"
                                                        title="Изменить фон"
                                                      >
                                                          <Image className="w-3 h-3" /> ФОН
                                                      </button>
                                                  )}
                                              </div>

                                              {/* ROW 2: ID | WARN COUNT | EDIT IGN | DELETE BANNER */}
                                              <div className="flex flex-wrap items-center gap-3">
                                                  <div className="px-3 py-1 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-[10px] font-mono backdrop-blur-sm">
                                                      ID: {selectedStaff.id}
                                                  </div>

                                                  {/* WARN COUNT DISPLAY */}
                                                  <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase flex items-center gap-2 backdrop-blur-sm ${
                                                      selectedStaff.warnCount > 0 
                                                      ? 'bg-red-900/20 border-red-500/50 text-red-400' 
                                                      : 'bg-zinc-900/80 border-zinc-700 text-zinc-500'
                                                  }`}>
                                                      <AlertTriangle className={`w-3 h-3 ${selectedStaff.warnCount > 0 ? 'text-red-500' : 'text-zinc-600'}`} />
                                                      WARNS: {selectedStaff.warnCount}
                                                  </div>
                                                  
                                                  {isAdmin && (
                                                      <button 
                                                        onClick={() => { setNewNick(selectedStaff.minecraftNick || ''); setShowNickModal(true); }}
                                                        className="px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold backdrop-blur-sm"
                                                        title="Изменить никнейм"
                                                      >
                                                          <PenSquare className="w-3 h-3" /> IGN
                                                      </button>
                                                  )}

                                                  {isAdmin && selectedStaff.bannerUrl && (
                                                      <button 
                                                        onClick={handleDeleteBanner}
                                                        className="px-2 py-1 bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 rounded text-red-300 transition-colors flex items-center gap-1 text-[10px] font-bold backdrop-blur-sm"
                                                        title="Удалить баннер"
                                                      >
                                                          <Trash2 className="w-3 h-3" />
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                      
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => setViewTab('profile')}
                                              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border backdrop-blur-sm ${viewTab === 'profile' ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                                          >
                                              Обзор
                                          </button>
                                          <button 
                                              onClick={() => { setViewTab('history'); fetchLogs(selectedStaff.id); }}
                                              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border backdrop-blur-sm ${viewTab === 'history' ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                                          >
                                              Логи
                                          </button>
                                          <button 
                                              onClick={() => { setViewTab('stats'); fetchStats(selectedStaff.minecraftNick || '', 'all'); }}
                                              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border backdrop-blur-sm flex items-center gap-2 ${viewTab === 'stats' ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                                          >
                                              <BarChart3 className="w-3 h-3" />
                                              Статистика
                                          </button>
                                          {/* WALLET BUTTON (Only for Self or Admin) */}
                                          {(selectedStaff.isCurrentUser || isAdmin) && (
                                              <button 
                                                  onClick={() => { setViewTab('wallet'); fetchWalletHistory(selectedStaff.id); }}
                                                  className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border backdrop-blur-sm flex items-center gap-2 ${viewTab === 'wallet' ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                                              >
                                                  <Wallet className="w-3 h-3" />
                                                  Кошелек
                                              </button>
                                          )}
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
                                              <h3 className="text-lg font-bold uppercase tracking-tight">Административные Действия</h3>
                                          </div>

                                          {!actionType ? (
                                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                  <button onClick={() => setActionType('promote')} className="h-24 rounded-2xl bg-emerald-900/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <ArrowUpCircle className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Повысить</span>
                                                  </button>
                                                  <button onClick={() => setActionType('demote')} className="h-24 rounded-2xl bg-orange-900/10 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <ArrowDownCircle className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Понизить</span>
                                                  </button>
                                                  <button onClick={() => setActionType('warn')} className="h-24 rounded-2xl bg-yellow-900/10 border border-yellow-500/20 hover:bg-yellow-500/20 hover:border-yellow-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <AlertTriangle className="w-6 h-6 text-yellow-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">Варн</span>
                                                  </button>
                                                  <button onClick={() => setActionType('unwarn')} className="h-24 rounded-2xl bg-blue-900/10 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <ShieldCheck className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Снять Варн</span>
                                                  </button>
                                                  <button onClick={() => setActionType('kick')} className="h-24 rounded-2xl bg-red-900/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/50 hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
                                                      <Trash2 className="w-6 h-6 text-red-500 group-hover:text-white transition-colors" />
                                                      <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">Кикнуть</span>
                                                  </button>
                                              </div>
                                          ) : (
                                              <div className="bg-black/30 rounded-2xl p-6 border border-white/5 animate-in zoom-in-95 duration-200">
                                                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                                      <div className="flex items-center gap-3">
                                                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                                                          <span className="text-sm font-black uppercase tracking-wider text-white">Протокол: {actionType === 'promote' ? 'Повышение' : actionType === 'demote' ? 'Понижение' : actionType === 'warn' ? 'Предупреждение' : actionType}</span>
                                                      </div>
                                                      <button onClick={() => setActionType(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-zinc-500" /></button>
                                                  </div>
                                                  
                                                  <div className="space-y-4">
                                                      {(actionType === 'promote' || actionType === 'demote') && (
                                                          <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-zinc-400 text-center">
                                                              Действие будет применено автоматически согласно иерархии ролей.
                                                          </div>
                                                      )}

                                                      {actionType === 'warn' && (
                                                          <div className="space-y-2">
                                                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Уровень Варна</label>
                                                              <div className="flex gap-2">
                                                                  {[1,2,3].map(n => (
                                                                      <button key={n} onClick={() => setWarnCount(n)} className={`flex-1 py-3 rounded-xl font-black border transition-all ${warnCount === n ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-black border-white/10 text-zinc-500'}`}>{n}</button>
                                                                  ))}
                                                              </div>
                                                          </div>
                                                      )}

                                                      <div className="space-y-2">
                                                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Причина</label>
                                                          <textarea 
                                                            placeholder="Укажите подробности..." 
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
                                                          {isSending ? 'ОБРАБОТКА...' : 'ПОДТВЕРДИТЬ'}
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ) : (
                                      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-12 text-center">
                                          <Lock className="w-8 h-8 text-zinc-700 mx-auto mb-4" />
                                          <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Доступ Запрещен</div>
                                      </div>
                                  )}

                                  {/* CALENDAR VIEW */}
                                  <CalendarView loa={selectedStaff.loa} />
                              </div>

                              {/* RIGHT COL: INFO (Optional for future metrics) */}
                          </div>
                      ) : viewTab === 'wallet' ? (
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 min-h-[500px]">
                            <div className="flex items-center gap-3 mb-8">
                                <Wallet className="w-5 h-5 text-emerald-500" />
                                <h3 className="text-lg font-bold uppercase tracking-tight">Личный Кошелек</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* BALANCE CARD */}
                                <div className="bg-gradient-to-br from-emerald-900/20 to-black border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between h-64 shadow-2xl">
                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                        <Coins className="w-32 h-32 text-emerald-500" />
                                    </div>
                                    <div>
                                        <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Текущий баланс</div>
                                        <div className="text-5xl font-black text-white tracking-tight flex items-baseline gap-2">
                                            {selectedStaff.balance} <span className="text-xl text-emerald-500">AMT</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-emerald-500/60 font-mono uppercase tracking-wider mb-1">Nullx Economy Network</div>
                                        <div className="text-xs text-zinc-500">ID Транзакции: {Date.now().toString().slice(-8)}</div>
                                    </div>
                                </div>

                                {/* WITHDRAW / ADMIN FORM */}
                                <div className="bg-[#0f0f11] border border-white/10 rounded-3xl p-8 flex flex-col justify-center">
                                    
                                    {isAdmin && !selectedStaff.isCurrentUser ? (
                                        // ADMIN MANAGEMENT PANEL
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-4 text-purple-400">
                                                <Zap className="w-4 h-4" />
                                                <h4 className="text-sm font-bold uppercase tracking-wider">Управление Балансом</h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-3">
                                                <button onClick={() => handleAdminEconomy('give')} className="p-4 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold uppercase text-[10px] transition-all">Выдать</button>
                                                <button onClick={() => handleAdminEconomy('take')} className="p-4 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 rounded-xl text-red-400 font-bold uppercase text-[10px] transition-all">Забрать</button>
                                                <button onClick={() => handleAdminEconomy('set')} className="p-4 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 rounded-xl text-blue-400 font-bold uppercase text-[10px] transition-all">Установить</button>
                                            </div>
                                            <div className="text-xs text-zinc-500 text-center mt-2">Все действия логируются</div>
                                        </div>
                                    ) : (
                                        // STANDARD WITHDRAW FORM
                                        <>
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Вывод средств</h4>
                                            
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Получатель (IGN)</label>
                                                    <div className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-sm text-zinc-300 font-mono flex items-center gap-3">
                                                        <Gamepad2 className="w-4 h-4 text-zinc-500" />
                                                        {selectedStaff.minecraftNick || <span className="text-red-500">Не установлен</span>}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Сумма (Аметрины)</label>
                                                    <input 
                                                        type="number" 
                                                        value={withdrawAmount}
                                                        onChange={(e) => setWithdrawAmount(parseInt(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full bg-black border border-white/10 p-4 rounded-xl text-lg font-bold text-white outline-none focus:border-emerald-500 transition-colors"
                                                        min="1"
                                                        max={selectedStaff.balance}
                                                    />
                                                </div>

                                                <button 
                                                    onClick={handleWithdraw}
                                                    disabled={isSending || !selectedStaff.minecraftNick || withdrawAmount <= 0 || (Date.now() - lastWithdrawTime < 86400000)}
                                                    className="w-full py-4 bg-emerald-600 text-white font-black uppercase rounded-xl hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-xs tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                                >
                                                    {isSending ? 'Обработка...' : (Date.now() - lastWithdrawTime < 86400000) ? `КД до ${new Date(lastWithdrawTime + 86400000).toLocaleTimeString()}` : 'Вывести на сервер'}
                                                </button>
                                                {Date.now() - lastWithdrawTime < 86400000 && (
                                                    <div className="text-center text-[10px] text-amber-500 font-bold uppercase tracking-wide animate-pulse">
                                                        Вывод доступен раз в 24 часа
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* HISTORY */}
                            <div className="mt-8">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">История операций</h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                    {walletHistory.length === 0 ? (
                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center justify-between opacity-50">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-zinc-800 rounded-lg text-zinc-500"><Info className="w-4 h-4"/></div>
                                                <div>
                                                    <div className="text-sm font-bold text-zinc-400">Транзакций не найдено</div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        walletHistory.map((log, idx) => (
                                            <div key={idx} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${log.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {log.amount > 0 ? <ArrowUpCircle className="w-4 h-4"/> : <ArrowDownCircle className="w-4 h-4"/>}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-zinc-200">{log.type}</div>
                                                        <div className="text-[10px] text-zinc-500 font-mono">{new Date(log.date).toLocaleString()} • {log.details}</div>
                                                    </div>
                                                </div>
                                                <div className={`font-black ${log.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {log.amount > 0 ? '+' : ''}{log.amount} AMT
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                      ) : viewTab === 'stats' ? (
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 min-h-[500px]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="w-5 h-5 text-purple-500" />
                                    <h3 className="text-lg font-bold uppercase tracking-tight">Статистика Сервера</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setStatsRange('week'); fetchStats(selectedStaff.minecraftNick || '', 'week'); }}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${statsRange === 'week' ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#0f0f11] text-zinc-500 border-white/5 hover:border-white/20'}`}
                                    >
                                        Неделя
                                    </button>
                                    <button 
                                        onClick={() => { setStatsRange('month'); fetchStats(selectedStaff.minecraftNick || '', 'month'); }}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${statsRange === 'month' ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#0f0f11] text-zinc-500 border-white/5 hover:border-white/20'}`}
                                    >
                                        Месяц
                                    </button>
                                    <button 
                                        onClick={() => { setStatsRange('all'); fetchStats(selectedStaff.minecraftNick || '', 'all'); }}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${statsRange === 'all' ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#0f0f11] text-zinc-500 border-white/5 hover:border-white/20'}`}
                                    >
                                        Все время
                                    </button>
                                </div>
                            </div>

                            {!selectedStaff.minecraftNick ? (
                                <div className="p-8 bg-amber-900/10 border border-amber-500/20 rounded-2xl flex items-center gap-4 text-amber-500">
                                    <AlertCircle className="w-6 h-6" />
                                    <div>
                                        <div className="font-bold">IGN не установлен</div>
                                        <div className="text-xs opacity-70">Для отображения статистики из базы данных, необходимо установить Minecraft Nickname в профиле сотрудника.</div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                        {/* BANS CARD */}
                                        <div className="bg-[#0f0f11] border border-white/10 p-6 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-center text-center">
                                            <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                                            <Gavel className="w-8 h-8 text-red-500 mb-3" />
                                            <div className="text-4xl font-black text-white mb-1">{statsData.bans}</div>
                                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Всего Банов</div>
                                        </div>

                                        {/* MUTES CARD */}
                                        <div className="bg-[#0f0f11] border border-white/10 p-6 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-center text-center">
                                            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                                            <Volume2 className="w-8 h-8 text-blue-500 mb-3" />
                                            <div className="text-4xl font-black text-white mb-1">{statsData.mutes}</div>
                                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Всего Мутов</div>
                                        </div>

                                        {/* CHECKS CARD */}
                                        <div className="bg-[#0f0f11] border border-white/10 p-6 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-center text-center">
                                            <div className="absolute inset-0 bg-cyan-500/5 group-hover:bg-cyan-500/10 transition-colors"></div>
                                            <FileSearch className="w-8 h-8 text-cyan-500 mb-3" />
                                            <div className="text-4xl font-black text-white mb-1">{statsData.checks}</div>
                                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Проверок</div>
                                        </div>

                                        {/* PLAYTIME CARD */}
                                        <div className="bg-[#0f0f11] border border-white/10 p-6 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-center text-center">
                                            <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors"></div>
                                            <Clock className="w-8 h-8 text-amber-500 mb-3" />
                                            <div className="text-2xl font-black text-white mb-1">{formatSecondsToHours(statsData.playtimeSeconds)}</div>
                                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Онлайн</div>
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">История Наказаний и Проверок</h4>
                                    <div className="space-y-2">
                                        {statsData.history.length === 0 ? (
                                            <div className="text-zinc-600 text-xs font-mono">Нет записей за выбранный период</div>
                                        ) : (
                                            statsData.history.map((h: any, i) => {
                                                // Common
                                                const dateStr = new Date(h.time).toLocaleString();

                                                if (h.type === 'CHECK') {
                                                    return (
                                                        <div key={i} className="bg-cyan-900/10 border border-cyan-500/20 p-4 rounded-xl flex flex-col gap-2 relative group hover:bg-cyan-900/20 transition-colors">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 rounded-l-xl"></div>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                                                                        <FileSearch className="w-4 h-4"/>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-bold text-zinc-200">Проверка игрока <span className="text-white">{h.target}</span></div>
                                                                        <div className="text-[10px] text-zinc-500 font-mono">
                                                                            Проведен: {dateStr}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="px-3 py-1 rounded bg-black/40 border border-white/10 text-[10px] font-bold uppercase text-cyan-300">
                                                                    {h.displayType}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Ban/Mute Logic
                                                const startTime = parseInt(h.time);
                                                const endTime = parseInt(h.until);
                                                const isPermanent = endTime <= 0;
                                                const duration = isPermanent ? 'Навсегда' : formatDuration(endTime - startTime);
                                                const expiresAt = isPermanent ? 'Никогда' : new Date(endTime).toLocaleString();
                                                const isRemoved = h.removed_by_name !== null;

                                                return (
                                                    <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg ${h.type === 'ban' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                                    {h.type === 'ban' ? <Gavel className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-zinc-200">{h.reason}</div>
                                                                    <div className="text-[10px] text-zinc-500 font-mono">
                                                                        Выдан: {new Date(startTime).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-400 pl-11">
                                                            {isRemoved ? (
                                                                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                                    <span className="text-emerald-400 font-bold uppercase">Снял: {h.removed_by_name}</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded">
                                                                        <History className="w-3 h-3 text-zinc-500" />
                                                                        <span>Срок: <span className="text-zinc-300">{duration}</span></span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded">
                                                                        <Calendar className="w-3 h-3 text-zinc-500" />
                                                                        <span>Истекает: <span className="text-zinc-300">{expiresAt}</span></span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                      ) : (
                          <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 min-h-[500px]">
                              <div className="flex items-center gap-3 mb-8">
                                  <History className="w-5 h-5 text-purple-500" />
                                  <h3 className="text-lg font-bold uppercase tracking-tight">История Действий</h3>
                              </div>
                              
                              <div className="relative border-l border-white/10 ml-3 space-y-8">
                                  {userLogs.length === 0 ? (
                                      <div className="pl-8 text-zinc-600 text-xs font-mono">НЕТ ЗАПИСЕЙ</div>
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
                                                      Админ ID: <span className="font-mono text-zinc-400">{log.adminId}</span>
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
                          <h2 className="text-2xl font-black text-white tracking-tight mb-2">ОЖИДАНИЕ ВВОДА</h2>
                          <p className="text-zinc-500 text-xs uppercase tracking-widest">Выберите сотрудника из списка слева</p>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default LoginPage;