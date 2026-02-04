import React, { useState, useEffect } from 'react';
import { DiscordIcon } from './DiscordIcon';
import { 
    ShieldCheck, Lock, Cpu, LogOut, Ban, Users, Search, 
    RefreshCw, ChevronLeft, ArrowUpCircle, 
    ArrowDownCircle, UserPlus, Trash2, Check, AlertTriangle, Eye,
    Send, X, Loader2, AlertCircle
} from 'lucide-react';

// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
const DISCORD_CLIENT_ID = '1468331655646417203'; 
const TARGET_GUILD_ID = '1458138848822431770'; 
const STAFF_ROLE_ID = '1458158245700046901';

// СПИСОК ID, ИМЕЮЩИХ ПОЛНЫЙ ДОСТУП
const ALLOWED_ADMIN_IDS = [
    '802105175720460318',
    '440704669178789888',
    '591281053503848469',
    '1455582084893642998',
    '846540575032344596',
    '1468330580910542868'
];

// 1. СЮДА ВСТАВЬТЕ ССЫЛКУ, КОТОРУЮ ВАМ ДАСТ RENDER ПОСЛЕ СОЗДАНИЯ СЕРВИСА
// Пример: 'https://my-super-bot.onrender.com/api'
const PROD_API_URL = 'https://nullx-backend.onrender.com/api'; 

const API_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:4000/api'
    : PROD_API_URL;

interface RoleDef {
    id: string;
    name: string;
    color: string;
    weight: number;
    rank_v: string; 
    game_group: string;
}

const ROLE_DEFINITIONS: Record<string, Omit<RoleDef, 'id'>> = {
    "1459285694458626222": { name: "Стажёр", color: "text-blue-400", weight: 1, rank_v: "стажёра", game_group: "trainee" },
    "1458158059187732666": { name: "Младший модератор", color: "text-emerald-400", weight: 2, rank_v: "младшего модератора", game_group: "jrmoder" },
    "1458158896894967879": { name: "Модератор", color: "text-purple-400", weight: 3, rank_v: "модератора", game_group: "moder" },
    "1458159110720589944": { name: "Старший модератор", color: "text-red-500", weight: 4, rank_v: "старшего модератора", game_group: "srmoder" },
    "1458159802105594061": { name: "Шеф модератор", color: "text-red-600", weight: 5, rank_v: "шеф модератора", game_group: "chief" },
    "1458277039399374991": { name: "Куратор", color: "text-amber-400", weight: 6, rank_v: "куратора", game_group: "curator" },
};

const getRedirectUri = () => {
  if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      // Если запускаем локально
      if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000/';
      // Если запускаем на Vercel - берем текущий адрес сайта автоматически
      return `${window.location.origin}/`; 
  }
  // Запасной вариант (замените на ваш реальный домен Vercel)
  return 'https://o-auth2-null-x.vercel.app';
};

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
  global_name?: string;
  roles?: string[]; 
}

interface StaffDisplay {
  id: string;
  username: string;
  avatarUrl: string;
  roleId: string;
  roleName: string;
  roleColor?: string; 
  isCurrentUser: boolean;
  status: string;
  weight: number;
}

const LoginPage: React.FC = () => {
  const [mainLogoError, setMainLogoError] = useState(false);
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [userRoleInfo, setUserRoleInfo] = useState<{name: string, color: string} | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Staff List State
  const [staffList, setStaffList] = useState<StaffDisplay[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [widgetError, setWidgetError] = useState(false);

  // Management State
  const [selectedStaff, setSelectedStaff] = useState<StaffDisplay | null>(null);
  const [actionType, setActionType] = useState<'hire' | 'promote' | 'demote' | 'warn' | 'unwarn' | 'kick' | null>(null);
  const [targetRoleId, setTargetRoleId] = useState<string>('');
  const [targetRoleName, setTargetRoleName] = useState<string>(''); // For display
  const [actionReason, setActionReason] = useState('');
  const [warnCount, setWarnCount] = useState(1);
  
  // Async Action State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = user && ALLOWED_ADMIN_IDS.includes(user.id);

  // === SESSION MANAGEMENT ===
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get('access_token');

    if (accessToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.setItem('discord_token', accessToken);
      verifyUserAndRole(accessToken);
    } else {
      const storedToken = localStorage.getItem('discord_token');
      if (storedToken) {
        verifyUserAndRole(storedToken);
      }
    }
  }, []);

  const getBestRole = (roles: string[]) => {
      let bestRole = { name: 'Персонал', color: 'text-zinc-500', weight: 0, id: '' };
      roles.forEach(roleId => {
          const def = ROLE_DEFINITIONS[roleId];
          if (def && def.weight > bestRole.weight) {
              bestRole = { ...def, id: roleId };
          }
      });
      return bestRole;
  };

  const verifyUserAndRole = async (token: string) => {
    setLoading(true);
    setAccessDenied(false);
    setStatusMessage('Авторизация...');

    try {
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (userRes.status === 401) throw new Error('Token expired');
      if (!userRes.ok) throw new Error('Failed to fetch user');
      const userData = await userRes.json();

      setStatusMessage('Проверка доступа...');
      
      // Сначала проверяем белый список ID (ОНИ ИМЕЮТ ДОСТУП ВСЕГДА)
      if (ALLOWED_ADMIN_IDS.includes(userData.id)) {
          // Даже если не в гильдии или нет ролей, пускаем их
          setUser({ ...userData, roles: [] }); // Роли подгрузим ниже если есть
          setUserRoleInfo({ name: 'Администратор', color: 'text-red-500' });
          
          // Пробуем подгрузить реальные данные участника, но не блокируем если ошибка
          try {
             const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${TARGET_GUILD_ID}/member`, {
                headers: { Authorization: `Bearer ${token}` },
             });
             if (memberRes.ok) {
                 const memberData = await memberRes.json();
                 setUser(prev => ({ ...prev!, roles: memberData.roles || [] }));
                 fetchStaffList(userData.id, memberData.roles || [], userData, { name: 'Администратор', color: 'text-red-500' });
                 return; 
             }
          } catch (e) {}
          
          fetchStaffList(userData.id, [], userData, { name: 'Администратор', color: 'text-red-500' });
          return;
      }

      // Если не в белом списке, проверяем стандартные права (роль Staff)
      const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${TARGET_GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (memberRes.status === 404 || memberRes.status === 403) {
        setStatusMessage('Вы не найдены на сервере');
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const memberData = await memberRes.json();
      const roles: string[] = memberData.roles || [];

      if (roles.includes(STAFF_ROLE_ID)) {
        setUser({ ...userData, roles });
        const roleInfo = getBestRole(roles);
        setUserRoleInfo(roleInfo);
        fetchStaffList(userData.id, roles, userData, roleInfo);
      } else {
        setAccessDenied(true);
      }

    } catch (error) {
      console.error('Auth Error:', error);
      if ((error as Error).message === 'Token expired') {
          localStorage.removeItem('discord_token');
          setUser(null);
      } else {
          setAccessDenied(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffList = async (currentUserId: string, currentUserRoles: string[], currentUserData: any, currentUserRoleInfo: any) => {
    setIsStaffLoading(true);
    setWidgetError(false);
    
    try {
      const res = await fetch(`${API_URL}/staff`);
      if (!res.ok) throw new Error("Failed to fetch staff from API");
      
      const realStaffData: any[] = await res.json();
      
      const staffMap = new Map<string, StaffDisplay>();

      realStaffData.forEach(member => {
         const roleInfo = getBestRole(member.roles || []);
         const weight = roleInfo.weight > 0 ? roleInfo.weight : 0.5;

         staffMap.set(member.id, {
             id: member.id,
             username: member.username,
             avatarUrl: member.avatar 
                ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png',
             roleId: roleInfo.id,
             roleName: roleInfo.name,
             roleColor: roleInfo.color,
             status: member.status || 'offline',
             isCurrentUser: member.id === currentUserId,
             weight: weight
         });
      });

      // Overlay public widget status
      try {
        const widgetRes = await fetch(`https://discord.com/api/guilds/${TARGET_GUILD_ID}/widget.json`);
        if (widgetRes.ok) {
            const widgetData = await widgetRes.json();
            const onlineMembers = widgetData.members || [];
            
            onlineMembers.forEach((m: any) => {
                const existing = staffMap.get(m.id);
                if (existing) {
                    existing.status = m.status; 
                }
            });
        }
      } catch(e) { console.log("Widget fetch failed"); }

      // Ensure current user is present
      if (!staffMap.has(currentUserId)) {
          staffMap.set(currentUserId, {
            id: currentUserId,
            username: currentUserData.username,
            avatarUrl: currentUserData.avatar 
                ? `https://cdn.discordapp.com/avatars/${currentUserId}/${currentUserData.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png',
            roleId: 'self', 
            roleName: currentUserRoleInfo.name,
            roleColor: currentUserRoleInfo.color,
            status: 'online',
            isCurrentUser: true,
            weight: 100 
        });
      }

      const finalArray = Array.from(staffMap.values());
      finalArray.sort((a, b) => {
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return b.weight - a.weight;
      });

      setStaffList(finalArray);

    } catch (e) {
      console.error("Staff fetch error:", e);
      setWidgetError(true);
    } finally {
        setIsStaffLoading(false);
    }
  };

  // === ACTION HANDLERS ===
  const handleActionSelect = (type: 'hire' | 'promote' | 'demote' | 'warn' | 'unwarn' | 'kick') => {
      setActionType(type);
      setIsSuccess(false);
      setErrorMessage(null);
      setActionReason('');
      setTargetRoleId('');
      setTargetRoleName('');

      const sortedRoles = Object.entries(ROLE_DEFINITIONS)
          .map(([id, def]) => ({ id, ...def }))
          .sort((a, b) => a.weight - b.weight);

      // АВТОМАТИЧЕСКИЙ ВЫБОР РОЛИ
      if (type === 'hire') {
          // Всегда выдаем самую первую роль (Стажёр)
          setTargetRoleId(sortedRoles[0].id);
          setTargetRoleName(sortedRoles[0].name);
      } else if (selectedStaff) {
          const currentIndex = sortedRoles.findIndex(r => r.id === selectedStaff.roleId);

          if (type === 'promote') {
              if (currentIndex !== -1 && currentIndex < sortedRoles.length - 1) {
                  const nextRole = sortedRoles[currentIndex + 1];
                  setTargetRoleId(nextRole.id);
                  setTargetRoleName(nextRole.name);
              } else {
                  setErrorMessage("Невозможно повысить: достигнут максимальный ранг или роль не найдена.");
              }
          } else if (type === 'demote') {
               if (currentIndex > 0) {
                  const prevRole = sortedRoles[currentIndex - 1];
                  setTargetRoleId(prevRole.id);
                  setTargetRoleName(prevRole.name);
              } else {
                  setErrorMessage("Невозможно понизить: это минимальный ранг.");
              }
          }
      }
  };

  const executeCommand = async () => {
      if (!selectedStaff || !actionType) return;
      
      // Валидация для автоматических ролей
      if ((actionType === 'promote' || actionType === 'demote' || actionType === 'hire') && !targetRoleId) {
          return; // Ошибка уже показана в handleActionSelect или UI
      }

      setIsSending(true);
      setErrorMessage(null);

      const payload = {
          action: actionType,
          targetId: selectedStaff.id,
          targetRoleId: targetRoleId,
          reason: actionReason || "Причина не указана",
          warnCount: warnCount, 
          adminId: user?.id
      };

      try {
          const response = await fetch(`${API_URL}/action`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
              },
              body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.message || data.error || 'Ошибка сервера');
          }

          setIsSuccess(true);
          
          setTimeout(() => {
              setIsSuccess(false);
              setActionType(null);
              verifyUserAndRole(localStorage.getItem('discord_token') || '');
          }, 2000);

      } catch (error) {
          console.error("Action failed:", error);
          setErrorMessage((error as Error).message || "Ошибка соединения");
      } finally {
          setIsSending(false);
      }
  };

  const handleLogin = () => {
    const scope = encodeURIComponent('identify guilds.members.read');
    const redirect = encodeURIComponent(getRedirectUri());
    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirect}&response_type=token&scope=${scope}`;
    window.location.href = url;
  };

  const handleLogout = () => {
    localStorage.removeItem('discord_token');
    setUser(null);
    setAccessDenied(false);
    setStaffList([]);
    setUserRoleInfo(null);
    window.location.hash = '';
  };

  const filteredStaff = staffList.filter(member => 
    member.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white overflow-hidden flex flex-col items-center justify-center relative selection:bg-purple-500/30 font-sans">
      
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0 opacity-[0.07]" 
           style={{ 
             backgroundImage: 'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)'
           }}>
      </div>
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full blur-[120px] transition-colors duration-1000 ${accessDenied ? 'bg-red-600/10' : 'bg-purple-600/10'}`} />
        <div className={`absolute bottom-[-10%] right-[20%] w-[600px] h-[600px] rounded-full blur-[100px] transition-colors duration-1000 ${accessDenied ? 'bg-orange-600/5' : 'bg-indigo-600/5'}`} />
      </div>

      <div className={`relative z-10 w-full transition-all duration-700 ease-in-out ${user ? 'max-w-5xl' : 'max-w-[480px]'} p-4`}>
        <div className={`relative backdrop-blur-2xl border transition-all duration-500 rounded-[2.5rem] flex flex-col items-center shadow-2xl overflow-hidden
            ${accessDenied 
                ? 'bg-[#0f0505]/95 border-red-500/20 shadow-red-900/10 p-10 md:p-14' 
                : user 
                    ? 'bg-[#0a0a0a]/95 border-white/5 p-8 min-h-[600px]' 
                    : 'bg-[#0a0a0a]/90 border-white/5 p-10 md:p-14'
            }`}>
          
          {/* HEADER (Only show on Login) */}
          {!user && (
              <div className="text-center mb-12 relative w-full flex flex-col items-center">
                {!mainLogoError ? (
                   <div className="mb-8 relative group">
                      <div className={`absolute -inset-10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition duration-1000 ${accessDenied ? 'bg-red-500/10' : 'bg-purple-500/5'}`}></div>
                      <img 
                        src="images/logo.png" 
                        alt=""
                        className={`h-32 md:h-40 w-auto object-contain relative z-10 drop-shadow-[0_0_35px_rgba(168,85,247,0.1)] transition-all duration-500 ${accessDenied ? 'grayscale contrast-125' : ''}`}
                        onError={() => setMainLogoError(true)}
                      />
                   </div>
                ) : (
                   <h1 className="text-5xl font-black tracking-tighter mb-4">
                     <span className="text-white">NULL</span>
                     <span className={`text-purple-500 ml-1 ${accessDenied ? 'text-red-500' : 'text-purple-500'}`}>X</span>
                   </h1>
                )}
              </div>
          )}

          {/* MAIN CONTENT */}
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest animate-pulse">{statusMessage}</span>
            </div>
          ) : accessDenied ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                <Ban className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">ДОСТУП ЗАПРЕЩЕН</h2>
              <p className="text-zinc-500 text-center text-xs leading-relaxed mb-8 max-w-[200px]">
                У вас нет прав персонала для доступа к этой панели.
              </p>
              <button onClick={handleLogout} className="w-full bg-white/5 hover:bg-white/10 border border-white/5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                <LogOut className="w-3 h-3" /> Вернуться
              </button>
            </div>
          ) : user ? (
            <div className="w-full flex flex-col md:flex-row gap-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {selectedStaff ? (
                    // === STAFF MANAGEMENT VIEW ===
                    <div className="w-full flex flex-col gap-6 animate-in slide-in-from-right-10 duration-500 h-full">
                        <div className="flex items-center justify-between">
                            <button 
                                onClick={() => { setSelectedStaff(null); setActionType(null); setErrorMessage(null); }}
                                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg"
                            >
                                <ChevronLeft className="w-4 h-4" /> Назад
                            </button>
                            <div className="flex items-center gap-3">
                                <img src={selectedStaff.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                                <div>
                                    <p className="text-sm font-bold leading-none">{selectedStaff.username}</p>
                                    <p className={`text-[10px] font-bold ${selectedStaff.roleColor}`}>{selectedStaff.roleName}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center relative">
                            {/* SUCCESS OVERLAY */}
                            {isSuccess && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-sm animate-in fade-in zoom-in duration-300 rounded-3xl">
                                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 border border-emerald-500/50">
                                        <Check className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">ВЫПОЛНЕНО</h3>
                                    <p className="text-emerald-400 font-mono text-xs mt-2">Операция завершена успешно</p>
                                </div>
                            )}

                            {!actionType ? (
                                // ACTION SELECTOR
                                isAdmin ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-lg">
                                        <button onClick={() => handleActionSelect('promote')} className="group flex flex-col items-center p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all gap-3">
                                            <div className="p-3 bg-emerald-500/10 rounded-full group-hover:scale-110 transition-transform">
                                                <ArrowUpCircle className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <span className="text-sm font-bold text-emerald-100">Повысить</span>
                                        </button>
                                        <button onClick={() => handleActionSelect('demote')} className="group flex flex-col items-center p-6 rounded-2xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all gap-3">
                                            <div className="p-3 bg-orange-500/10 rounded-full group-hover:scale-110 transition-transform">
                                                <ArrowDownCircle className="w-6 h-6 text-orange-400" />
                                            </div>
                                            <span className="text-sm font-bold text-orange-100">Понизить</span>
                                        </button>
                                        <button onClick={() => handleActionSelect('warn')} className="group flex flex-col items-center p-6 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 hover:bg-yellow-500/10 hover:border-yellow-500/30 transition-all gap-3">
                                            <div className="p-3 bg-yellow-500/10 rounded-full group-hover:scale-110 transition-transform">
                                                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                                            </div>
                                            <span className="text-sm font-bold text-yellow-100">Варн</span>
                                        </button>
                                        <button onClick={() => handleActionSelect('unwarn')} className="group flex flex-col items-center p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all gap-3">
                                            <div className="p-3 bg-indigo-500/10 rounded-full group-hover:scale-110 transition-transform">
                                                <Eye className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <span className="text-sm font-bold text-indigo-100">Снять Варн</span>
                                        </button>
                                        <button onClick={() => handleActionSelect('kick')} className="group flex flex-col items-center p-6 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all gap-3">
                                            <div className="p-3 bg-red-500/10 rounded-full group-hover:scale-110 transition-transform">
                                                <Trash2 className="w-6 h-6 text-red-400" />
                                            </div>
                                            <span className="text-sm font-bold text-red-100">Кикнуть</span>
                                        </button>
                                        <button onClick={() => handleActionSelect('hire')} className="group flex flex-col items-center p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all gap-3">
                                            <div className="p-3 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform">
                                                <UserPlus className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <span className="text-sm font-bold text-blue-100">Принять</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center text-zinc-500 text-xs p-8 border border-white/5 rounded-2xl">
                                        У вас нет прав для управления пользователями.
                                    </div>
                                )
                            ) : (
                                // ACTION FORM
                                <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-3xl p-8 animate-in slide-in-from-bottom-5 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                                            {actionType === 'promote' && <ArrowUpCircle className="text-emerald-500" />}
                                            {actionType === 'demote' && <ArrowDownCircle className="text-orange-500" />}
                                            {actionType === 'kick' && <Trash2 className="text-red-500" />}
                                            {actionType === 'warn' && <AlertTriangle className="text-yellow-500" />}
                                            {actionType === 'unwarn' && <Eye className="text-indigo-500" />}
                                            {actionType === 'hire' && <UserPlus className="text-blue-500" />}
                                            
                                            {actionType === 'promote' && 'Повышение'}
                                            {actionType === 'demote' && 'Понижение'}
                                            {actionType === 'kick' && 'Изгнание'}
                                            {actionType === 'warn' && 'Предупреждение'}
                                            {actionType === 'unwarn' && 'Снятие Варна'}
                                            {actionType === 'hire' && 'Принятие'}
                                        </h3>
                                        <button onClick={() => { setActionType(null); setErrorMessage(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                            <X className="w-5 h-5 text-zinc-500" />
                                        </button>
                                    </div>

                                    <div className="space-y-5">
                                        {errorMessage && (
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                                <div className="text-xs text-red-200">
                                                    <span className="font-bold block text-red-400 mb-0.5">Ошибка Системы</span>
                                                    {errorMessage}
                                                </div>
                                            </div>
                                        )}

                                        {/* Display Role for Auto Actions */}
                                        {(actionType === 'promote' || actionType === 'demote' || actionType === 'hire') && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Целевая Роль</label>
                                                <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-bold text-white flex items-center justify-between">
                                                    <span>{targetRoleName || "Роль не определена"}</span>
                                                    {(actionType === 'promote' || actionType === 'hire') ? 
                                                        <ArrowUpCircle className="w-4 h-4 text-emerald-500" /> : 
                                                        <ArrowDownCircle className="w-4 h-4 text-orange-500" />
                                                    }
                                                </div>
                                            </div>
                                        )}

                                        {/* Warn Count (Warn/Unwarn) */}
                                        {(actionType === 'warn' || actionType === 'unwarn') && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Уровень (x/3)</label>
                                                <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-xl p-2">
                                                    <button onClick={() => setWarnCount(Math.max(1, warnCount - 1))} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10 text-white font-bold">-</button>
                                                    <div className="flex-1 text-center font-black text-xl text-purple-400">{warnCount}</div>
                                                    <button onClick={() => setWarnCount(Math.min(3, warnCount + 1))} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10 text-white font-bold">+</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Причина</label>
                                            <input 
                                                type="text" 
                                                value={actionReason}
                                                onChange={(e) => setActionReason(e.target.value)}
                                                placeholder="Введите подробную причину..."
                                                disabled={isSending}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-purple-500/50 transition-colors disabled:opacity-50"
                                            />
                                        </div>

                                        <button 
                                            onClick={executeCommand}
                                            disabled={(!actionReason && actionType !== 'unwarn') || isSending || ((actionType === 'promote' || actionType === 'demote') && !targetRoleId)}
                                            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all mt-4
                                                ${(!actionReason && actionType !== 'unwarn') || isSending || !targetRoleId && (actionType === 'promote' || actionType === 'demote') ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200 hover:scale-[1.02] shadow-lg shadow-white/5'}
                                            `}
                                        >
                                            {isSending ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Обработка...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    Выполнить
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // === DIRECTORY VIEW ===
                    <>
                    {/* USER PROFILE COLUMN */}
                    <div className="w-full md:w-[350px] shrink-0 flex flex-col bg-white/[0.02] border border-white/5 rounded-3xl p-6 h-fit">
                        <div className="flex items-center gap-4 mb-6">
                            <img 
                                src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                                alt="Me" 
                                className="w-16 h-16 rounded-full border border-purple-500/30"
                            />
                            <div className="overflow-hidden min-w-0">
                                <h3 className="text-lg font-bold text-white truncate pr-2" title={user.username}>{user.username}</h3>
                                <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold uppercase tracking-wider mt-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Авторизован
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-2 mb-8">
                            <div className="flex justify-between items-center text-xs py-2 border-b border-white/5">
                                <span className="text-zinc-500">Роль</span>
                                <span className={`font-medium ${userRoleInfo?.color || 'text-purple-400'}`}>
                                    {userRoleInfo?.name || 'Персонал'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-2 border-b border-white/5">
                                <span className="text-zinc-500">ID</span>
                                <span className="text-zinc-400 font-mono">{user.id}</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleLogout}
                            className="mt-auto w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-red-400 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-3 h-3" /> Выйти
                        </button>
                    </div>

                    {/* DIRECTORY COLUMN */}
                    <div className="w-full md:flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    Список Персонала
                                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-md border border-purple-500/20">
                                        {isStaffLoading ? '...' : staffList.length}
                                    </span>
                                </h2>
                                <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider opacity-60">
                                    Выберите сотрудника
                                </p>
                            </div>
                            <div className="hidden md:block p-2 bg-white/5 rounded-full">
                                <Users className="w-5 h-5 text-zinc-400" />
                            </div>
                        </div>

                        <div className="relative mb-6 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Поиск сотрудника..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#050505] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-300 focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-700"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-2">
                            {isStaffLoading ? (
                                 <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                    <span className="text-[10px] uppercase tracking-widest">Синхронизация базы...</span>
                                 </div>
                            ) : filteredStaff.length > 0 ? (
                                filteredStaff.map((member) => (
                                    <div 
                                        key={member.id} 
                                        onClick={() => { setSelectedStaff(member); setActionType(null); }}
                                        className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/30 transition-all duration-300 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img src={member.avatarUrl} alt={member.username} className="w-10 h-10 rounded-full bg-zinc-800" />
                                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] 
                                                    ${member.status === 'online' ? 'bg-emerald-500' : 
                                                      member.status === 'idle' ? 'bg-yellow-500' : 
                                                      member.status === 'dnd' ? 'bg-red-500' : 'bg-zinc-500'}`}></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <h4 className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{member.username}</h4>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${member.roleColor || 'text-zinc-500 group-hover:text-purple-400'}`}>
                                                    {member.roleName}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronLeft className="w-4 h-4 text-zinc-500 rotate-180" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-zinc-600 text-xs uppercase tracking-widest">
                                    {widgetError ? 'Виджет Отключен' : 'Сотрудники не найдены'}
                                </div>
                            )}
                        </div>
                    </div>
                    </>
                )}
            </div>
          ) : (
            /* LOGIN SCREEN */
            <>
                <div className="w-full mb-10">
                    <button 
                        onClick={handleLogin}
                        className="relative w-full bg-[#0F0F11] hover:bg-[#151518] border border-white/5 hover:border-white/10 text-white py-5 px-8 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 group hover:shadow-[0_0_40px_rgba(88,101,242,0.15)]"
                    >
                        <div className="flex items-center gap-5">
                            <div className="bg-[#5865F2] p-2.5 rounded-xl shadow-lg shadow-[#5865F2]/20 group-hover:scale-110 transition-transform">
                                <DiscordIcon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Авторизация</span>
                                <span className="text-lg font-black text-zinc-100 tracking-tight">Войти через Discord</span>
                            </div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </div>
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full opacity-60">
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 mb-2" />
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Безопасно</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                        <Cpu className="w-5 h-5 text-blue-500 mb-2" />
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Быстро</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                        <Lock className="w-5 h-5 text-purple-500 mb-2" />
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Доступ</span>
                    </div>
                </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;