import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, LayoutDashboard, TrendingUp, Award, FileText, Settings, 
  LogOut, Search, Plus, Trash2, Edit3, Upload, AlertTriangle, 
  ChevronRight, Save, X, Camera, DollarSign, Calendar as CalendarIcon, UserCheck, 
  Archive, Download, UserX, MapPin, CreditCard, MessageSquare,
  ArrowUpDown, Filter, RefreshCw, BarChart3, ChevronDown, History, Database,
  Clock, Star, ThumbsUp, Gift, Megaphone, FileDown, Gift as GiftIcon, Lock, Mail, LogIn, UserPlus,
  Cloud, CloudOff,
  List
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
 * 0. Error Boundary & Utils
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
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#333' }}>
          <h1 style={{ color: '#e11d48' }}>Something went wrong.</h1>
          <p>アプリケーションでエラーが発生しました。</p>
          <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', overflow: 'auto', fontSize: '12px' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ページを再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 堅牢なID生成
const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Ignore error and fallback
  }
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * ------------------------------------------------------------------
 * 1. Firebase 初期化 (Safety Wrapper)
 * ------------------------------------------------------------------
 */
let app = null;
let auth = null;
let db = null;
let firebaseError = null;

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const config = JSON.parse(__firebase_config);
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } else {
    console.warn("No firebase config found. Running in offline/demo mode.");
  }
} catch (e) {
  console.error("Firebase init error:", e);
  firebaseError = e;
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Utilities
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

const exportTalentListToCSV = (data = [], filename) => {
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
 * 3. UI Components (Safe Defaults)
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

const SelectField = ({ label, options = [], value, className = "", ...props }) => {
  const displayOptions = useMemo(() => {
    const uniqueOptions = Array.from(new Set(options || []));
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
    <div className="bg-white p-6 rounded-[24px] shadow-sm border border-
