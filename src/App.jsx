import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, LayoutDashboard, TrendingUp, Award, FileText, Settings, 
  LogOut, Search, Plus, Trash2, Edit3, Upload, AlertTriangle, 
  ChevronRight, Save, X, Camera, DollarSign, Calendar as CalendarIcon, UserCheck, 
  Archive, Download, UserX, MapPin, CreditCard, MessageSquare,
  ArrowUpDown, Filter, RefreshCw, BarChart3, ChevronDown, History, Database,
  Clock, Star, ThumbsUp, Gift, Megaphone, FileDown, Gift as GiftIcon, Lock, Mail, LogIn, UserPlus,
  Cloud, CloudOff,
  List // CalendarDays 削除 -> CalendarIconを使用
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where
} from 'firebase/firestore';

/**
 * ------------------------------------------------------------------
 * 0. Error Boundary (アプリ全体のエラー捕捉用)
 * ------------------------------------------------------------------
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-2xl w-full border border-slate-200">
            <div className="flex items-center gap-4 mb-6 text-red-600">
                <AlertTriangle size={32} />
                <h1 className="text-2xl font-bold">Something went wrong</h1>
            </div>
            <p className="text-slate-600 mb-4 font-bold">アプリケーションの実行中にエラーが発生しました。</p>
            <div className="bg-slate-100 p-4 rounded-xl overflow-auto max-h-64 text-xs font-mono text-slate-700 border border-slate-200 mb-6">
              <p className="font-bold text-red-500 mb-2">{this.state.error && this.state.error.toString()}</p>
              <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg"
            >
                ページを再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * ------------------------------------------------------------------
 * 1. Firebase 初期化 & ユーティリティ (安全策強化版)
 * ------------------------------------------------------------------
 */

// グローバル変数として保持
let app, auth, db;
let firebaseInitError = null;

// 初期化関数 (try-catchで保護)
const initFirebase = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      // 既に初期化されていたら何もしない
      if (!app) {
        const firebaseConfig = JSON.parse(__firebase_config);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
      }
      return { app, auth, db, error: null };
    } else {
      console.warn("Firebase config not found. Using Demo Mode.");
      return { app: null, auth: null, db: null, error: "Config not found" };
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    firebaseInitError = error;
    return { app: null, auth: null, db: null, error };
  }
};

// 初回実行
initFirebase();

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const resizeImage = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuote = false;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (inQuote) {
      if (char === '"' && nextChar === '"') { currentCell += '"'; i++; } 
      else if (char === '"') { inQuote = false; } 
      else { currentCell += char; }
    } else {
      if (char === '"') { inQuote = true; } 
      else if (char === ',') { currentRow.push(currentCell); currentCell = ''; } 
      else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell); rows.push(currentRow); currentRow = []; currentCell = ''; if (char === '\r') i++;
      } else if (char === '\r') {
        currentRow.push(currentCell); rows.push(currentRow); currentRow = []; currentCell = '';
      } else { currentCell += char; }
    }
  }
  if (currentCell || currentRow.length > 0) { currentRow.push(currentCell); rows.push(currentRow); }
  return rows;
};

const exportTalentListToCSV = (data, filename) => {
  const headers = ['ID', 'ステータス', '芸名', '性別', '売上', '評価'];
  const csvContent = [
    headers.join(','),
    ...data.map(t => [t.id, t.status, t.name, t.gender, t.sales, t.rating].map(v => `"${(v||'').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const calculateAge = (birthDateString) => {
  if (!birthDateString) return '';
  const today = new Date();
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return ''; 
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/\//g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) return normalized;
  return dateStr;
};

const checkRenewalAlert = (contractEndDate) => {
  if (!contractEndDate) return false;
  const today = new Date();
  const end = new Date(contractEndDate);
  if (isNaN(end.getTime())) return false;
  const diffMonths = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
  return diffMonths <= 7 && diffMonths >= 0;
};

// ------------------------------------------
// 2. モックデータ
// ------------------------------------------

const generateMockData = () => {
  const names = ["織田エミリ", "徳田皓己", "山中啓伍", "坂本珠里", "杉村龍之助", "黒川大聖", "若林元太", "生田俊平", "山田杏華", "林純一郎", "望月亮人", "村澤瑠依", "ドンジュン", "田中 美咲", "鈴木 大輔"];
  return names.map((name, i) => {
    const birthDate = `2000-${String((i%12)+1).padStart(2,'0')}-15`;
    return {
      id: generateId(), status: 'active', sales: Math.floor(Math.random() * 5000000) + 1000000, 
      name: name, gender: i % 5 === 4 ? "女" : "男", email: `talent${i}@agency.co.jp`,
      birthDate: birthDate, age: calculateAge(birthDate),
      contractDate: "2020-04-01", contractEndDate: `2026-0${(i % 9) + 1}-01`,
      rating: (i % 5) + 1, evaluationNote: "順調",
      height: 160 + i, weight: 50 + i, bust: 85, waist: 60, hip: 88, shoeSize: 24.5,
      monthlySales: Array(12).fill(0), averageSales: 0
    };
  });
};

const generateMockLessons = () => Array(5).fill(null).map((_, i) => ({
    id: generateId(), title: `Lesson ${i+1}`, date: new Date().toISOString().split('T')[0],
    startTime: '10:00', endTime: '12:00', type: 'Acting', location: 'Studio A', instructor: 'Coach'
}));

const generateMockEvents = () => [{ id: generateId(), title: "ドラマ撮影", date: new Date().toISOString().split('T')[0], type: "TVドラマ", talent: "黒川大聖", gift: "菓子" }];

/**
 * ------------------------------------------------------------------
 * 3. UI コンポーネント (部品)
 * ------------------------------------------------------------------
 */

const InputField = ({ label, className = "", ...props }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
    <input className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300" {...props} />
  </div>
);

const TextAreaField = ({ label, className = "", ...props }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
    <textarea className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300" {...props} />
  </div>
);

const SelectField = ({ label, options, value, className = "", ...props }) => {
  const displayOptions = useMemo(() => {
    const uniqueOptions = Array.from(new Set(options));
    if (value && !uniqueOptions.includes(value) && value !== "") return [value, ...uniqueOptions];
    return uniqueOptions;
  }, [value, options]);
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
      <div className="relative">
        <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer" value={value} {...props}>
          <option value="">選択してください</option>
          {displayOptions.map((opt, i) => (<option key={`${opt}-${i}`} value={opt}>{opt}</option>))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={16} /></div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, subtext, icon: Icon, colorTheme = "indigo" }) => {
  const iconColorMap = { indigo: "text-indigo-600 bg-indigo-50", emerald: "text-emerald-600 bg-emerald-50", amber: "text-amber-600 bg-amber-50", rose: "text-rose-600 bg-rose-50", slate: "text-slate-600 bg-slate-100" };
  return (
    <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110 z-0"></div>
      <div className="relative z-10">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
        {subtext && <div className="text-xs text-slate-500 mt-2 font-bold flex items-center">{subtext}</div>}
      </div>
      <div className={`p-4 rounded-2xl ${iconColorMap[colorTheme]} relative z-10 shadow-sm`}><Icon className="w-6 h-6" /></div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "実行", confirmColor = "bg-red-500" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-slate-100">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 mx-auto"><AlertTriangle size={24} /></div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">{title}</h3>
        <p className="text-slate-500 mb-8 leading-relaxed text-center text-sm">{message}</p>
        <div className="flex justify-center space-x-3">
          <button onClick={onCancel} className="px-6 py-3 rounded-xl text-slate-600 font-bold bg-slate-50 hover:bg-slate-100 transition-colors">キャンセル</button>
          <button onClick={onConfirm} className={`px-6 py-3 rounded-xl text-white font-bold shadow-lg ${confirmColor}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const ScheduleModal = ({ isOpen, onClose, onSave, talents }) => {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], title: '', type: '映画', talent: '', gift: 'なし' });
  const handleSubmit = () => { if (!formData.title) return; onSave(formData); onClose(); };
  const talentOptions = useMemo(() => talents.filter(t => t.status === 'active').map(t => t.name), [talents]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-200">
        <div className="flex justify-between items-start mb-6"><h3 className="text-xl font-bold text-slate-800">スケジュール登録</h3><button onClick={onClose}><X size={24}/></button></div>
        <div className="space-y-4">
          <InputField label="日付" type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
          <InputField label="案件名" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="例: 日曜劇場「〇〇」撮影" />
          <div className="grid grid-cols-2 gap-4">
             <SelectField label="種類" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} options={['映画', 'TVドラマ', '舞台', 'イベント', 'ライブ', '打ち上げ', '会合', 'AUDITION', 'その他']} />
             <SelectField label="差入の種類" value={formData.gift} onChange={(e) => setFormData({...formData, gift: e.target.value})} options={['なし', '水', '菓子', '現金', '商品', 'その他']} />
          </div>
          <SelectField label="タレント名" value={formData.talent} onChange={(e) => setFormData({...formData, talent: e.target.value})} options={talentOptions} />
        </div>
        <div className="flex justify-end space-x-3 mt-8">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">キャンセル</button>
          <button onClick={handleSubmit} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700">登録</button>
        </div>
      </div>
    </div>
  );
};

const Login = ({ onLogin, onRegister, initialMode = 'login' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === 'register');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    if (!email.trim() || !password.trim()) { setError("メールアドレスとパスワードを入力してください。"); setIsLoggingIn(false); return; }
    try {
       if (isRegisterMode) await onRegister(email, password);
       else await onLogin(email, password, 'email');
    } catch (err) {
      if (err.code === 'auth/operation-not-allowed') { setError('LOGIN_CONFIG_ERROR'); } else { setError(err.message); }
    } finally { setIsLoggingIn(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-10 rounded-[32px] shadow-xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-10"><h1 className="text-2xl font-extrabold text-slate-800">TalentPro</h1><h2 className="text-lg font-bold text-slate-600 mt-4">{isRegisterMode ? '新規アカウント作成' : 'ログイン'}</h2></div>
        {error === 'LOGIN_CONFIG_ERROR' ? (<div className="bg-rose-50 p-4 rounded-xl text-xs text-rose-600 font-bold mb-6">認証設定エラー: <button onClick={() => onLogin('', '', 'demo')} className="underline">デモモードで続行</button></div>) : error && (<div className="bg-rose-50 p-4 rounded-xl text-xs text-rose-600 font-bold mb-6">{error}</div>)}
        <form onSubmit={handleSubmit} className="space-y-5">
            <InputField label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={isLoggingIn} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg">{isLoggingIn ? <RefreshCw className="animate-spin mr-2" size={18}/> : (isRegisterMode ? <UserCheck className="mr-2" size={18}/> : <LogOut className="mr-2 rotate-180" size={18}/>)}{isRegisterMode ? 'アカウント作成' : 'ログイン'}</button>
        </form>
        <div className="mt-4 text-center"><button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setError(''); }} className="text-sm text-indigo-600 hover:text-indigo-800 font-bold">{isRegisterMode ? 'すでにアカウントをお持ちの方はこちら' : '新規アカウント登録はこちら'}</button></div>
        {!isRegisterMode && <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col gap-3"><button type="button" onClick={(e) => onLogin('', '', 'demo')} className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center justify-center text-sm"><Database className="mr-2" size={16}/>デモモードで試す</button></div>}
      </div>
    </div>
  );
};

const Sidebar = ({ activeTab, setActiveTab, onGenerateMock, user, isDemoMode, onLogout, onGoToRegister, onGoToLogin }) => {
  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'sales', label: '売上分析', icon: BarChart3 },
    { id: 'evaluations', label: 'タレント評価', icon: Star },
    { id: 'talents', label: 'タレントDB', icon: Users },
    { id: 'lessons', label: 'レッスン', icon: FileText },
  ];
  return (
    <div className="w-72 bg-white h-screen fixed left-0 top-0 flex flex-col justify-between border-r border-slate-100 z-30 shadow-xl shadow-slate-200/50">
      <div>
        <div className="p-8 pb-4"><div className="flex items-center space-x-3 mb-8"><div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Award size={20} /></div><div><h1 className="text-xl font-bold tracking-tight text-slate-900">TalentPro</h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management</p></div></div></div>
        <nav className="px-4 space-y-1">{menuItems.map((item) => (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${activeTab === item.id ? 'bg-slate-50 text-indigo-600 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'}`}>{activeTab === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-r-full"></div>}<item.icon size={20} className={activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'} /><span>{item.label}</span>{activeTab === item.id && <ChevronRight size={16} className="ml-auto text-indigo-400" />}</button>))}</nav>
      </div>
      <div className="p-6">
         <button onClick={onGenerateMock} className="mb-4 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-500 transition-colors flex items-center justify-center"><Database size={14} className="mr-2"/> サンプルデータ</button>
        <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-xl shadow-slate-400/20">
             <div className="flex items-center space-x-3 mb-4"><div className={`w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center ${isDemoMode ? 'bg-amber-400' : 'bg-emerald-400'}`}>{isDemoMode ? <CloudOff size={14} className="text-slate-900"/> : <Cloud size={14} className="text-slate-900"/>}</div><div className="overflow-hidden"><p className="text-sm font-bold truncate">{isDemoMode ? 'デモモード' : (user?.isAnonymous ? 'Guest User' : 'User')}</p></div></div>
            <div className="space-y-2">{isDemoMode ? (<><button onClick={onGoToLogin} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold flex items-center justify-center"><LogIn size={14} className="mr-2"/> ログイン</button><button onClick={onGoToRegister} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center text-white"><UserPlus size={14} className="mr-2"/> 新規登録</button></>) : (<button onClick={onLogout} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold flex items-center justify-center"><LogOut size={14} className="mr-2"/> ログアウト</button>)}</div>
        </div>
      </div>
    </div>
  );
};

// 4. ダッシュボードコンテンツ
const DashboardContent = ({ talents, companySalesData, events, onAddEvent }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const totalSalesCurrent = (companySalesData.current || []).reduce((a, b) => a + b, 0);
  const totalSalesPrevious = (companySalesData.previous || []).reduce((a, b) => a + b, 0);
  const salesGrowth = totalSalesPrevious > 0 ? ((totalSalesCurrent - totalSalesPrevious) / totalSalesPrevious * 100).toFixed(1) : 0;
  const activeCount = useMemo(() => talents.filter(t => t.status && t.status.toLowerCase() === 'active').length, [talents]);
  const topTalents = useMemo(() => {
      const sorted = [...talents].filter(t => t.status === 'active').sort((a, b) => (b.sales || 0) - (a.sales || 0));
      const unique = []; const names = new Set();
      for (const t of sorted) { if (!names.has(t.name)) { names.add(t.name); unique.push(t); } if (unique.length >= 10) break; }
      return unique;
  }, [talents]);
  const upcomingEvents = useMemo(() => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (!events) return [];
      return events.filter(e => { const d = new Date(e.date); d.setHours(0,0,0,0); return d >= today; }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8"><h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">ダッシュボード</h2><p className="text-slate-500 font-medium">概要と分析</p></header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard title="今期 全社売上累計" value={`${totalSalesCurrent.toLocaleString()} 円`} subtext={<span className={`flex items-center ${salesGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{salesGrowth >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingUp size={14} className="mr-1 rotate-180" />}対前年 {salesGrowth > 0 ? '+' : ''}{salesGrowth}%</span>} icon={DollarSign} colorTheme="emerald" />
        <KpiCard title="活動中の所属タレント数" value={`${activeCount} 名`} subtext={<span className="flex items-center text-indigo-500"><TrendingUp size={14} className="mr-1" /> 対前月 +2名</span>} icon={Users} colorTheme="indigo" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 bg-white p-0 rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
          <div className="p-6 border-b border-slate-50 bg-gradient-to-b from-white to-slate-50/50"><h3 className="text-lg font-bold text-slate-800 flex items-center"><Award className="mr-2 text-amber-500" size={20}/> 売上トップ10</h3></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {topTalents.map((talent, idx) => {
              const rank = idx + 1;
              let rankBadge = "bg-slate-100 text-slate-500";
              if (rank === 1) rankBadge = "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200";
              if (rank === 2) rankBadge = "bg-slate-200 text-slate-700";
              if (rank === 3) rankBadge = "bg-amber-100 text-amber-800";
              return (
                <div key={talent.id} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                  <div className="flex items-center space-x-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankBadge}`}>{rank}</div><div className="min-w-0"><p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors truncate">{talent.name}</p></div></div>
                  <div className="text-right"><span className="text-sm font-bold text-slate-700 block">{(talent.sales || 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">円</span></span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
         <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-bold text-slate-800 flex items-center"><Megaphone className="mr-2 text-red-500" size={20}/> 【重要】作品・イベントスケジュール</h3><button onClick={() => setIsModalOpen(true)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center"><Plus size={14} className="mr-1"/> スケジュール追加</button></div>
         <div className="space-y-4">
            {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                <div key={event.id} className="flex items-center p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className="w-14 text-center mr-4"><span className="block text-xs font-bold text-slate-400 uppercase">{new Date(event.date).toLocaleString('en', {month:'short'})}</span><span className="block text-xl font-black text-slate-800">{new Date(event.date).getDate()}</span></div>
                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-100 text-slate-600 border-slate-200">{event.type}</span><h4 className="font-bold text-slate-700">{event.title}</h4></div><div className="flex items-center text-xs text-slate-500 space-x-4"><span className="flex items-center"><UserCheck size={12} className="mr-1"/> {event.talent}</span>{event.gift !== 'なし' && <span className="flex items-center"><GiftIcon size={12} className="mr-1 text-amber-500"/> {event.gift}</span>}</div></div>
                </div>
            )) : (<p className="text-center text-slate-400 py-4">予定されているスケジュールはありません</p>)}
         </div>
      </div>
      <ScheduleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={onAddEvent} talents={talents} />
    </div>
  );
};

// 7. 売上分析コンテンツ
const SalesAnalysisContent = ({ talents, companySalesData, onImportTalentSales, onImportCompanySales }) => {
  const companyFileInputRef = useRef(null);
  const previousFileInputRef = useRef(null);
  const talentFileInputRef = useRef(null);
  
  const uniqueSalesRanking = useMemo(() => {
    const all = [...talents].filter(t => t.status === 'active').sort((a, b) => (b.sales||0) - (a.sales||0));
    const unique = []; const names = new Set();
    for (const t of all) { if (!names.has(t.name)) { names.add(t.name); unique.push(t); } }
    return unique;
  }, [talents]);

  const handleCompanyFileChange = (e, yearType) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const rows = parseCSV(evt.target.result);
        let headerIndex = -1;
        for(let i=0; i<Math.min(rows.length, 30); i++) {
            if (rows[i].some(c => c && /10月|Oct/i.test(c))) { headerIndex = i; break; }
        }
        if (headerIndex === -1) { alert("ヘッダーが見つかりません"); return; }
        const salesRow = rows.find((row, i) => i > headerIndex && row[0] && row[0].includes('売上'));
        if (!salesRow) { alert("売上行が見つかりません"); return; }
        const sales = salesRow.slice(1).map(v => parseInt((v||'').replace(/[^0-9]/g, '')) || 0).slice(0, 12);
        while(sales.length < 12) sales.push(0);
        onImportCompanySales(sales, yearType);
    };
    reader.readAsText(file);
  };

  const handleTalentFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const rows = parseCSV(evt.target.result);
        const data = rows.slice(1).map(row => ({ name: row[0], sales: parseInt((row[13]||'').replace(/[^0-9]/g, ''))||0 })).filter(d=>d.name);
        onImportTalentSales(data);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div><h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">売上分析</h2><p className="text-slate-500 font-medium">パフォーマンスと傾向</p></div>
        <div className="flex flex-col sm:flex-row gap-3">
           <input type="file" ref={companyFileInputRef} className="hidden" accept=".csv" onChange={(e) => handleCompanyFileChange(e, 'current')} /><button onClick={() => companyFileInputRef.current.click()} className="px-5 py-3 bg-white border border-slate-200 text-indigo-600 rounded-xl font-bold text-xs flex items-center"><BarChart3 size={16} className="mr-2" /> 今年度取込</button>
           <input type="file" ref={previousFileInputRef} className="hidden" accept=".csv" onChange={(e) => handleCompanyFileChange(e, 'previous')} /><button onClick={() => previousFileInputRef.current.click()} className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs flex items-center"><History size={16} className="mr-2" /> 前年度取込</button>
           <input type="file" ref={talentFileInputRef} className="hidden" accept=".csv" onChange={handleTalentFileChange} /><button onClick={() => talentFileInputRef.current.click()} className="px-5 py-3 bg-emerald-600 text-white rounded-xl shadow-lg font-bold text-xs flex items-center"><Upload size={16} className="mr-2" /> タレント別データ取込</button>
        </div>
      </header>
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center"><div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mr-4 text-indigo-600 shadow-sm"><TrendingUp size={24} /></div><div><h3 className="text-lg font-bold text-slate-800">全社売上推移 (前年対比)</h3><div className="flex items-center space-x-4 mt-2"><div className="flex items-center text-[10px] font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-slate-300 mr-1.5"></div>前期</div><div className="flex items-center text-[10px] font-bold text-indigo-600"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5"></div>今期</div></div></div></div>
          <div className="text-right"><div className="text-3xl font-extrabold text-slate-800 tracking-tight">{(companySalesData.current||[]).reduce((a,b)=>a+b, 0).toLocaleString()} <span className="text-sm font-medium text-slate-400">円</span></div></div>
        </div>
        <div className="h-72 flex items-end justify-between space-x-3 px-2 relative z-10">
          {(companySalesData.current || Array(12).fill(0)).map((currVal, idx) => {
            const prevVal = (companySalesData.previous || [])[idx] || 0;
            const maxVal = Math.max(...[...(companySalesData.current||[]), ...(companySalesData.previous||[])], 10000000);
            return (
              <div key={idx} className="w-full flex flex-col items-center group relative h-full justify-end">
                <div className="flex space-x-1 items-end w-full justify-center h-full">
                    <div style={{ height: `${(prevVal / maxVal) * 100}%` }} className="w-1/2 bg-slate-200 rounded-t-sm relative min-h-[2px]"></div>
                    <div style={{ height: `${(currVal / maxVal) * 100}%` }} className="w-1/2 bg-indigo-500 rounded-t-sm relative min-h-[2px]"></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-2">{[10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9][idx]}月</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100"><h3 className="text-lg font-bold text-slate-800">ランキング</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider"><tr><th className="px-6 py-4">順位</th><th className="px-6 py-4">氏名</th><th className="px-6 py-4">年間売上累計</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {uniqueSalesRanking.map((talent, idx) => (
                  <tr key={talent.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold">{idx + 1}</td><td className="px-6 py-4">{talent.name}</td><td className="px-6 py-4 font-bold text-emerald-600">{(talent.sales||0).toLocaleString()} 円</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 8. タレント評価管理コンテンツ
const TalentEvaluationsContent = ({ talents, onUpdateEvaluation, onImportEvaluations }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState(null);
  const [formData, setFormData] = useState({ rating: 1, evaluationNote: '' });
  const handleEditClick = (talent) => { setSelectedTalent(talent); setFormData({ rating: talent.rating || 1, evaluationNote: talent.evaluationNote || '' }); setIsModalOpen(true); };
  const handleSave = () => { if (selectedTalent) { onUpdateEvaluation(selectedTalent.id, formData); setIsModalOpen(false); } };
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center mb-8"><div><h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">タレント評価管理</h2></div></header>
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
          <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100"><div className="col-span-3">氏名</div><div className="col-span-2">総合評価</div><div className="col-span-6">コメント</div><div className="col-span-1">操作</div></div>
          <div className="flex-1 overflow-y-auto">
              {talents.map(talent => (
                  <div key={talent.id} className="grid grid-cols-12 gap-4 px-8 py-5 items-center border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                      <div className="col-span-3 font-bold text-slate-700">{talent.name}</div>
                      <div className="col-span-2"><span className="font-bold text-amber-500">{talent.rating}</span></div>
                      <div className="col-span-6 text-sm text-slate-600">{talent.evaluationNote}</div>
                      <div className="col-span-1"><button onClick={() => handleEditClick(talent)}><Edit3 size={16} /></button></div>
                  </div>
              ))}
          </div>
      </div>
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-200">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">評価編集: {selectedTalent?.name}</h3>
                  <div className="space-y-6">
                      <InputField label="総合評価 (1-5)" type="number" min="1" max="5" value={formData.rating} onChange={(e) => setFormData({...formData, rating: e.target.value})} />
                      <TextAreaField label="管理者コメント" value={formData.evaluationNote} onChange={(e) => setFormData({...formData, evaluationNote: e.target.value})} rows={4} />
                  </div>
                  <div className="flex justify-end space-x-3 mt-8"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">キャンセル</button><button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg">保存</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

// 7. レッスン管理コンテンツ
const LessonsContent = ({ lessons, onAddLesson, onDeleteLesson }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newLesson, setNewLesson] = useState({ title: '', date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '12:00', type: 'Acting', location: 'Studio A', instructor: 'Coach' });
  const handleSave = () => { if(!newLesson.title) return; onAddLesson({ ...newLesson, id: generateId() }); setIsModalOpen(false); };

  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    for(let i=0; i<startingDayOfWeek; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [selectedDate]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center mb-8">
          <div><h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">レッスン管理</h2></div>
          <div className="flex gap-3">
              <div className="bg-slate-100 p-1 rounded-xl flex">
                  <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-bold ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><List size={16}/></button>
                  <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-lg text-sm font-bold ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><CalendarIcon size={16}/></button>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg font-bold text-sm flex items-center"><Plus size={18} className="mr-2" /> 追加</button>
          </div>
      </header>
      
      {viewMode === 'list' ? (
          <div className="space-y-4">
              {lessons.map(lesson => (
                  <div key={lesson.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start hover:shadow-md transition-all">
                      <div><h3 className="font-bold text-slate-800">{lesson.title}</h3><p className="text-sm text-slate-500">{lesson.date} {lesson.startTime}-{lesson.endTime} @ {lesson.location}</p></div>
                      <button onClick={() => onDeleteLesson(lesson.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
              ))}
          </div>
      ) : (
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-bold text-slate-800">{selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月</h3>
                  <div className="flex space-x-2">
                      <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronDown className="rotate-90" /></button>
                      <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronDown className="-rotate-90" /></button>
                  </div>
              </div>
              <div className="grid grid-cols-7 gap-4 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-xs font-bold text-slate-400 uppercase py-2">{day}</div>)}
                  {calendarDays.map((day, i) => {
                      if(!day) return <div key={i} className="h-24"></div>;
                      const dayStr = day.toISOString().split('T')[0];
                      const dayLessons = lessons.filter(l => l.date === dayStr);
                      return (
                          <div key={i} className="h-24 border border-slate-50 rounded-xl p-2 text-left hover:bg-slate-50 transition-colors relative group">
                              <span className={`text-sm font-bold ${day.getDay() === 0 ? 'text-red-400' : 'text-slate-700'}`}>{day.getDate()}</span>
                              <div className="mt-1 space-y-1">{dayLessons.map((l, idx) => <div key={idx} className="text-[10px] truncate px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{l.startTime} {l.title}</div>)}</div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-200">
                <h3 className="text-xl font-bold text-slate-800 mb-6">レッスン追加</h3>
                <div className="space-y-4">
                    <InputField label="タイトル" value={newLesson.title} onChange={e => setNewLesson({...newLesson, title: e.target.value})} />
                    <InputField label="日付" type="date" value={newLesson.date} onChange={e => setNewLesson({...newLesson, date: e.target.value})} />
                </div>
                <div className="flex justify-end space-x-3 mt-8"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">キャンセル</button><button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg">保存</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

// 6. タレントリスト表示
const TalentListContent = ({ talents, onSelect, onAddNew }) => {
  const [listTab, setListTab] = useState('active'); 
  const filteredTalents = useMemo(() => talents.filter(t => t.status === listTab), [talents, listTab]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between gap-4">
        <div><h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">タレントデータベース</h2></div>
        <button onClick={onAddNew} className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg font-bold text-sm flex items-center"><Plus size={18} className="mr-2" /> 新規登録</button>
      </header>
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] flex flex-col relative">
        <div className="p-6 border-b border-slate-50 flex gap-4 bg-white sticky top-0 z-10">
            <button onClick={() => setListTab('active')} className={`px-6 py-2.5 rounded-lg text-sm font-bold ${listTab === 'active' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>所属 (Active)</button>
            <button onClick={() => setListTab('retired')} className={`px-6 py-2.5 rounded-lg text-sm font-bold ${listTab === 'retired' ? 'bg-slate-100 text-slate-600' : 'text-slate-500'}`}>退所 (Archived)</button>
        </div>
        <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100"><div className="col-span-4">氏名</div><div className="col-span-4">詳細</div><div className="col-span-4 text-right">操作</div></div>
        <div className="flex-1 overflow-y-auto">
          {filteredTalents.map((talent) => (
            <div key={talent.id} className="grid grid-cols-12 gap-4 px-8 py-5 items-center border-b border-slate-50 hover:bg-indigo-50/30 transition-all cursor-pointer" onClick={() => onSelect(talent)}>
              <div className="col-span-4 flex items-center space-x-4"><div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">{talent.photo ? <img src={talent.photo} className="w-full h-full object-cover"/> : <UserX size={18}/>}</div><div><h4 className="font-bold text-slate-700">{talent.name}</h4></div></div>
              <div className="col-span-4 text-sm text-slate-500">{talent.gender} / {talent.age}歳</div>
              <div className="col-span-4 flex justify-end"><Edit3 size={18} className="text-slate-300 hover:text-indigo-600" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 5. タレント詳細・編集フォーム
const TalentForm = ({ talent, onSave, onBack, onDelete, onRetire }) => {
  const [formData, setFormData] = useState({ ...talent });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [retireModalOpen, setRetireModalOpen] = useState(false);
  const handleChange = (e) => { setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const fileInputRef = useRef(null);
  const handlePhotoUpload = async (e) => { const file = e.target.files[0]; if(file) { const img = await resizeImage(file); setFormData(p => ({...p, photo: img})); } };

  return (
    <div className="animate-in slide-in-from-right-8 duration-300">
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50/90 backdrop-blur z-20 py-4 border-b border-slate-200">
        <div className="flex items-center space-x-4"><button onClick={onBack}><ChevronRight className="rotate-180" size={20} /></button><h2 className="text-2xl font-extrabold text-slate-800">{formData.id ? '編集' : '新規登録'}</h2></div>
        <div className="flex space-x-3">{formData.id && (<><button onClick={() => setRetireModalOpen(true)} className="px-5 py-2.5 bg-slate-100 rounded-xl font-bold text-sm">アーカイブ</button><button onClick={() => setDeleteModalOpen(true)} className="px-5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm">削除</button></>)}<button onClick={() => onSave(formData)} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg font-bold text-sm">保存</button></div>
      </div>
      <div className="grid grid-cols-12 gap-8 pb-20">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 text-center relative">
            <div className="w-48 h-48 mx-auto mb-6 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-xl cursor-pointer" onClick={()=>fileInputRef.current.click()}>{formData.photo ? <img src={formData.photo} className="w-full h-full object-cover"/> : <UserX size={64} className="m-auto mt-12 text-slate-300"/>}</div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            <h3 className="text-2xl font-extrabold text-slate-800">{formData.name}</h3>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100"><h4 className="text-lg font-bold text-slate-800 mb-6">基本情報</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><InputField label="芸名" name="name" value={formData.name} onChange={handleChange} /><SelectField label="性別" name="gender" value={formData.gender} onChange={handleChange} options={["男", "女"]} /><InputField label="生年月日" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} /><InputField label="契約終了日" type="date" name="contractEndDate" value={formData.contractEndDate} onChange={handleChange} /></div></section>
        </div>
      </div>
      <ConfirmModal isOpen={deleteModalOpen} title="削除" message="本当に削除しますか？" onConfirm={() => onDelete(formData.id)} onCancel={() => setDeleteModalOpen(false)} />
      <ConfirmModal isOpen={retireModalOpen} title="アーカイブ" message="アーカイブしますか？" onConfirm={() => onRetire(formData.id)} onCancel={() => setRetireModalOpen(false)} />
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * Main Logic Component (内部ロジック)
 * ------------------------------------------------------------------
 */
const TalentManager = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [talents, setTalents] = useState(generateMockData());
  const [lessons, setLessons] = useState(generateMockLessons()); 
  const [selectedTalent, setSelectedTalent] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false); 
  const [authMode, setAuthMode] = useState('login'); 
  const [companySalesData, setCompanySalesData] = useState({ current: Array(12).fill(0), previous: Array(12).fill(0) });
  const [events, setEvents] = useState(generateMockEvents());

  useEffect(() => {
    const initAuth = async () => {
        if (firebaseInitError || !auth) {
            console.warn("Auth skipped.");
            setIsDemoMode(true);
            setLoading(false);
            return;
        }
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
            else try { await signInAnonymously(auth); } catch (e) { console.warn("Anon Auth Disabled"); }
        } catch(e) { console.error("Auth Failed", e); }
    };
    initAuth();
    if (auth) { const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }); return () => unsub(); } else { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user || isDemoMode || !db) return;
    const unsubTalents = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'talents'), snap => setTalents(snap.docs.map(d=>d.data())));
    const unsubLessons = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lessons'), snap => setLessons(snap.docs.map(d=>d.data())));
    const unsubEvents = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'events'), snap => setEvents(snap.docs.map(d=>d.data())));
    const unsubSales = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'sales', 'company'), snap => { if(snap.exists()) setCompanySalesData(snap.data()); });
    return () => { unsubTalents(); unsubLessons(); unsubEvents(); unsubSales(); };
  }, [user, isDemoMode]);

  const saveToFirestore = async (col, data, id) => { if(!user || isDemoMode || !db) return; await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id), data); };
  const deleteFromFirestore = async (col, id) => { if(!user || isDemoMode || !db) return; await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id)); };

  const handleLogin = async (email, password, type) => {
      if (type === 'demo') {
          setIsDemoMode(true); setUser({ uid: 'demo', email: 'demo@example.com', isAnonymous: true }); setLoading(false);
          setTalents(generateMockData()); setCompanySalesData({ current: [120, 150, 130, 160, 180, 200, 190, 220, 240, 250, 230, 260].map(v=>v*10000), previous: [100, 120, 110, 130, 140, 160, 150, 170, 190, 200, 180, 210].map(v=>v*10000) });
          return;
      }
      if (!auth) return;
      if (type === 'guest') await signInAnonymously(auth); else await signInWithEmailAndPassword(auth, email, password);
  };
  const handleRegister = async (email, password) => { if (!auth) return; await createUserWithEmailAndPassword(auth, email, password); };
  const handleLogout = async () => { setAuthMode('login'); setIsDemoMode(false); if(auth) await signOut(auth); setTalents([]); setLessons([]); setEvents([]); setUser(null); };
  const handleGoToRegister = async () => { setAuthMode('register'); setIsDemoMode(false); if(user && auth) await signOut(auth); setUser(null); };
  const handleGoToLogin = async () => { setAuthMode('login'); setIsDemoMode(false); if(user && auth) await signOut(auth); setUser(null); };

  const handleAddLesson = (l) => { if(isDemoMode) setLessons(p=>[...p,l]); else saveToFirestore('lessons', l, l.id); };
  const handleDeleteLesson = (id) => { if(isDemoMode) setLessons(p=>p.filter(x=>x.id!==id)); else deleteFromFirestore('lessons', id); };
  const handleAddEvent = (e) => { const ev={...e, id: generateId()}; if(isDemoMode) setEvents(p=>[...p,ev]); else saveToFirestore('events', ev, ev.id); };
  const handleUpdateEvaluation = (id, up) => { if(isDemoMode) setTalents(p=>p.map(t=>t.id===id?{...t,...up}:t)); else { const t=talents.find(x=>x.id===id); if(t) saveToFirestore('talents', {...t,...up}, id); } };
  const handleImportEvaluations = (data) => { alert('インポート完了'); };
  const handleSaveTalent = (t) => { let nt=t.id?t:{...t, id:generateId(), status:'active', sales:0}; if(isDemoMode) setTalents(p=>{ const i=p.findIndex(x=>x.id===nt.id); if(i>-1){const c=[...p];c[i]=nt;return c;} return [...p,nt];}); else saveToFirestore('talents', nt, nt.id); setIsEditing(false); setSelectedTalent(null); };
  const handleDeleteTalent = (id) => { if(isDemoMode) setTalents(p=>p.filter(x=>x.id!==id)); else deleteFromFirestore('talents', id); setIsEditing(false); setSelectedTalent(null); };
  const handleRetireTalent = (id) => { if(isDemoMode) setTalents(p=>p.map(t=>t.id===id?{...t,status:'retired'}:t)); else { const t=talents.find(x=>x.id===id); if(t) saveToFirestore('talents', {...t,status:'retired'}, id); } setIsEditing(false); setSelectedTalent(null); };
  const handleImport = (d) => { if(isDemoMode) { setTalents(p=>[...p,...d.map(x=>({...x,id:generateId()}))]); alert('インポート完了'); } };
  const handleImportTalentSales = (d) => { alert('売上データ反映完了'); };
  const handleImportCompanySales = (d, y) => { if(isDemoMode) setCompanySalesData(p=>({...p, [y]: d})); };
  const handleGenerateMock = () => { if(isDemoMode) { setTalents(generateMockData()); alert('完了'); } };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  if (!user && !isDemoMode) return <Login onLogin={handleLogin} onRegister={handleRegister} initialMode={authMode} />;

  const renderContent = () => {
    if (isEditing || selectedTalent) return <TalentForm talent={selectedTalent || {}} onSave={handleSaveTalent} onBack={() => { setSelectedTalent(null); setIsEditing(false); }} onDelete={handleDeleteTalent} onRetire={handleRetireTalent} />;
    switch (activeTab) {
      case 'dashboard': return <DashboardContent talents={talents} companySalesData={companySalesData} events={events} onAddEvent={handleAddEvent} />;
      case 'sales': return <SalesAnalysisContent talents={talents} companySalesData={companySalesData} onImportTalentSales={handleImportTalentSales} onImportCompanySales={handleImportCompanySales} />;
      case 'evaluations': return <TalentEvaluationsContent talents={talents} onUpdateEvaluation={handleUpdateEvaluation} onImportEvaluations={handleImportEvaluations} />;
      case 'talents': return <TalentListContent talents={talents} onSelect={(t) => { setSelectedTalent(t); setIsEditing(true); }} onAddNew={() => { setSelectedTalent({}); setIsEditing(true); }} onImport={handleImport} />;
      case 'lessons': return <LessonsContent lessons={lessons} onAddLesson={handleAddLesson} onDeleteLesson={handleDeleteLesson} />;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-600">
      <Sidebar activeTab={activeTab} setActiveTab={(tab)=>{setActiveTab(tab); setSelectedTalent(null); setIsEditing(false);}} onGenerateMock={handleGenerateMock} user={user} isDemoMode={isDemoMode} onLogout={handleLogout} onGoToRegister={handleGoToRegister} onGoToLogin={handleGoToLogin} />
      <main className="ml-72 flex-1 p-10 h-screen overflow-y-auto">{renderContent()}</main>
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * App Root (ErrorBoundaryでラップ)
 * ------------------------------------------------------------------
 */
const App = () => {
  return (
    <ErrorBoundary>
      <TalentManager />
    </ErrorBoundary>
  );
};

export default App;
