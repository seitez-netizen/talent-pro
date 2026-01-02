import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, LayoutDashboard, TrendingUp, Award, FileText, Settings, 
  LogOut, Search, Plus, Trash2, Edit3, Upload, AlertTriangle, 
  ChevronRight, Save, X, Camera, DollarSign, Calendar as CalendarIcon, UserCheck, 
  Archive, Download, UserX, MapPin, CreditCard, MessageSquare,
  ArrowUpDown, Filter, RefreshCw, BarChart3, ChevronDown, History, Database,
  Clock, Star, ThumbsUp, Gift, Megaphone, FileDown, Gift as GiftIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
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
 * Firebase 初期化 & ユーティリティ
 * ------------------------------------------------------------------
 */

const firebaseConfig = JSON.parse(__firebase_config || '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'talent-pro-default';

// 認証初期化フック
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
};

// ユニークID生成ヘルパー
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// CSVパーサー
const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuote = false;

  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuote) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; 
      } else if (char === '"') {
        inQuote = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++;
      } else if (char === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }   
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
};

// CSVエクスポートヘルパー
const exportToCSV = (data, filename) => {
  const csvContent = [
    // ヘッダー
    ['ID', '氏名', '演技力', '適合性', '出席率', '信頼性', '総合評価', '管理者コメント'].join(','),
    // データ行
    ...data.map(t => {
      const ev = t.evaluation || {};
      const fields = [
        t.id,
        `"${t.name || ''}"`,
        ev.acting || 0,
        ev.suitability || 0,
        ev.attendance || 0,
        ev.reliability || 0,
        t.rating || 0,
        `"${(t.evaluationNote || '').replace(/"/g, '""')}"`
      ];
      return fields.join(',');
    })
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

// タレントDB用CSVエクスポートヘルパー
const exportTalentListToCSV = (data, filename) => {
  const headers = [
    'ID', 'ステータス', '芸名', '性別', 'フリガナ', '本名', '生年月日', '年齢',
    '出身地', '最終学歴', '契約開始日', '契約終了日',
    '携帯電話', 'Email', '郵便番号', '住所', '最寄駅', '緊急連絡先', '扶養家族', 'SNS',
    '身長', '体重', 'B', 'W', 'H', '靴', '利き手',
    'タトゥー', 'ピアス', 'アレルギー', '喫煙', '飲酒', 'パスポート期限', '運転免許',
    '特技', '特技詳細', 'ダンス', 'アクション', '殺陣', '語学', 'スポーツ', '歌唱', '楽器',
    '銀行口座', '特記事項', '備考', '売上累計', '評価'
  ];
  
  const csvContent = [
    headers.join(','),
    ...data.map(t => {
      const row = [
        t.id, t.status, t.name, t.gender, t.kana, t.realName, t.birthDate, t.age,
        t.birthPlace, t.education, t.contractDate, t.contractEndDate,
        t.mobile, t.email, t.zipCode, t.address, t.nearestStation, t.emergencyContact, t.dependents, t.sns,
        t.height, t.weight, t.bust, t.waist, t.hip, t.shoeSize, t.handedness,
        t.tattoos, t.piercings, t.allergies, t.smoking, t.alcohol, t.passportExpiry, t.license,
        t.specialty, t.specialtyDetail, t.dance, t.action, t.swordFight, t.languages, t.sports, t.singing, t.music,
        t.bankInfo, t.specialNotes, t.notes, t.sales, t.rating
      ];
      return row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(',');
    })
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
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/\//g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      const parts = normalized.split('-');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
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
// モックデータ生成関数 (必ずAppより前に定義)
// ------------------------------------------

const generateMockData = () => {
  const names = [
    "織田エミリ", "徳田皓己", "山中啓伍", "坂本珠里", "杉村龍之助",
    "黒川大聖", "若林元太", "生田俊平", "山田杏華", "林純一郎",
    "望月亮人", "村澤瑠依", "ドンジュン", "田中 美咲", "鈴木 大輔"
  ];
  
  return names.map((name, i) => {
    const isActive = true; 
    const today = new Date();
    let birthMonth, birthDay;
    if (i < 3) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i); 
        birthMonth = targetDate.getMonth() + 1;
        birthDay = targetDate.getDate();
    } else {
        birthMonth = (today.getMonth() + (i % 2 === 0 ? 0 : 1)) % 12 + 1; 
        birthDay = (today.getDate() + i - 7) > 0 ? (today.getDate() + i - 7) : 1;
    }
    const birthDate = `2000-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    
    const contractEndYear = 2025 + (i % 2);
    const contractEndDate = `${contractEndYear}-0${(i % 9) + 1}-01`;
    
    const baseSales = Math.max(0, 1000 - (i * 80)); 
    const randomSales = Math.floor(Math.random() * 50);
    const initialSales = baseSales + randomSales;
    const monthlySales = Array(12).fill(0);

    return {
      id: generateId(), 
      status: isActive ? 'active' : 'retired',
      photo: null, 
      sales: initialSales,
      monthlySales: monthlySales, 
      name: name,
      gender: i % 5 === 4 ? "女" : "男", 
      kana: "ヤマダ タロウ",
      realName: name,
      education: "〇〇大学 芸術学部 卒",
      mobile: "090-0000-0000",
      email: `talent${i}@agency.co.jp`,
      zipCode: "100-0001",
      address: "東京都港区...",
      nearestStation: "六本木駅",
      emergencyContact: "03-0000-0000 (実家)",
      dependents: "なし",
      sns: "@sample_sns",
      bankInfo: "〇〇銀行 〇〇支店",
      birthDate: birthDate,
      age: calculateAge(birthDate),
      passportExpiry: "2028-01-01",
      birthPlace: "東京都",
      contractDate: "2020-04-01",
      contractEndDate: contractEndDate,
      height: 160 + (i * 1.5),
      weight: 50 + i,
      bust: 85, waist: 60, hip: 88,
      shoeSize: 24.5,
      handedness: i % 10 === 0 ? "左" : "右",
      piercings: "無",
      tattoos: "無",
      allergies: "花粉症",
      smoking: "無",
      alcohol: "嗜む程度",
      license: "有",
      specialty: "",
      specialtyDetail: "特技詳細...",
      dance: i % 3 === 0 ? "HipHop 3年" : "なし",
      action: "基礎のみ",
      swordFight: "なし",
      languages: i % 5 === 0 ? "英語(日常会話)" : "日本語のみ",
      sports: "テニス",
      games: "FPS",
      music: "ピアノ",
      singing: i % 4 === 0 ? "得意" : "普通",
      notes: "備考サンプル",
      specialNotes: "特記事項サンプル",
      rating: (i % 5) + 1,
      evaluation: {
          acting: (i % 5) + 1,
          suitability: (i % 4) + 2,
          attendance: 5,
          reliability: 4
      },
      evaluationNote: "定期評価コメント：ポテンシャルが高く、今後の成長が期待できる。",
    };
  });
};

const generateMockLessons = () => {
    const today = new Date();
    const lessons = [];
    const types = ['Acting', 'Dance', 'Voice', 'Modeling'];
    const locations = ['Studio A', 'Studio B', 'Online', 'Main Hall'];
    
    for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i * 2);
        lessons.push({
            id: generateId(),
            title: `${types[i % 4]} Lesson ${i + 1}`,
            date: date.toISOString().split('T')[0],
            startTime: '10:00',
            endTime: '12:00',
            type: types[i % 4],
            location: locations[i % 4],
            instructor: `Coach ${String.fromCharCode(65 + i)}`,
            participants: [],
            notes: '持ち物：動きやすい服装'
        });
    }
    return lessons;
};

const generateMockEvents = () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return [
    { id: generateId(), title: "日曜劇場「追憶」クランクイン", date: dateStr, type: "TVドラマ", talent: "黒川大聖", gift: "菓子" },
    { id: generateId(), title: "新作映画 制作発表記者会見", date: dateStr, type: "イベント", talent: "若林元太", gift: "水" },
  ];
};


/**
 * ------------------------------------------------------------------
 * コンポーネント群 (UI部品)
 * ------------------------------------------------------------------
 */

const InputField = ({ label, className = "", ...props }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
    <input 
      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300" 
      {...props} 
    />
  </div>
);

const TextAreaField = ({ label, className = "", ...props }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
    <textarea 
      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300" 
      {...props} 
    />
  </div>
);

const SelectField = ({ label, options, value, className = "", ...props }) => {
  const displayOptions = useMemo(() => {
    // 重複を排除
    const uniqueOptions = Array.from(new Set(options));
    if (value && !uniqueOptions.includes(value) && value !== "") {
      return [value, ...uniqueOptions];
    }
    return uniqueOptions;
  }, [value, options]);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
      <div className="relative">
        <select 
          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer" 
          value={value}
          {...props} 
        >
          <option value="">選択してください</option>
          {displayOptions.map((opt, i) => (
            <option key={`${opt}-${i}`} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, subtext, icon: Icon, colorTheme = "indigo" }) => {
  const iconColorMap = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    slate: "text-slate-600 bg-slate-100",
  };

  return (
    <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110 z-0"></div>
      <div className="relative z-10">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
        {subtext && <div className="text-xs text-slate-500 mt-2 font-bold flex items-center">{subtext}</div>}
      </div>
      <div className={`p-4 rounded-2xl ${iconColorMap[colorTheme]} relative z-10 shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "実行", confirmColor = "bg-red-500" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200 border border-slate-100">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 mx-auto">
            <AlertTriangle size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">{title}</h3>
        <p className="text-slate-500 mb-8 leading-relaxed text-center text-sm">{message}</p>
        <div className="flex justify-center space-x-3">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-xl text-slate-600 font-bold bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            キャンセル
          </button>
          <button 
            onClick={onConfirm}
            className={`px-6 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// スケジュール入力用モーダル
const ScheduleModal = ({ isOpen, onClose, onSave, talents }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    type: '映画',
    talent: '',
    gift: 'なし'
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.date) return;
    onSave(formData);
    onClose();
    setFormData({
        date: new Date().toISOString().split('T')[0],
        title: '',
        type: '映画',
        talent: '',
        gift: 'なし'
    });
  };

  const talentOptions = useMemo(() => {
    return talents.filter(t => t.status === 'active').map(t => t.name);
  }, [talents]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-200">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-bold text-slate-800">スケジュール登録</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
        </div>
        <div className="space-y-4">
          <InputField 
            label="日付" 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({...formData, date: e.target.value})} 
          />
          <InputField 
            label="案件名" 
            value={formData.title} 
            onChange={(e) => setFormData({...formData, title: e.target.value})} 
            placeholder="例: 日曜劇場「〇〇」撮影"
          />
          <div className="grid grid-cols-2 gap-4">
             <SelectField 
                label="種類" 
                value={formData.type} 
                onChange={(e) => setFormData({...formData, type: e.target.value})} 
                // AUDITIONを追加
                options={['映画', 'TVドラマ', '舞台', 'イベント', 'ライブ', '打ち上げ', '会合', 'AUDITION', 'その他']} 
             />
             <SelectField 
                label="差入の種類" 
                value={formData.gift} 
                onChange={(e) => setFormData({...formData, gift: e.target.value})} 
                options={['なし', '水', '菓子', '現金', '商品', 'その他']} 
             />
          </div>
          <SelectField 
            label="タレント名" 
            value={formData.talent} 
            onChange={(e) => setFormData({...formData, talent: e.target.value})} 
            options={talentOptions} 
          />
        </div>
        <div className="flex justify-end space-x-3 mt-8">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">キャンセル</button>
          <button onClick={handleSubmit} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700">登録</button>
        </div>
      </div>
    </div>
  );
};


const Sidebar = ({ activeTab, setActiveTab, onGenerateMock }) => {
  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'sales', label: '売上分析', icon: BarChart3 },
    { id: 'evaluations', label: 'タレント評価', icon: Star },
    { id: 'talents', label: 'タレントDB', icon: Users },
    { id: 'auditions', label: 'オーディション', icon: Award },
    { id: 'competitors', label: '競合管理', icon: TrendingUp },
    { id: 'lessons', label: 'レッスン', icon: FileText },
  ];

  return (
    <div className="w-72 bg-white h-screen fixed left-0 top-0 flex flex-col justify-between border-r border-slate-100 z-30 shadow-xl shadow-slate-200/50">
      <div>
        <div className="p-8 pb-4">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
               <Award size={20} />
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    TalentPro
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management</p>
            </div>
          </div>
        </div>
        
        <div className="px-4 mb-2">
            <p className="text-xs font-bold text-slate-400 px-4 mb-2 uppercase tracking-wider">メインメニュー</p>
        </div>
        <nav className="px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
                <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    isActive
                    ? 'bg-slate-50 text-indigo-600 font-bold shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'
                }`}
                >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-r-full"></div>}
                <item.icon size={20} className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{item.label}</span>
                {isActive && <ChevronRight size={16} className="ml-auto text-indigo-400" />}
                </button>
            );
          })}
        </nav>
      </div>
      
      <div className="p-6">
         <button 
           onClick={onGenerateMock}
           className="mb-4 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-500 transition-colors flex items-center justify-center"
         >
           <Database size={14} className="mr-2"/> サンプルデータを投入
         </button>
        <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-xl shadow-slate-400/20">
            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
            <p className="text-xs text-slate-400 font-bold mb-1">ログインユーザー</p>
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 border-2 border-slate-800"></div>
                <div>
                    <p className="text-sm font-bold">Admin User</p>
                    <p className="text-[10px] text-slate-400">michelle-ent.co.jp</p>
                </div>
            </div>
            <button className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                ログアウト
            </button>
        </div>
      </div>
    </div>
  );
};

// 4. ダッシュボードコンテンツ (大幅改修)
const DashboardContent = ({ talents, companySalesData, events, onAddEvent }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. 今期 全社売上累計 (対前年比計算)
  const totalSalesCurrent = companySalesData.current.reduce((a, b) => a + b, 0);
  const totalSalesPrevious = companySalesData.previous.reduce((a, b) => a + b, 0);
  const salesGrowth = totalSalesPrevious > 0 
    ? ((totalSalesCurrent - totalSalesPrevious) / totalSalesPrevious * 100).toFixed(1) 
    : 0;
  
  // 2. 所属タレント数 (タレントDBから動的に取得)
  // 大文字小文字を区別せずに 'active' をカウント
  const activeCount = useMemo(() => 
    talents.filter(t => t.status && t.status.toLowerCase() === 'active').length, 
    [talents]
  );

  // 売上トップ10 (名前で重複排除)
  const topTalents = useMemo(() => {
      // まず売上で降順ソート
      const sorted = [...talents]
        .filter(t => t.status === 'active')
        .sort((a, b) => b.sales - a.sales);
      
      // 名前でユニーク化 (同名の場合は売上が高い方を優先=先にソートされているので最初のもの)
      const unique = [];
      const names = new Set();
      
      for (const t of sorted) {
          if (!names.has(t.name)) {
              names.add(t.name);
              unique.push(t);
          }
          if (unique.length >= 10) break;
      }
      return unique;
  }, [talents]);

  // スケジュールフィルタリング (過去の日付を除外)
  const upcomingEvents = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // eventsが未定義の場合のガード
      if (!events) return [];

      return events
        .filter(e => {
            const eventDate = new Date(e.date);
            eventDate.setHours(0,0,0,0);
            return eventDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">ダッシュボード</h2>
        <p className="text-slate-500 font-medium">概要と分析</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard 
          title="今期 全社売上累計" 
          value={`${totalSalesCurrent.toLocaleString()} 円`} 
          subtext={
            <span className={`flex items-center ${salesGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
               {salesGrowth >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingUp size={14} className="mr-1 rotate-180" />}
               対前年 {salesGrowth > 0 ? '+' : ''}{salesGrowth}%
            </span>
          }
          icon={DollarSign} 
          colorTheme="emerald" 
        />
        <KpiCard 
          title="活動中の所属タレント数" 
          value={`${activeCount} 名`} 
          subtext={
            <span className="flex items-center text-indigo-500">
               <TrendingUp size={14} className="mr-1" /> 対前月 +2名
            </span>
          }
          icon={Users} 
          colorTheme="indigo" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 6. 売上トップ10 (誕生日削除に伴い幅を拡張) */}
        <div className="lg:col-span-3 bg-white p-0 rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
          <div className="p-6 border-b border-slate-50 bg-gradient-to-b from-white to-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Award className="mr-2 text-amber-500" size={20}/> 売上トップ10
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {topTalents.map((talent, idx) => {
              const rank = idx + 1;
              let rankBadge = "bg-slate-100 text-slate-500";
              if (rank === 1) rankBadge = "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200";
              if (rank === 2) rankBadge = "bg-slate-200 text-slate-700";
              if (rank === 3) rankBadge = "bg-amber-100 text-amber-800";

              return (
                <div key={talent.id} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100">
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankBadge}`}>
                      {rank}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors truncate">{talent.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                      <span className="text-sm font-bold text-slate-700 block">{talent.sales.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">円</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7. 【重要】作品・イベントスケジュール */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Megaphone className="mr-2 text-red-500" size={20}/> 【重要】作品・イベントスケジュール
            </h3>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center"
            >
                <Plus size={14} className="mr-1"/> スケジュール追加
            </button>
         </div>
         <div className="space-y-4">
            {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                <div key={event.id} className="flex items-center p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className="w-14 text-center mr-4">
                        <span className="block text-xs font-bold text-slate-400 uppercase">{new Date(event.date).toLocaleString('en', {month:'short'})}</span>
                        <span className="block text-xl font-black text-slate-800">{new Date(event.date).getDate()}</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                event.type === '映画' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                event.type === 'イベント' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                {event.type}
                            </span>
                            <h4 className="font-bold text-slate-700">{event.title}</h4>
                        </div>
                        <div className="flex items-center text-xs text-slate-500 space-x-4">
                           <span className="flex items-center"><UserCheck size={12} className="mr-1"/> {event.talent}</span>
                           {event.gift !== 'なし' && <span className="flex items-center"><GiftIcon size={12} className="mr-1 text-amber-500"/> {event.gift}</span>}
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300"/>
                </div>
            )) : (
                <p className="text-center text-slate-400 py-4">予定されているスケジュールはありません</p>
            )}
         </div>
      </div>
      
      <ScheduleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={onAddEvent}
        talents={talents}
      />
    </div>
  );
};

// 7. 売上分析コンテンツ (分離されたインポート機能 - 修正版)
const SalesAnalysisContent = ({ talents, companySalesData, onImportTalentSales, onImportCompanySales }) => {
  const companyFileInputRef = useRef(null);
  const previousFileInputRef = useRef(null);
  const talentFileInputRef = useRef(null);
  
  const allSalesRanking = [...talents]
    .filter(t => t.status === 'active')
    .sort((a, b) => b.sales - a.sales);
  
  // 名前で重複排除（売上の高い方を優先）
  const uniqueSalesRanking = useMemo(() => {
    const unique = [];
    const names = new Set();
    for (const t of allSalesRanking) {
        if (!names.has(t.name)) {
            names.add(t.name);
            unique.push(t);
        }
    }
    return unique;
  }, [allSalesRanking]);


  const monthsElapsed = useMemo(() => {
    let maxIndex = 0;
    let hasData = false;
    talents.forEach(t => {
      if (t.monthlySales && t.monthlySales.length === 12) {
        for (let i = 11; i >= 0; i--) {
          if (t.monthlySales[i] > 0) {
            hasData = true;
            if (i > maxIndex) {
              maxIndex = i;
            }
            break; 
          }
        }
      }
    });
    return hasData ? maxIndex + 1 : 1;
  }, [talents]);

  const readSalesCSV = (file, callback, encoding = 'UTF-8') => {
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target.result;
        const rows = parseCSV(text);
        callback(rows);
    };
    reader.readAsText(file, encoding);
  };

  const handleCompanyFileChange = (e, yearType) => {
    const file = e.target.files[0];
    if (!file) return;

    const processCompanyCSV = (rows) => {
      let headerIndex = -1;
      
      const monthKeywords = [
        'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep',
        '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月'
      ];
      
      for(let i=0; i<Math.min(rows.length, 30); i++) {
          const rowStr = rows[i].join(',').toLowerCase();
          const matchCount = monthKeywords.filter(k => rowStr.includes(k.toLowerCase())).length;
          
          if (matchCount >= 3) {
              headerIndex = i;
              break;
          }
      }

      if (headerIndex === -1) return false;

      const headers = rows[headerIndex].map(h => h ? h.toString().toLowerCase().trim() : '');
      const targetMonths = [
          ['oct', '10月', '1-oct'], ['nov', '11月', '1-nov'], ['dec', '12月', '1-dec'], ['jan', '1月', '1-jan'],
          ['feb', '2月', '1-feb'], ['mar', '3月', '1-mar'], ['apr', '4月', '1-apr'], ['may', '5月', '1-may'],
          ['jun', '6月', '1-jun'], ['jul', '7月', '1-jul'], ['aug', '8月', '1-aug'], ['sep', '9月', '1-sep']
      ];

      const monthIndices = targetMonths.map(group => {
          let idx = headers.findIndex(h => group.some(k => h.includes(k)));
          return idx;
      });

      let salesRow = null;
      salesRow = rows.find((row, i) => i > headerIndex && row[0] && (row[0].trim() === '売上高' || row[0].trim() === '売上高 計'));
      if (!salesRow) {
         salesRow = rows.find((row, i) => i > headerIndex && row[0] && row[0].includes('売上') && !row[0].includes('総利益') && !row[0].includes('原価'));
      }

      if (!salesRow) return false;

      const monthlySales = monthIndices.map(idx => {
          if (idx === -1) return 0;
          let val = salesRow[idx];
          if (!val) return 0;
          val = String(val).replace(/[,¥円\s"']/g, ''); 
          const num = parseFloat(val);
          return isNaN(num) ? 0 : num;
      });

      while(monthlySales.length < 12) monthlySales.push(0);

      onImportCompanySales(monthlySales, yearType);
      return true;
    };

    readSalesCSV(file, (rows) => {
       if (!processCompanyCSV(rows)) {
           readSalesCSV(file, (rowsSJIS) => {
               if (!processCompanyCSV(rowsSJIS)) {
                   alert("全社売上データの読み込みに失敗しました。");
               }
           }, 'Shift-JIS');
       }
    });
  };

  const handleTalentFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const processTalentCSV = (rows) => {
        let monthsDivisor = null;

        if (rows.length > 0 && rows[0].length > 0) {
            const a1Raw = String(rows[0][0]).replace(/[,¥円\s]/g, '');
            const a1Val = parseFloat(a1Raw);
            if (!isNaN(a1Val) && a1Val > 0) {
                monthsDivisor = a1Val;
            }
        }

        let headerIndex = -1;
        for(let i=0; i<rows.length; i++) {
            if(rows[i].some(c => c && c.includes('10月')) && rows[i].some(c => c && c.includes('11月'))) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) return false;

        const headers = rows[headerIndex];
        const dataRows = rows.slice(headerIndex + 1);
        
        const mapIdx = { name: 0, months: [] }; 
        const monthNames = ['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月'];
        
        monthNames.forEach(m => {
            const idx = headers.findIndex(h => h && h.includes(m));
            if (idx !== -1) mapIdx.months.push(idx);
            else mapIdx.months.push(-1);
        });

        const salesData = [];
        dataRows.forEach(row => {
            if (!row[0]) return;
            const nameRaw = row[0];
            const name = nameRaw.split(' ')[0] || nameRaw; 

            let total = 0;
            if (row.length > 13) {
                 const totalVal = row[13];
                 if (totalVal) {
                     total = parseInt(String(totalVal).replace(/[,¥円\s]/g, ''), 10);
                     if (isNaN(total)) total = 0;
                 }
            }

            const monthlySales = mapIdx.months.map(idx => {
                if (idx === -1) return 0;
                const val = row[idx];
                if (!val) return 0;
                return parseInt(val.replace(/[,¥円\s]/g, ''), 10) || 0;
            });

            let average = null;
            if (monthsDivisor) {
                average = Math.round(total / monthsDivisor);
            }

            salesData.push({ name, monthlySales, totalSales: total, averageSales: average });
        });
        
        onImportTalentSales(salesData);
        return true;
    };

    readSalesCSV(file, (rows) => {
        if (!processTalentCSV(rows)) {
            readSalesCSV(file, (rowsSJIS) => {
                if (!processTalentCSV(rowsSJIS)) {
                    alert("タレント別売上データの読み込みに失敗しました。");
                }
            }, 'Shift-JIS');
        }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">売上分析</h2>
          <p className="text-slate-500 font-medium">パフォーマンスと傾向</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
           <input type="file" ref={companyFileInputRef} className="hidden" accept=".csv" onChange={(e) => handleCompanyFileChange(e, 'current')} />
           <button 
             onClick={() => companyFileInputRef.current.click()}
             className="px-5 py-3 bg-white border border-slate-200 text-indigo-600 rounded-xl shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-all font-bold text-xs flex items-center"
           >
             <BarChart3 size={16} className="mr-2" /> 今年度取込
           </button>

           <input type="file" ref={previousFileInputRef} className="hidden" accept=".csv" onChange={(e) => handleCompanyFileChange(e, 'previous')} />
           <button 
             onClick={() => previousFileInputRef.current.click()}
             className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-xs flex items-center"
           >
             <History size={16} className="mr-2" /> 前年度取込
           </button>

           <input type="file" ref={talentFileInputRef} className="hidden" accept=".csv" onChange={handleTalentFileChange} />
           <button 
             onClick={() => talentFileInputRef.current.click()}
             className="px-5 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-bold text-xs flex items-center transform hover:-translate-y-0.5"
           >
             <Upload size={16} className="mr-2" /> タレント別データ取込
           </button>
        </div>
      </header>

      {/* 売上推移グラフ (全社) */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center">
             <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mr-4 text-indigo-600 shadow-sm">
                <TrendingUp size={24} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800">全社売上推移 (前年対比)</h3>
                <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center text-[10px] font-bold text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-slate-300 mr-1.5"></div>
                        2025年9月期 (前期)
                    </div>
                    <div className="flex items-center text-[10px] font-bold text-indigo-600">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5"></div>
                        2026年9月期 (今期)
                    </div>
                </div>
             </div>
          </div>
          <div className="text-right">
             <div className="text-3xl font-extrabold text-slate-800 tracking-tight">{companySalesData.current.reduce((a,b)=>a+b, 0).toLocaleString()} <span className="text-sm font-medium text-slate-400">円</span></div>
             <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">今期累計</div>
          </div>
        </div>
        <div className="h-72 flex items-end justify-between space-x-3 px-2 relative z-10">
          {companySalesData.current.map((currVal, idx) => {
            const prevVal = companySalesData.previous[idx] || 0;
            const monthLabel = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9][idx];
            
            const allValues = [...companySalesData.current, ...companySalesData.previous];
            const maxVal = Math.max(...allValues, 10000000); 
            
            const currHeight = (currVal / maxVal) * 100;
            const prevHeight = (prevVal / maxVal) * 100;
            
            return (
              <div key={idx} className="w-full flex flex-col items-center group relative h-full justify-end">
                <div className="flex space-x-1 items-end w-full justify-center h-full">
                    {/* Previous Year Bar */}
                    <div 
                      style={{ height: `${prevHeight}%` }} 
                      className="w-1/2 bg-slate-200 rounded-t-sm transition-all duration-700 relative min-h-[2px] group-hover:bg-slate-300"
                    >
                       <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 pointer-events-none">
                          <div className="bg-slate-500 text-white text-[9px] font-bold py-1 px-2 rounded whitespace-nowrap">
                              前: {prevVal.toLocaleString()}
                          </div>
                      </div>
                    </div>

                    {/* Current Year Bar */}
                    <div 
                      style={{ height: `${currHeight}%` }} 
                      className="w-1/2 bg-indigo-500 rounded-t-sm transition-all duration-700 relative min-h-[2px] group-hover:bg-indigo-600"
                    >
                       <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-8 z-30 pointer-events-none">
                          <div className="bg-indigo-900 text-white text-[9px] font-bold py-1 px-2 rounded whitespace-nowrap shadow-lg">
                              今: {currVal.toLocaleString()}
                          </div>
                      </div>
                    </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-2">{monthLabel}月</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 全員分の売上ランキングリスト */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 backdrop-blur-sm">
          <div className="flex items-center">
             <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center mr-3">
                 <Award size={18} />
             </div>
             <h3 className="text-lg font-bold text-slate-800">ランキング</h3>
          </div>
          <div className="flex items-center space-x-4">
             {/* 削除: <span className="text-xs font-medium text-slate-400">月平均算出基準: {monthsElapsed}ヶ月</span> */}
             <span className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full text-slate-600">{uniqueSalesRanking.length} 名</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">順位</th>
                <th className="px-6 py-4">氏名</th>
                {/* 性別/年齢カラム削除済み */}
                <th className="px-6 py-4">年間売上累計</th>
                <th className="px-6 py-4 text-right">月平均</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {uniqueSalesRanking.map((talent, idx) => {
                const rank = idx + 1;
                let rankStyle = "text-slate-500 font-bold";
                let rowBg = "";
                let rankIcon = <span className="w-6 text-center inline-block">#{rank}</span>;
                
                if (rank === 1) {
                    rankStyle = "text-yellow-600 font-black text-xl";
                    rowBg = "bg-yellow-50/40";
                    rankIcon = <span className="w-8 h-8 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center shadow-sm ring-4 ring-white">1</span>;
                } else if (rank === 2) {
                    rankStyle = "text-slate-600 font-black text-xl";
                    rowBg = "bg-slate-50/40";
                    rankIcon = <span className="w-8 h-8 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center shadow-sm ring-4 ring-white">2</span>;
                } else if (rank === 3) {
                    rankStyle = "text-amber-700 font-black text-xl";
                    rowBg = "bg-amber-50/40";
                    rankIcon = <span className="w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center shadow-sm ring-4 ring-white">3</span>;
                }

                // 月平均を一律の月数(monthsElapsed)で割る
                // customAverageSalesがある場合はそれを使用
                const averageSales = talent.averageSales != null 
                    ? talent.averageSales 
                    : Math.round(talent.sales / monthsElapsed);

                return (
                  <tr key={talent.id} className={`hover:bg-slate-50 transition-colors group ${rowBg}`}>
                    <td className={`px-6 py-4 ${rankStyle}`}>{rankIcon}</td>
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-700 text-base group-hover:text-indigo-600 transition-colors">{talent.name}</div>
                        {/* 削除: {talent.specialty && <div className="text-xs text-slate-400 mt-1 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded">{talent.specialty}</div>} */}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600 text-base">{talent.sales.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">円</span></td>
                    <td className="px-6 py-4 text-right font-medium text-slate-500">{averageSales.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">円</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 8. タレント評価管理コンテンツ (新規追加)
const TalentEvaluationsContent = ({ talents, onUpdateEvaluation, onImportEvaluations }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState(null);
  const [formData, setFormData] = useState({ rating: 1, evaluationNote: '' });
  const [sortKey, setSortKey] = useState('rating'); // 'rating' | 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  // 評価編集モーダルを開く
  const handleEditClick = (talent) => {
      setSelectedTalent(talent);
      // 既存の評価があればセット、なければ0
      const ev = talent.evaluation || {};
      setFormData({
          acting: ev.acting || 0,
          suitability: ev.suitability || 0,
          attendance: ev.attendance || 0,
          reliability: ev.reliability || 0,
          evaluationNote: talent.evaluationNote || ''
      });
      setIsModalOpen(true);
  };

  // 評価保存
  const handleSave = () => {
      if (selectedTalent) {
          // 4項目の平均をratingとして保存 (参考用)
          const avg = (
              parseFloat(formData.acting) + 
              parseFloat(formData.suitability) + 
              parseFloat(formData.attendance) + 
              parseFloat(formData.reliability)
          ) / 4;

          onUpdateEvaluation(selectedTalent.id, {
              evaluation: {
                  acting: parseFloat(formData.acting),
                  suitability: parseFloat(formData.suitability),
                  attendance: parseFloat(formData.attendance),
                  reliability: parseFloat(formData.reliability)
              },
              rating: avg.toFixed(1), // 総合評価
              evaluationNote: formData.evaluationNote
          });
          setIsModalOpen(false);
      }
  };

  const handleImportClick = () => {
      fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target.result;
          const rows = parseCSV(text);
          // ヘッダー行をスキップしてデータ処理
          const dataRows = rows.slice(1);
          const evaluations = dataRows.map(row => {
               // CSV: ID, 氏名, 演技力, 適合性, 出席率, 信頼性, 総合評価, 管理者コメント
               if (row.length < 2) return null;
               return {
                   id: row[0],
                   name: row[1] ? row[1].replace(/"/g, '') : '',
                   evaluation: {
                       acting: parseFloat(row[2] || 0),
                       suitability: parseFloat(row[3] || 0),
                       attendance: parseFloat(row[4] || 0),
                       reliability: parseFloat(row[5] || 0)
                   },
                   rating: parseFloat(row[6] || 0),
                   evaluationNote: row[7] ? row[7].replace(/"/g, '') : ''
               };
          }).filter(d => d);

          if (evaluations.length > 0) {
              onImportEvaluations(evaluations);
          }
      };
      reader.readAsText(file);
  };


  // ソート・フィルタリング
  const processedTalents = useMemo(() => {
      let result = talents.filter(t => 
          t.name.includes(searchQuery) || (t.evaluationNote && t.evaluationNote.includes(searchQuery))
      );

      result.sort((a, b) => {
          let valA = a[sortKey];
          let valB = b[sortKey];
          
          if (sortKey === 'rating') {
              valA = Number(valA);
              valB = Number(valB);
          }

          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      });

      return result;
  }, [talents, sortKey, sortOrder, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">タレント評価管理</h2>
           <p className="text-slate-500 font-medium">パフォーマンス評価とフィードバック</p>
        </div>
        <div className="flex gap-4">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
            {/* CSVインポートボタン */}
            <button 
                onClick={handleImportClick}
                className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all font-bold text-xs flex items-center transform hover:-translate-y-0.5"
            >
                <Upload size={16} className="mr-2" /> CSVインポート
            </button>
            {/* CSVエクスポートボタン */}
            <button 
                onClick={() => exportToCSV(processedTalents, 'talent-evaluations.csv')}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-xs flex items-center shadow-sm"
            >
                <FileDown size={16} className="mr-2" /> CSVエクスポート
            </button>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-400 transition-colors" size={18} />
                <input 
                type="text" 
                placeholder="名前やコメントで検索..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-3 w-72 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 font-medium shadow-sm"
                />
            </div>
        </div>
      </header>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
          <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <div className="col-span-3 cursor-pointer hover:text-indigo-600 flex items-center" onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  氏名 <ArrowUpDown size={12} className="ml-1"/>
              </div>
              <div className="col-span-2 cursor-pointer hover:text-indigo-600 flex items-center" onClick={() => { setSortKey('rating'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  総合評価 <ArrowUpDown size={12} className="ml-1"/>
              </div>
              <div className="col-span-6">管理者コメント</div>
              <div className="col-span-1 text-right">操作</div>
          </div>

          <div className="flex-1 overflow-y-auto">
              {processedTalents.map(talent => (
                  <div key={talent.id} className="grid grid-cols-12 gap-4 px-8 py-5 items-center border-b border-slate-50 hover:bg-slate-50/50 transition-all group">
                      <div className="col-span-3 flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 overflow-hidden">
                              {talent.photo ? <img src={talent.photo} className="w-full h-full object-cover"/> : <UserX size={18}/>}
                          </div>
                          <div>
                              <p className="font-bold text-slate-700">{talent.name}</p>
                              <p className="text-[10px] text-slate-400">{talent.id.substring(0, 8)}...</p>
                          </div>
                      </div>
                      <div className="col-span-2">
                          <div className="flex items-center space-x-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                  <Star 
                                    key={star} 
                                    size={16} 
                                    className={`${star <= (talent.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                                  />
                              ))}
                              <span className="ml-2 text-sm font-bold text-slate-600">{talent.rating || 0}</span>
                          </div>
                      </div>
                      <div className="col-span-6">
                          <p className="text-sm text-slate-600 line-clamp-2">{talent.evaluationNote || <span className="text-slate-300 italic">コメントなし</span>}</p>
                      </div>
                      <div className="col-span-1 text-right">
                          <button 
                            onClick={() => handleEditClick(talent)}
                            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                              <Edit3 size={16} />
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-200">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800">評価・コメント編集</h3>
                          <p className="text-sm text-slate-500">{selectedTalent?.name}</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <InputField 
                              label="演技力 (0-5)" 
                              type="number" 
                              step="0.1" 
                              min="0" 
                              max="5"
                              value={formData.acting} 
                              onChange={(e) => setFormData({...formData, acting: e.target.value})} 
                          />
                          <InputField 
                              label="適合性 (0-5)" 
                              type="number" 
                              step="0.1" 
                              min="0" 
                              max="5"
                              value={formData.suitability} 
                              onChange={(e) => setFormData({...formData, suitability: e.target.value})} 
                          />
                          <InputField 
                              label="出席率 (0-5)" 
                              type="number" 
                              step="0.1" 
                              min="0" 
                              max="5"
                              value={formData.attendance} 
                              onChange={(e) => setFormData({...formData, attendance: e.target.value})} 
                          />
                          <InputField 
                              label="信頼性 (0-5)" 
                              type="number" 
                              step="0.1" 
                              min="0" 
                              max="5"
                              value={formData.reliability} 
                              onChange={(e) => setFormData({...formData, reliability: e.target.value})} 
                          />
                      </div>
                      <TextAreaField 
                          label="管理者コメント" 
                          value={formData.evaluationNote} 
                          onChange={(e) => setFormData({...formData, evaluationNote: e.target.value})}
                          rows={6}
                          placeholder="評価の詳細やフィードバックを入力してください..."
                      />
                  </div>

                  <div className="flex justify-end space-x-3 mt-8">
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">キャンセル</button>
                      <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700">保存</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// 7. レッスン管理コンテンツ
const LessonsContent = ({ talents, lessons, onAddLesson, onDeleteLesson }) => {
  const [viewMode, setViewMode] = useState('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [newLesson, setNewLesson] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '12:00',
    type: 'Acting',
    location: '',
    instructor: '',
    participants: [],
    notes: ''
  });

  const handleSave = () => {
    if(!newLesson.title) return;
    onAddLesson({
      ...newLesson,
      id: generateId()
    });
    setIsModalOpen(false);
    setNewLesson({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '12:00',
        type: 'Acting',
        location: '',
        instructor: '',
        participants: [],
        notes: ''
    });
  };

  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for(let i=0; i<startingDayOfWeek; i++) {
        days.push(null);
    }
    for(let i=1; i<=daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }
    return days;
  }, [selectedDate]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">レッスン管理</h2>
           <p className="text-slate-500 font-medium">スケジュールと受講履歴</p>
        </div>
        <div className="flex space-x-3">
           <div className="bg-slate-100 p-1 rounded-xl flex">
               <button 
                 onClick={() => setViewMode('list')}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                   リスト
               </button>
               <button 
                 onClick={() => setViewMode('calendar')}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                   カレンダー
               </button>
           </div>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-bold text-sm flex items-center hover:-translate-y-0.5"
           >
             <Plus size={18} className="mr-2" /> レッスン追加
           </button>
        </div>
      </header>

      {viewMode === 'list' && (
          <div className="space-y-4">
              {lessons.map(lesson => (
                  <div key={lesson.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start hover:shadow-md transition-all">
                      <div className="flex gap-4">
                          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white font-bold shadow-md ${
                              lesson.type === 'Acting' ? 'bg-amber-500' : 
                              lesson.type === 'Dance' ? 'bg-indigo-500' : 'bg-emerald-500'
                          }`}>
                              <span className="text-xs uppercase opacity-75">{new Date(lesson.date).toLocaleString('en', {month:'short'})}</span>
                              <span className="text-xl">{new Date(lesson.date).getDate()}</span>
                          </div>
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                      lesson.type === 'Acting' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                      lesson.type === 'Dance' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                      'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  }`}>
                                      {lesson.type}
                                  </span>
                                  <h3 className="font-bold text-slate-800">{lesson.title}</h3>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  <span className="flex items-center"><Clock size={14} className="mr-1"/> {lesson.startTime} - {lesson.endTime}</span>
                                  <span className="flex items-center"><MapPin size={14} className="mr-1"/> {lesson.location}</span>
                                  <span className="flex items-center"><UserCheck size={14} className="mr-1"/> {lesson.instructor}</span>
                              </div>
                          </div>
                      </div>
                      <button onClick={() => onDeleteLesson(lesson.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
              ))}
              {lessons.length === 0 && <p className="text-center text-slate-400 py-10">予定されているレッスンはありません。</p>}
          </div>
      )}

      {viewMode === 'calendar' && (
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">
                      {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月
                  </h3>
                  <div className="flex space-x-2">
                      <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronDown className="rotate-90" /></button>
                      <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronDown className="-rotate-90" /></button>
                  </div>
              </div>
              <div className="grid grid-cols-7 gap-4 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-xs font-bold text-slate-400 uppercase py-2">{day}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                      if(!day) return <div key={i} className="h-24"></div>;
                      const dayStr = day.toISOString().split('T')[0];
                      const dayLessons = lessons.filter(l => l.date === dayStr);
                      return (
                          <div key={i} className="h-24 border border-slate-50 rounded-xl p-2 text-left hover:bg-slate-50 transition-colors relative group">
                              <span className={`text-sm font-bold ${day.getDay() === 0 ? 'text-red-400' : 'text-slate-700'}`}>{day.getDate()}</span>
                              <div className="mt-1 space-y-1">
                                  {dayLessons.map((l, idx) => (
                                      <div key={idx} className={`text-[10px] truncate px-1.5 py-0.5 rounded ${
                                          l.type === 'Acting' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                                      }`}>
                                          {l.startTime} {l.title}
                                      </div>
                                  ))}
                              </div>
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
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="日付" type="date" value={newLesson.date} onChange={e => setNewLesson({...newLesson, date: e.target.value})} />
                        <SelectField label="ジャンル" value={newLesson.type} onChange={e => setNewLesson({...newLesson, type: e.target.value})} options={['Acting', 'Dance', 'Voice', 'Modeling', 'Other']} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="開始時間" type="time" value={newLesson.startTime} onChange={e => setNewLesson({...newLesson, startTime: e.target.value})} />
                        <InputField label="終了時間" type="time" value={newLesson.endTime} onChange={e => setNewLesson({...newLesson, endTime: e.target.value})} />
                    </div>
                    <InputField label="場所" value={newLesson.location} onChange={e => setNewLesson({...newLesson, location: e.target.value})} />
                    <InputField label="講師" value={newLesson.instructor} onChange={e => setNewLesson({...newLesson, instructor: e.target.value})} />
                </div>
                <div className="flex justify-end space-x-3 mt-8">
                    <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">キャンセル</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700">保存</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// 6. タレントリスト表示 (復元)
const TalentListContent = ({ talents, onSelect, onAddNew, onImport }) => {
  const [listTab, setListTab] = useState('active'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const fileInputRef = useRef(null);

  const filteredTalents = useMemo(() => {
    return talents.filter(t => {
      const statusMatch = t.status === listTab;
      const searchMatch = t.name.includes(searchQuery) || (t.specialty && t.specialty.includes(searchQuery));
      return statusMatch && searchMatch;
    });
  }, [talents, listTab, searchQuery]);

  const sortedTalents = useMemo(() => {
    if (!sortConfig.key) return filteredTalents;

    const sorted = [...filteredTalents].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'height' || sortConfig.key === 'rating') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      if (sortConfig.key === 'name') {
         aVal = a.kana || a.name || '';
         bVal = b.kana || b.name || '';
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredTalents, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ label, sortKey, colSpan, className = "" }) => (
    <div 
      className={`col-span-${colSpan} flex items-center cursor-pointer group hover:bg-slate-50 py-2 -my-2 rounded-lg px-2 -mx-2 transition-colors ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <span className="group-hover:text-indigo-600 transition-colors">{label}</span>
      <ArrowUpDown size={12} className={`ml-1.5 transition-colors ${sortConfig.key === sortKey ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-300'}`} />
    </div>
  );

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const importData = (rows, headerIndex, onImportCallback) => {
    const headers = rows[headerIndex];
    const dataRows = rows.slice(headerIndex + 1);

    const mapIdx = {};
    headers.forEach((h, i) => {
        const label = h ? h.trim() : '';
        if (label === '芸名') mapIdx.name = i;
        if (label === '性別') mapIdx.gender = i;
        if (label === '芸名フリガナ') mapIdx.kana = i;
        if (label === '本名') mapIdx.realName = i;
        if (label === '生年月日') mapIdx.birthDate = i;
        if (label === '身長') mapIdx.height = i;
        if (label === '体重') mapIdx.weight = i;
        if (label === 'B') mapIdx.bust = i;
        if (label === 'W') mapIdx.waist = i;
        if (label === 'H') mapIdx.hip = i;
        if (label === '足') mapIdx.shoeSize = i;
        if (label === '利き手') mapIdx.handedness = i;
        if (label === '出身地') mapIdx.birthPlace = i;
        if (label === '連絡先') mapIdx.mobile = i;
        if (label === 'Gmail') mapIdx.email = i;
        if (label === '郵便番号') mapIdx.zipCode = i;
        if (label === '住所') mapIdx.address = i;
        if (label === '最寄駅') mapIdx.nearestStation = i;
        if (label === 'SNSアカウント') mapIdx.sns = i;
        if (label === '振込口座') mapIdx.bankInfo = i;
        if (label === 'パスポート') mapIdx.passportExpiry = i;
        if (label === '普通自動車免許') mapIdx.license = i;
        if (label === '契約日') mapIdx.contractDate = i;
        if (label === 'プロフに書く特技') mapIdx.specialty = i;
        if (label === '資格・特技') mapIdx.specialtyDetail = i;
        if (label === 'ダンス歴') mapIdx.dance = i;
        if (label === '言語・方言') mapIdx.languages = i;
        if (label === 'スポーツ経験') mapIdx.sports = i;
        if (label === '歌唱力') mapIdx.singing = i;
        if (label === '楽器') mapIdx.music = i;
        if (label === 'ピアス穴') mapIdx.piercings = i;
        if (label === 'アレルギー') mapIdx.allergies = i;
        if (label === 'タバコ') mapIdx.smoking = i;
        if (label === 'アルコール') mapIdx.alcohol = i;
        if (label === '備考') mapIdx.notes = i;
        if (label === '特記事項') mapIdx.specialNotes = i;
    });

    const newTalents = dataRows
        .filter(row => {
            if (row.length <= 1) return false;
            // 芸名が空の行はスキップ
            const name = mapIdx.name !== undefined ? row[mapIdx.name] : null;
            return name && name.trim() !== '' && !name.includes('：') && !name.includes(':');
        })
        .map(row => {
            const getVal = (idx) => idx !== undefined && row[idx] ? row[idx].trim() : '';
            // 日付フォーマット変換などは適宜行う
            const birthDateStr = getVal(mapIdx.birthDate);
            const formattedBirthDate = formatDate(birthDateStr);
            const contractDateStr = getVal(mapIdx.contractDate);
            const formattedContractDate = formatDate(contractDateStr);
            
            return {
                id: generateId(),
                name: getVal(mapIdx.name),
                gender: getVal(mapIdx.gender),
                kana: getVal(mapIdx.kana),
                realName: getVal(mapIdx.realName),
                birthDate: formattedBirthDate,
                age: calculateAge(formattedBirthDate),
                height: getVal(mapIdx.height),
                weight: getVal(mapIdx.weight),
                bust: getVal(mapIdx.bust),
                waist: getVal(mapIdx.waist),
                hip: getVal(mapIdx.hip),
                shoeSize: getVal(mapIdx.shoeSize),
                handedness: getVal(mapIdx.handedness),
                birthPlace: getVal(mapIdx.birthPlace),
                mobile: getVal(mapIdx.mobile),
                email: getVal(mapIdx.email),
                zipCode: getVal(mapIdx.zipCode),
                address: getVal(mapIdx.address),
                nearestStation: getVal(mapIdx.nearestStation),
                sns: getVal(mapIdx.sns),
                bankInfo: getVal(mapIdx.bankInfo),
                passportExpiry: getVal(mapIdx.passportExpiry),
                license: getVal(mapIdx.license),
                contractDate: formattedContractDate,
                contractEndDate: '', 
                specialty: getVal(mapIdx.specialty),
                specialtyDetail: getVal(mapIdx.specialtyDetail),
                dance: getVal(mapIdx.dance) || 'なし',
                languages: getVal(mapIdx.languages) || 'なし',
                sports: getVal(mapIdx.sports) || 'なし',
                singing: getVal(mapIdx.singing) || '普通',
                music: getVal(mapIdx.music) || 'なし',
                piercings: getVal(mapIdx.piercings) || '無',
                allergies: getVal(mapIdx.allergies) || 'なし',
                smoking: getVal(mapIdx.smoking) || '無',
                alcohol: getVal(mapIdx.alcohol) || '無',
                notes: getVal(mapIdx.notes),
                specialNotes: getVal(mapIdx.specialNotes),
                status: 'active',
                sales: 0,
                rating: 1,
                action: 'なし',
                swordFight: 'なし',
                emergencyContact: '',
                dependents: '',
                education: '',
                tattoos: '無'
            };
        });

    if (newTalents.length > 0) {
        onImportCallback(newTalents);
    } else {
        alert("インポートできる有効なデータが見つかりませんでした。");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const processContent = (text) => {
        const rows = parseCSV(text);
        let headerIndex = -1;
        // 「芸名」を含む行をヘッダーとして探す（最初の30行）
        for(let i=0; i<Math.min(rows.length, 30); i++) {
            if(rows[i].some(c => c && c.trim() === '芸名')) {
                headerIndex = i;
                break;
            }
        }
        return { rows, headerIndex };
    };

    const reader = new FileReader();
    reader.onload = (evt) => {
        let text = evt.target.result;
        let { rows, headerIndex } = processContent(text);

        if (headerIndex !== -1) {
            importData(rows, headerIndex, onImport);
        } else {
            const readerSJIS = new FileReader();
            readerSJIS.onload = (evtSJIS) => {
                const textSJIS = evtSJIS.target.result;
                const resultSJIS = processContent(textSJIS);
                if (resultSJIS.headerIndex !== -1) {
                    importData(resultSJIS.rows, resultSJIS.headerIndex, onImport);
                } else {
                    alert("CSVファイルからヘッダー（'芸名'列）が見つかりませんでした。");
                }
            };
            readerSJIS.readAsText(file, 'Shift-JIS');
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">タレントデータベース</h2>
          <p className="text-slate-500 font-medium">所属タレントの一元管理</p>
        </div>
        <div className="flex space-x-3">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
          {/* CSVインポートボタン */}
          <button 
            onClick={handleImportClick}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-sm shadow-sm flex items-center"
          >
            <Download size={18} className="mr-2 text-slate-400" /> CSVインポート
          </button>
           {/* CSVエクスポートボタン (新規追加) */}
           <button 
            onClick={() => exportTalentListToCSV(filteredTalents, 'talent-database.csv')}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-sm shadow-sm flex items-center"
          >
            <FileDown size={18} className="mr-2 text-slate-400" /> CSVエクスポート
          </button>
          <button 
            onClick={onAddNew}
            className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-bold text-sm flex items-center hover:-translate-y-0.5"
          >
            <Plus size={18} className="mr-2" /> 新規登録
          </button>
        </div>
      </header>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] flex flex-col relative">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white sticky top-0 z-10">
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            <button 
              onClick={() => setListTab('active')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${listTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              所属 (Active)
            </button>
            <button 
              onClick={() => setListTab('retired')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${listTab === 'retired' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              退所 (Archived)
            </button>
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="名前、特技で検索..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 w-72 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
          <SortableHeader label="氏名 / 属性" sortKey="name" colSpan={4} />
          <SortableHeader label="データ" sortKey="height" colSpan={2} />
          <SortableHeader label="特技・スキル" sortKey="specialty" colSpan={3} />
          <SortableHeader label="契約 / 評価" sortKey="rating" colSpan={2} />
          <div className="col-span-1 text-right py-2">操作</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedTalents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search size={32} className="opacity-20" />
              </div>
              <p className="font-medium">該当するタレントが見つかりません</p>
            </div>
          ) : (
            sortedTalents.map((talent) => {
               const renewal = checkRenewalAlert(talent.contractEndDate);
               return (
                <div 
                  key={talent.id} 
                  className="grid grid-cols-12 gap-4 px-8 py-5 items-center border-b border-slate-50 hover:bg-indigo-50/30 transition-all group cursor-pointer"
                  onClick={() => onSelect(talent)}
                >
                  <div className="col-span-4 flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shrink-0 border-2 border-white shadow-sm group-hover:border-indigo-100 transition-colors">
                      {talent.photo ? (
                        <img src={talent.photo} alt={talent.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Users size={20}/></div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-base group-hover:text-indigo-600 transition-colors">{talent.name}</h4>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{talent.gender} • {talent.age}歳 • {talent.birthPlace}</p>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-slate-500 font-medium">
                    <p>{talent.height}cm / {talent.weight}kg</p>
                    <p className="text-xs text-slate-400 mt-0.5">靴: {talent.shoeSize}</p>
                  </div>
                  <div className="col-span-3">
                    <div className="flex flex-wrap gap-1.5">
                      {talent.specialty && <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-bold shadow-sm">{talent.specialty}</span>}
                      {talent.dance !== 'なし' && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold">Dance</span>}
                      {talent.singing === '得意' && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-bold">Sing</span>}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center space-x-1 mb-1.5">
                      <span className={`text-${talent.rating >= 4 ? 'amber-400' : 'slate-300'}`}><Star size={14} fill="currentColor" /></span>
                      <span className="text-sm font-bold text-slate-700">{talent.rating}.0</span>
                    </div>
                    {listTab === 'active' && renewal && (
                      <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                        RENEWAL
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white hover:shadow-md rounded-lg transition-all">
                      <Edit3 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


/**
 * ------------------------------------------------------------------
 * メインアプリケーション
 * ------------------------------------------------------------------
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [talents, setTalents] = useState(generateMockData());
  const [lessons, setLessons] = useState(generateMockLessons()); // レッスン用State
  const [selectedTalent, setSelectedTalent] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);

  // 全社売上（月次）のステート
  const [companySalesData, setCompanySalesData] = useState({
    current: Array(12).fill(0),
    previous: Array(12).fill(0)
  });
  
  // イベント用ステート（追加）
  const [events, setEvents] = useState(generateMockEvents());

  // レッスン追加処理
  const handleAddLesson = (newLesson) => {
      setLessons(prev => [...prev, newLesson]);
  };

  // レッスン削除処理
  const handleDeleteLesson = (id) => {
      setLessons(prev => prev.filter(l => l.id !== id));
  };

  // 評価更新処理（新規追加）
  const handleUpdateEvaluation = (id, newEvaluation) => {
      setTalents(prev => prev.map(t => 
          t.id === id ? { ...t, ...newEvaluation } : t
      ));
  };
  
  // 評価インポート処理 (NEW)
  const handleImportEvaluations = (importedData) => {
    setTalents(prev => {
        return prev.map(t => {
            // IDまたは名前でマッチング
            const match = importedData.find(d => d.id === t.id || d.name === t.name);
            if (match) {
                return {
                    ...t,
                    rating: match.rating,
                    evaluation: match.evaluation,
                    evaluationNote: match.evaluationNote
                };
            }
            return t;
        });
    });
    alert(`${importedData.length}件の評価データをインポートしました。`);
  };

  // イベント追加処理 (NEW)
  const handleAddEvent = (newEvent) => {
      setEvents(prev => [...prev, { ...newEvent, id: generateId() }]);
  };


  // ... (Other handlers: handleSaveTalent, handleDeleteTalent, etc.)
  
  // 以下、既存のハンドラ定義 (再掲または省略されていた部分を補完)
  const handleSaveTalent = (updatedTalent) => {
    if (updatedTalent.id) {
      setTalents(prev => prev.map(t => t.id === updatedTalent.id ? updatedTalent : t));
    } else {
      const newTalent = { ...updatedTalent, id: generateId(), status: 'active', sales: 0 };
      setTalents(prev => [newTalent, ...prev]);
    }
    setIsEditing(false);
    setSelectedTalent(null);
  };

  const handleDeleteTalent = (id) => {
    setTalents(prev => prev.filter(t => t.id !== id));
    setIsEditing(false);
    setSelectedTalent(null);
  };

  const handleRetireTalent = (id) => {
    setTalents(prev => prev.map(t => t.id === id ? { ...t, status: 'retired' } : t));
    setIsEditing(false);
    setSelectedTalent(null);
  };

  const handleImport = (newTalents) => {
    const initialized = newTalents.map((t, i) => ({ ...t, id: generateId() }));
    setTalents(prev => [...initialized, ...prev]);
  };

  const handleImportTalentSales = (salesData) => {
     // ... (Previous logic)
     setTalents(prev => {
      const updatedTalents = prev.map(talent => {
        const salesInfo = salesData.find(s => s.name === talent.name || talent.name.includes(s.name) || s.name.includes(talent.name));
        if (salesInfo) return { ...talent, sales: salesInfo.totalSales, monthlySales: salesInfo.monthlySales, averageSales: salesInfo.averageSales };
        return talent;
      });
      const newTalents = salesData.filter(s => !updatedTalents.some(t => t.name === s.name || t.name.includes(s.name) || s.name.includes(t.name))).map((s, index) => ({
        id: generateId(), status: 'active', name: s.name, sales: s.totalSales, monthlySales: s.monthlySales, averageSales: s.averageSales,
        gender: '-', kana: '', realName: '', education: '', mobile: '', email: '', zipCode: '', address: '', nearestStation: '', emergencyContact: '', dependents: '', sns: '', bankInfo: '', birthDate: '', age: '-', passportExpiry: '', birthPlace: '', contractDate: '', contractEndDate: '', height: 0, weight: 0, bust: 0, waist: 0, hip: 0, shoeSize: 0, handedness: '', piercings: '', tattoos: '', allergies: '', smoking: '', alcohol: '', license: '', specialty: '', specialtyDetail: '', dance: '', action: '', swordFight: '', languages: '', sports: '', games: '', music: '', singing: '', notes: '', specialNotes: '', rating: 0,
      }));
      return [...updatedTalents, ...newTalents];
    });
    alert(`売上データを取り込みました。`);
  };

  const handleImportCompanySales = (totalMonthlySales, yearType) => {
    setCompanySalesData(prev => ({ ...prev, [yearType]: totalMonthlySales }));
    alert(`${yearType === 'current' ? '今年度' : '前年度'}の全社売上データをグラフに反映しました。`);
  };
  
  // モックデータ生成用ハンドラ（サイドバーから呼び出し）
  const handleGenerateMock = () => {
      setTalents(generateMockData());
      setCompanySalesData({
          current: [1000000, 1200000, 1100000, 1300000, 1400000, 1500000, 1600000, 1500000, 1400000, 1300000, 1200000, 1100000],
          previous: [900000, 1000000, 950000, 1100000, 1200000, 1300000, 1400000, 1300000, 1200000, 1100000, 1000000, 900000]
      });
      alert('サンプルデータを投入しました。');
  };

  // 画面ルーティング
  const renderContent = () => {
    if (isEditing || selectedTalent) {
      return (
        <TalentForm 
          talent={selectedTalent || {}} 
          onSave={handleSaveTalent} // 定義済みハンドラを使用
          onBack={() => { setSelectedTalent(null); setIsEditing(false); }}
          onDelete={handleDeleteTalent} // 定義済みハンドラを使用
          onRetire={handleRetireTalent} // 定義済みハンドラを使用
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
            <DashboardContent 
                talents={talents} 
                companySalesData={companySalesData} 
                events={events}
                onAddEvent={handleAddEvent}
            />
        );
      case 'sales':
        return (
          <SalesAnalysisContent 
            talents={talents} 
            companySalesData={companySalesData}
            onImportTalentSales={handleImportTalentSales} // 定義済みハンドラ
            onImportCompanySales={handleImportCompanySales} // 定義済みハンドラ
          />
        );
      case 'evaluations': // 評価管理画面追加
        return (
          <TalentEvaluationsContent 
             talents={talents}
             onUpdateEvaluation={handleUpdateEvaluation}
             onImportEvaluations={handleImportEvaluations} // ハンドラを渡す
          />
        );
      case 'talents':
        return (
          <TalentListContent 
            talents={talents} 
            onSelect={(t) => { setSelectedTalent(t); setIsEditing(true); }}
            onAddNew={() => { setSelectedTalent({}); setIsEditing(true); }}
            onImport={handleImport} // 定義済みハンドラ
          />
        );
      case 'lessons': // レッスン画面
        return (
          <LessonsContent 
             talents={talents}
             lessons={lessons}
             onAddLesson={handleAddLesson}
             onDeleteLesson={handleDeleteLesson}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Settings size={64} className="mb-4 opacity-20" />
            <p className="text-lg">Coming Soon...</p>
            <p className="text-sm">この機能は現在開発中です。</p>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-600">
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setSelectedTalent(null); setIsEditing(false); }} onGenerateMock={handleGenerateMock} />
      <main className="ml-72 flex-1 p-10 h-screen overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
