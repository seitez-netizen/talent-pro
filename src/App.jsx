import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, LayoutDashboard, TrendingUp, Award, FileText, Settings, 
  LogOut, Search, Plus, Trash2, Edit3, Upload, AlertTriangle, 
  ChevronRight, Save, X, Calendar as CalendarIcon, UserCheck, 
  Download, BarChart3, ChevronDown, Database,
  Star, Gift, Lock, LogIn, UserPlus,
  Cloud, CloudOff, PieChart, ArrowUpRight, ArrowDownRight, MoreVertical,
  CalendarDays, List
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
  writeBatch
} from 'firebase/firestore';

/**
 * ------------------------------------------------------------------
 * 1. Firebase 初期化 & ユーティリティ
 * ------------------------------------------------------------------
 */

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ID生成
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 数値フォーマット (円, カンマ区切り)
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
};

// CSVパース (Shift-JIS対応 & 汎用)
const parseCSV = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = [];
      let currentRow = [];
      let currentCell = '';
      let inQuote = false;
      
      // BOM除去
      let processedText = text;
      if (processedText.charCodeAt(0) === 0xFEFF) {
        processedText = processedText.slice(1);
      }

      for (let i = 0; i < processedText.length; i++) {
        const char = processedText[i];
        const nextChar = processedText[i + 1];

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
            currentRow.push(currentCell.trim());
            currentCell = '';
          } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
            if (char === '\r') i++;
          } else if (char === '\r') {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
          } else {
            currentCell += char;
          }   
        }
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
      }
      resolve(rows);
    };
    reader.onerror = (err) => reject(err);
    
    // 文字コード判定と読み込み (簡易実装: Shift-JISトライ)
    // 実際には jschardet 等が必要だが、ここでは TextDecoder で Shift-JIS を試みる
    try {
        reader.readAsText(file, 'Shift_JIS');
    } catch (e) {
        reader.readAsText(file, 'UTF-8');
    }
  });
};

// 契約更新アラート判定 (7ヶ月前)
const checkRenewalAlert = (contractEndDate) => {
  if (!contractEndDate) return false;
  const today = new Date();
  const end = new Date(contractEndDate);
  if (isNaN(end.getTime())) return false;
  const diffMonths = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
  return diffMonths <= 7 && diffMonths >= 0;
};

// 年齢計算
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

/**
 * ------------------------------------------------------------------
 * 2. モックデータ
 * ------------------------------------------------------------------
 */

const generateMockData = () => {
  const names = [
    "織田 エミリ", "徳田 皓己", "山中 啓伍", "坂本 珠里", "杉村 龍之助",
    "黒川 大聖", "若林 元太", "生田 俊平", "山田 杏華", "林 純一郎",
    "望月 亮人", "村澤 瑠依", "ドンジュン", "田中 美咲", "鈴木 大輔"
  ];
  return names.map((name, i) => {
    // 誕生日の生成（今週の誕生日テスト用含む）
    const today = new Date();
    let bMonth, bDay;
    if (i < 2) { // 最初の2人は今週誕生日
        const d = new Date();
        d.setDate(today.getDate() + i + 1);
        bMonth = d.getMonth() + 1;
        bDay = d.getDate();
    } else {
        bMonth = (i % 12) + 1;
        bDay = (i % 28) + 1;
    }
    const birthDate = `2000-${String(bMonth).padStart(2,'0')}-${String(bDay).padStart(2,'0')}`;
    const contractEndDate = `2026-0${(i % 9) + 1}-01`;

    return {
      id: generateId(), 
      status: 'active',
      sales: Math.floor(Math.random() * 5000000) + 1000000, // 年間売上累計
      monthlyAverage: 0, // 月平均
      name: name,
      gender: i % 5 === 4 ? "女" : "男", 
      email: `talent${i}@agency.co.jp`,
      birthDate: birthDate,
      age: calculateAge(birthDate),
      contractDate: "2020-04-01",
      contractEndDate: contractEndDate,
      rating: (i % 5) + 1,
      evaluationNote: "特になし",
      height: 160 + i, weight: 50 + i, bust: 85, waist: 60, hip: 88, shoeSize: 24.5,
      bankName: "〇〇銀行", branchName: "本店", accountType: "普通", accountNumber: "1234567", accountHolder: name
    };
  });
};

const generateMockLessons = () => {
    return Array(5).fill(null).map((_, i) => ({
        id: generateId(),
        title: `演技特別レッスン ${i+1}`,
        date: new Date().toISOString().split('T')[0],
        startTime: '13:00',
        endTime: '15:00',
        type: 'Acting',
        location: '第1スタジオ',
        instructor: '田中コーチ'
    }));
};

/**
 * ------------------------------------------------------------------
 * 3. UI コンポーネント (部品) - 順序厳守
 * ------------------------------------------------------------------
 */

const InputField = ({ label, className = "", ...props }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">{label}</label>
    <input className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300" {...props} />
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
          {displayOptions.map((opt, i) => (
            <option key={`${opt}-${i}`} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={16} /></div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, subtext, icon: Icon, colorTheme = "indigo", trend = "up" }) => {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    slate: "text-slate-600 bg-slate-100",
  };
  
  return (
    <div className="bg-white p-6 rounded-[32px] shadow-lg shadow-slate-200/50 border border-slate-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colors[colorTheme]}`}>
          <Icon size={24} />
        </div>
        {subtext && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {subtext}
          </div>
        )}
      </div>
      <h3 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">{value}</h3>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400"/></button>
                </div>
                {children}
            </div>
        </div>
    );
};

/**
 * ------------------------------------------------------------------
 * 4. コンテンツ コンポーネント (機能ロジック)
 * ------------------------------------------------------------------
 */

// A. ダッシュボード
const DashboardContent = ({ talents, companySalesData, events }) => {
  // 今期の全社売上 (2026年9月期と仮定: companySalesData.current の合計)
  const totalSalesCurrent = useMemo(() => companySalesData.current.reduce((a, b) => a + b, 0), [companySalesData]);
  const totalSalesPrevious = useMemo(() => companySalesData.previous.reduce((a, b) => a + b, 0), [companySalesData]);
  const salesGrowth = totalSalesPrevious > 0 ? ((totalSalesCurrent - totalSalesPrevious) / totalSalesPrevious * 100).toFixed(1) : 0;

  // Activeタレント数
  const activeTalents = talents.filter(t => t.status === 'active');
  const activeCount = activeTalents.length;

  // 今週の誕生日ロジック
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const currentWeekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    const currentWeekEnd = new Date(today.setDate(today.getDate() + 6));
    
    return activeTalents.filter(t => {
      if (!t.birthDate) return false;
      const d = new Date(t.birthDate);
      // 今年の誕生日に変換
      const thisYearBirthday = new Date(new Date().getFullYear(), d.getMonth(), d.getDate());
      return thisYearBirthday >= new Date() && thisYearBirthday <= currentWeekEnd; // 簡易的に今後1週間以内とする
    }).sort((a, b) => {
        const da = new Date(a.birthDate);
        const db = new Date(b.birthDate);
        return (da.getMonth() * 100 + da.getDate()) - (db.getMonth() * 100 + db.getDate());
    });
  }, [activeTalents]);

  // 売上トップ10
  const topTalents = useMemo(() => {
    return [...activeTalents]
      .sort((a, b) => (b.sales || 0) - (a.sales || 0))
      .slice(0, 10);
  }, [activeTalents]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard</h2>
        <p className="text-slate-500 font-medium">2026年9月期 経営概況</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard 
            title="今期 全社売上累計" 
            value={formatCurrency(totalSalesCurrent)} 
            subtext={`前年比 ${salesGrowth > 0 ? '+' : ''}${salesGrowth}%`} 
            trend={salesGrowth >= 0 ? 'up' : 'down'}
            icon={TrendingUp} 
            colorTheme="indigo" 
        />
        <KpiCard 
            title="所属タレント数 (Active)" 
            value={`${activeCount}名`} 
            subtext="前月比 +2名" 
            icon={Users} 
            colorTheme="emerald" 
        />
        <KpiCard 
            title="進行中プロジェクト" 
            value={`${events.length}件`} 
            subtext="今月の稼働案件" 
            icon={FileText} 
            colorTheme="amber" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 売上トップ10 */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Award className="text-amber-500" /> 売上ランキング Top 10
            </h3>
            <div className="space-y-4">
                {topTalents.map((t, index) => (
                    <div key={t.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                            ${index === 0 ? 'bg-amber-100 text-amber-600 border border-amber-200' : 
                              index === 1 ? 'bg-slate-200 text-slate-600 border border-slate-300' : 
                              index === 2 ? 'bg-orange-100 text-orange-600 border border-orange-200' : 
                              'bg-slate-50 text-slate-400'}
                        `}>
                            {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 truncate">{t.name}</p>
                            <p className="text-xs text-slate-400 truncate">月平均: {formatCurrency(Math.floor(t.sales / 12))}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-indigo-600">{formatCurrency(t.sales)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* サイドカラム: 誕生日 & スケジュール */}
        <div className="space-y-8">
            {/* 誕生日ウィジェット */}
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                    <Gift className="text-rose-500" /> 今週のバースデー
                </h3>
                <div className="space-y-3 relative z-10">
                    {upcomingBirthdays.length > 0 ? upcomingBirthdays.map(t => (
                        <div key={t.id} className="flex items-center gap-3 bg-white/50 backdrop-blur-sm p-2 rounded-lg border border-slate-100">
                             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white font-bold text-xs">
                                {t.name[0]}
                             </div>
                             <div>
                                 <p className="text-sm font-bold text-slate-700">{t.name}</p>
                                 <p className="text-xs text-rose-500 font-medium">{new Date(t.birthDate).getMonth()+1}月{new Date(t.birthDate).getDate()}日</p>
                             </div>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-400">該当者なし</p>
                    )}
                </div>
            </div>

            {/* 重要スケジュール */}
            <div className="bg-slate-900 p-8 rounded-[32px] shadow-lg text-white">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <CalendarDays className="text-indigo-400" /> 重要スケジュール
                </h3>
                <div className="space-y-4">
                    {events.slice(0, 3).map(ev => (
                        <div key={ev.id} className="border-l-2 border-indigo-500 pl-4 py-1">
                            <p className="text-xs text-indigo-300 font-bold mb-1">{ev.date}</p>
                            <p className="text-sm font-bold">{ev.title}</p>
                            <p className="text-xs text-slate-400 mt-1">{ev.talent}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// B. 売上分析
const SalesAnalysisContent = ({ talents, companySalesData, onImportPL, onImportTalentSales }) => {
    const fileInputPL = useRef(null);
    const fileInputTalent = useRef(null);

    // 全社売上グラフデータ
    const months = ['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月'];
    const maxSales = Math.max(...companySalesData.current, ...companySalesData.previous, 1);

    const handlePLUpload = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const rows = await parseCSV(file);
        
        // ヘッダー行検出 (Oct, 10月 等)
        const headerRowIndex = rows.findIndex(row => row.some(cell => /10月|Oct/i.test(cell)));
        if (headerRowIndex === -1) { alert("ヘッダー行(10月/Oct)が見つかりません。"); return; }
        
        // データ行特定 (「売上」または数値が含まれる行)
        // 簡易ロジック: ヘッダーの次の行から、数値が入っている最初の行を「売上」とみなす
        let salesRow = rows.find((row, idx) => idx > headerRowIndex && (row.some(c => /売上|Sales/i.test(c)) || !isNaN(parseInt(row[1]?.replace(/,/g, '')))));
        
        if (!salesRow) { alert("売上データ行が見つかりません。"); return; }
        
        // 数値抽出・クリーニング (10月〜9月の12ヶ月分と仮定して抽出)
        // ヘッダー行の「10月」の位置から12列分を取得するのが理想だが、ここでは簡易的に行の数値セルを抽出
        const numbers = salesRow.map(cell => parseInt(cell.replace(/[¥,円"]/g, '').trim())).filter(n => !isNaN(n));
        
        // 今期データとして取り込み (最初の12個)
        const newCurrent = numbers.slice(0, 12);
        // 足りない場合は0埋め
        while(newCurrent.length < 12) newCurrent.push(0);
        
        onImportPL(newCurrent);
    };

    const handleTalentUpload = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const rows = await parseCSV(file);
        
        if(rows.length < 2) return;

        // A1セル (経過月数)
        const monthsPassed = parseInt(rows[0][0]);
        if (isNaN(monthsPassed) || monthsPassed === 0) { alert("A1セルに経過月数(分母)が正しく入力されていません。"); return; }

        const updates = [];
        // 2行目以降を解析
        rows.forEach((row, idx) => {
            if (idx < 1) return; // ヘッダー等はスキップの可能性ありだが、仕様では特定されていないため全走査
            
            const name = row[0]; // 1列目: 氏名
            // N列 (インデックス13)
            const yearSalesRaw = row[13]; 
            
            if (name && yearSalesRaw) {
                const yearSales = parseInt(yearSalesRaw.toString().replace(/[¥,円"]/g, '').trim());
                if (!isNaN(yearSales)) {
                    const monthlyAvg = Math.floor(yearSales / monthsPassed);
                    updates.push({ name, sales: yearSales, monthlyAverage: monthlyAvg });
                }
            }
        });

        onImportTalentSales(updates);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Sales Analysis</h2>
                    <p className="text-slate-500 font-medium">全社売上およびタレント別パフォーマンス分析</p>
                </div>
                <div className="flex gap-3">
                    <input type="file" ref={fileInputPL} onChange={handlePLUpload} className="hidden" accept=".csv" />
                    <button onClick={() => fileInputPL.current.click()} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center shadow-sm">
                        <Upload size={16} className="mr-2"/> PLデータ取込
                    </button>
                    <input type="file" ref={fileInputTalent} onChange={handleTalentUpload} className="hidden" accept=".csv" />
                    <button onClick={() => fileInputTalent.current.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 flex items-center shadow-lg shadow-indigo-200">
                        <Upload size={16} className="mr-2"/> タレント売上取込
                    </button>
                </div>
            </header>

            {/* 全社売上グラフ (前年対比) */}
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center"><BarChart3 className="mr-2 text-indigo-600"/> 全社売上推移 (前年対比)</h3>
                <div className="h-80 flex items-end justify-between gap-4 px-4">
                    {months.map((m, i) => (
                        <div key={m} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                            <div className="flex items-end gap-1 w-full justify-center h-full">
                                {/* 前期 (薄色) */}
                                <div 
                                    className="w-3 bg-slate-200 rounded-t-sm relative group-hover:bg-slate-300 transition-all" 
                                    style={{ height: `${(companySalesData.previous[i] / maxSales) * 100}%` }}
                                >
                                     <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{formatCurrency(companySalesData.previous[i])}</div>
                                </div>
                                {/* 今期 (濃色) */}
                                <div 
                                    className="w-3 bg-indigo-600 rounded-t-sm relative shadow-lg shadow-indigo-200 group-hover:bg-indigo-700 transition-all" 
                                    style={{ height: `${(companySalesData.current[i] / maxSales) * 100}%` }}
                                >
                                     <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 whitespace-nowrap">{formatCurrency(companySalesData.current[i])}</div>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-slate-400 mt-2">{m}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-6 mt-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className="w-3 h-3 bg-slate-200 rounded-sm"></span> 前期</div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800"><span className="w-3 h-3 bg-indigo-600 rounded-sm"></span> 今期</div>
                </div>
            </div>

            {/* タレント別売上リスト */}
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800">タレント別売上レポート</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">順位</th>
                                <th className="px-6 py-4">氏名</th>
                                <th className="px-6 py-4 text-right">年間売上累計</th>
                                <th className="px-6 py-4 text-right">月平均売上 (推定)</th>
                                <th className="px-6 py-4 text-center">前月比</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {[...talents].sort((a,b)=>(b.sales||0)-(a.sales||0)).map((t, idx) => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{t.name}</td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{formatCurrency(t.sales)}</td>
                                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(t.monthlyAverage || Math.floor(t.sales/12))}</td>
                                    <td className="px-6 py-4 text-center text-xs">
                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold">---</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// C. タレント評価管理
const TalentEvaluationsContent = ({ talents, onUpdateEvaluation }) => {
    const [selectedTalent, setSelectedTalent] = useState(null);
    const [editForm, setEditForm] = useState({ rating: 0, note: '' });
    const [sortOrder, setSortOrder] = useState('name'); // name | rating

    const sortedTalents = useMemo(() => {
        return [...talents].sort((a, b) => {
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            return b.rating - a.rating;
        });
    }, [talents, sortOrder]);

    const handleEditClick = (t) => {
        setSelectedTalent(t);
        setEditForm({ rating: t.rating || 0, note: t.evaluationNote || '' });
    };

    const handleSave = () => {
        onUpdateEvaluation(selectedTalent.id, { rating: parseInt(editForm.rating), evaluationNote: editForm.note });
        setSelectedTalent(null);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <header className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Evaluations</h2>
                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                    <button onClick={()=>setSortOrder('name')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${sortOrder==='name'?'bg-slate-100 text-slate-800':'text-slate-400'}`}>名前順</button>
                    <button onClick={()=>setSortOrder('rating')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${sortOrder==='rating'?'bg-slate-100 text-slate-800':'text-slate-400'}`}>評価順</button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedTalents.map(t => (
                    <div key={t.id} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{t.name}</h3>
                                <p className="text-xs text-slate-400">ID: {t.id.slice(0,8)}</p>
                            </div>
                            <button onClick={()=>handleEditClick(t)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <Edit3 size={16}/>
                            </button>
                        </div>
                        <div className="flex items-center gap-1 mb-4">
                            {[1,2,3,4,5].map(star => (
                                <Star key={star} size={18} className={star <= t.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                            ))}
                            <span className="ml-2 text-sm font-bold text-slate-600">{t.rating}.0</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl min-h-[80px]">
                            <p className="text-sm text-slate-600 italic line-clamp-3">
                                "{t.evaluationNote || 'コメントなし'}"
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={!!selectedTalent} onClose={()=>setSelectedTalent(null)} title="評価編集">
                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-bold text-slate-500 mb-2 block">Rating</label>
                        <div className="flex gap-2">
                            {[1,2,3,4,5].map(s => (
                                <button key={s} onClick={()=>setEditForm({...editForm, rating: s})} className="focus:outline-none transition-transform hover:scale-110">
                                    <Star size={32} className={s <= editForm.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 block">Manager's Note</label>
                        <textarea 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                            rows={4}
                            value={editForm.note}
                            onChange={(e)=>setEditForm({...editForm, note: e.target.value})}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={()=>setSelectedTalent(null)} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100">キャンセル</button>
                        <button onClick={handleSave} className="px-6 py-2 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg">保存</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// D. タレントデータベース (詳細フォーム含む)
const TalentListContent = ({ talents, onSelect, onAddNew }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Talent Database</h2>
                <button onClick={onAddNew} className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all font-bold text-sm flex items-center">
                    <Plus size={18} className="mr-2" /> 新規登録
                </button>
            </header>
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <div className="col-span-3">名前</div>
                    <div className="col-span-2">ステータス</div>
                    <div className="col-span-4">契約状況</div>
                    <div className="col-span-3 text-right">操作</div>
                </div>
                <div className="divide-y divide-slate-50">
                    {talents.map(t => {
                        const isAlert = checkRenewalAlert(t.contractEndDate);
                        return (
                            <div key={t.id} className="grid grid-cols-12 gap-4 px-8 py-5 items-center hover:bg-slate-50 transition-all cursor-pointer" onClick={() => onSelect(t)}>
                                <div className="col-span-3">
                                    <p className="font-bold text-slate-700">{t.name}</p>
                                    <p className="text-xs text-slate-400">{t.email}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {t.status === 'active' ? 'Active' : 'Retired'}
                                    </span>
                                </div>
                                <div className="col-span-4 flex items-center gap-2">
                                    <span className="text-sm text-slate-600">{t.contractEndDate} まで</span>
                                    {isAlert && (
                                        <span className="flex items-center gap-1 bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">
                                            <AlertTriangle size={10} /> 更新時期
                                        </span>
                                    )}
                                </div>
                                <div className="col-span-3 text-right">
                                    <ChevronRight size={16} className="text-slate-300 ml-auto"/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const TalentForm = ({ talent, onSave, onBack, onDelete }) => {
    const [formData, setFormData] = useState({ ...talent });

    return (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight className="rotate-180" size={24}/></button>
                <h2 className="text-2xl font-bold text-slate-800">{talent.id ? 'タレント詳細編集' : '新規タレント登録'}</h2>
            </div>
            
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-8">
                {/* 基本情報 */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Basic Info</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <InputField label="氏名" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                        <InputField label="メールアドレス" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                        <InputField label="生年月日" type="date" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                        <SelectField label="性別" value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value})} options={['男', '女', 'その他']} />
                    </div>
                </section>

                {/* 身体データ & スキル */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Stats & Skills</h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <InputField label="Height (cm)" type="number" value={formData.height || ''} onChange={e => setFormData({...formData, height: e.target.value})} />
                        <InputField label="Weight (kg)" type="number" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: e.target.value})} />
                        <InputField label="Shoes (cm)" type="number" value={formData.shoeSize || ''} onChange={e => setFormData({...formData, shoeSize: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <InputField label="Bust" type="number" value={formData.bust || ''} onChange={e => setFormData({...formData, bust: e.target.value})} />
                        <InputField label="Waist" type="number" value={formData.waist || ''} onChange={e => setFormData({...formData, waist: e.target.value})} />
                        <InputField label="Hip" type="number" value={formData.hip || ''} onChange={e => setFormData({...formData, hip: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <InputField label="特技" value={formData.specialty || ''} onChange={e => setFormData({...formData, specialty: e.target.value})} />
                        <InputField label="趣味" value={formData.hobby || ''} onChange={e => setFormData({...formData, hobby: e.target.value})} />
                    </div>
                </section>

                {/* 銀行口座 */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Bank Account</h3>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                        <InputField label="銀行名" value={formData.bankName || ''} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                        <InputField label="支店名" value={formData.branchName || ''} onChange={e => setFormData({...formData, branchName: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                         <SelectField label="種別" value={formData.accountType || ''} onChange={e => setFormData({...formData, accountType: e.target.value})} options={['普通', '当座']} />
                         <InputField label="口座番号" value={formData.accountNumber || ''} onChange={e => setFormData({...formData, accountNumber: e.target.value})} />
                         <InputField label="口座名義" value={formData.accountHolder || ''} onChange={e => setFormData({...formData, accountHolder: e.target.value})} />
                    </div>
                </section>

                {/* 契約情報 */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Contract</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <InputField label="契約開始日" type="date" value={formData.contractDate || ''} onChange={e => setFormData({...formData, contractDate: e.target.value})} />
                        <InputField label="契約終了日" type="date" value={formData.contractEndDate || ''} onChange={e => setFormData({...formData, contractEndDate: e.target.value})} />
                    </div>
                </section>

                <div className="flex justify-end gap-4 mt-8 pt-8 border-t border-slate-50">
                    {talent.id && <button onClick={() => onDelete(talent.id)} className="px-6 py-3 rounded-xl text-rose-500 font-bold hover:bg-rose-50 transition-colors">削除</button>}
                    <button onClick={() => onSave(formData)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">保存</button>
                </div>
            </div>
        </div>
    );
};

// E. レッスン管理
const LessonsContent = ({ lessons, onAddLesson, onDeleteLesson }) => {
    const [viewMode, setViewMode] = useState('list'); // list | calendar
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newLesson, setNewLesson] = useState({ date: '', title: '', startTime: '', endTime: '', location: '', instructor: '' });

    const handleAdd = () => {
        onAddLesson({ ...newLesson });
        setIsModalOpen(false);
        setNewLesson({ date: '', title: '', startTime: '', endTime: '', location: '', instructor: '' });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <header className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Lessons</h2>
                <div className="flex gap-3">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                        <button onClick={()=>setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode==='list'?'bg-slate-100 text-slate-800':'text-slate-400'}`}><List size={20}/></button>
                        <button onClick={()=>setViewMode('calendar')} className={`p-2 rounded-md transition-colors ${viewMode==='calendar'?'bg-slate-100 text-slate-800':'text-slate-400'}`}><CalendarDays size={20}/></button>
                    </div>
                    <button onClick={()=>setIsModalOpen(true)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all font-bold text-sm flex items-center">
                        <Plus size={18} className="mr-2" /> 追加
                    </button>
                </div>
            </header>

            {viewMode === 'list' ? (
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <div className="col-span-2">日付</div>
                        <div className="col-span-2">時間</div>
                        <div className="col-span-3">レッスン名</div>
                        <div className="col-span-2">場所</div>
                        <div className="col-span-2">講師</div>
                        <div className="col-span-1 text-right">操作</div>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {lessons.map(l => (
                            <div key={l.id} className="grid grid-cols-12 gap-4 px-8 py-5 items-center hover:bg-slate-50">
                                <div className="col-span-2 font-bold text-slate-700">{l.date}</div>
                                <div className="col-span-2 text-sm text-slate-500">{l.startTime} - {l.endTime}</div>
                                <div className="col-span-3 font-bold text-indigo-600">{l.title}</div>
                                <div className="col-span-2 text-sm text-slate-600">{l.location}</div>
                                <div className="col-span-2 text-sm"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{l.instructor}</span></div>
                                <div className="col-span-1 text-right"><button onClick={()=>onDeleteLesson(l.id)}><Trash2 size={16} className="text-slate-300 hover:text-red-500"/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm text-center py-20">
                     <CalendarDays size={48} className="mx-auto text-slate-200 mb-4"/>
                     <p className="text-slate-400 font-bold">カレンダービューは現在開発中です</p>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="レッスン追加">
                <div className="space-y-4">
                    <InputField label="タイトル" value={newLesson.title} onChange={e=>setNewLesson({...newLesson, title: e.target.value})}/>
                    <InputField label="日付" type="date" value={newLesson.date} onChange={e=>setNewLesson({...newLesson, date: e.target.value})}/>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="開始" type="time" value={newLesson.startTime} onChange={e=>setNewLesson({...newLesson, startTime: e.target.value})}/>
                        <InputField label="終了" type="time" value={newLesson.endTime} onChange={e=>setNewLesson({...newLesson, endTime: e.target.value})}/>
                    </div>
                    <InputField label="場所" value={newLesson.location} onChange={e=>setNewLesson({...newLesson, location: e.target.value})}/>
                    <InputField label="講師" value={newLesson.instructor} onChange={e=>setNewLesson({...newLesson, instructor: e.target.value})}/>
                    <div className="flex justify-end mt-4">
                        <button onClick={handleAdd} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">登録</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// Login
const Login = ({ onLogin, onRegister, initialMode = 'login' }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(initialMode === 'register');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isRegister) await onRegister(email, password);
            else await onLogin(email, password, 'email');
        } catch (err) {
            if (err.code === 'auth/operation-not-allowed') {
                 // コンソール設定が不十分な場合のエラーハンドリング
                 setError('LOGIN_CONFIG_ERROR');
            } else {
                 setError(err.message);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-600">
            <div className="bg-white p-10 rounded-[32px] shadow-xl w-full max-w-md border border-slate-100">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-200">
                        <Award size={32} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-800">TalentPro</h1>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">Management System</p>
                </div>
                
                {error === 'LOGIN_CONFIG_ERROR' ? (
                     <div className="bg-rose-50 p-4 rounded-xl text-xs text-rose-600 font-bold mb-6 border border-rose-100">
                        Firebase設定でEmail/Password認証が有効になっていません。
                        <button onClick={() => onLogin('', '', 'demo')} className="block w-full mt-2 py-2 bg-rose-600 text-white rounded-lg">デモモードで続行</button>
                    </div>
                ) : error && (
                    <div className="bg-rose-50 p-4 rounded-xl text-xs text-rose-600 font-bold mb-6">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <InputField label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
                    <InputField label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
                    <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg">
                        {isRegister ? 'Create Account' : 'Sign In'}
                    </button>
                </form>
                
                <div className="mt-6 text-center space-y-4">
                    <button onClick={()=>setIsRegister(!isRegister)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
                        {isRegister ? '既存アカウントでログイン' : '新規アカウント作成'}
                    </button>
                    <div className="pt-4 border-t border-slate-100">
                        <button onClick={()=>onLogin('','','demo')} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors">
                            デモモードで試す
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Sidebar = ({ activeTab, setActiveTab, onGenerateMock, user, isDemoMode, onLogout }) => {
    const menuItems = [
        { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
        { id: 'sales', label: '売上分析', icon: BarChart3 },
        { id: 'evaluations', label: 'タレント評価', icon: Star },
        { id: 'talents', label: 'タレントDB', icon: Users },
        { id: 'lessons', label: 'レッスン管理', icon: FileText },
    ];
    return (
        <div className="w-72 bg-white h-screen fixed left-0 top-0 flex flex-col justify-between border-r border-slate-100 z-30 shadow-xl shadow-slate-200/50">
            <div>
                <div className="p-8 pb-4">
                     <div className="flex items-center space-x-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Award size={20} /></div>
                        <div><h1 className="text-xl font-bold tracking-tight text-slate-900">TalentPro</h1></div>
                     </div>
                </div>
                <nav className="px-4 space-y-1">
                    {menuItems.map((item) => (
                        <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${activeTab === item.id ? 'bg-slate-50 text-indigo-600 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'}`}>
                            {activeTab === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-r-full"></div>}
                            <item.icon size={20} className={activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
            </div>
            <div className="p-6">
                 <button onClick={onGenerateMock} className="mb-4 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-500 transition-colors flex items-center justify-center">
                    <Database size={14} className="mr-2"/> サンプルデータ投入
                 </button>
                 <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-xl">
                      <div className="flex items-center space-x-3 mb-4">
                          <div className={`w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center ${isDemoMode?'bg-amber-400':'bg-emerald-400'}`}>
                              {isDemoMode ? <CloudOff size={14} className="text-slate-900"/> : <Cloud size={14} className="text-slate-900"/>}
                          </div>
                          <div><p className="text-sm font-bold truncate w-24">{isDemoMode ? 'Demo User' : user?.email}</p></div>
                      </div>
                      <button onClick={onLogout} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold flex items-center justify-center"><LogOut size={14} className="mr-2"/> Sign Out</button>
                 </div>
            </div>
        </div>
    );
};

/**
 * ------------------------------------------------------------------
 * 5. Main App Component
 * ------------------------------------------------------------------
 */

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [talents, setTalents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [events, setEvents] = useState([]);
  const [companySalesData, setCompanySalesData] = useState({ 
      current: Array(12).fill(0), 
      previous: Array(12).fill(0) 
  });

  // Editor/Detail View State
  const [selectedTalent, setSelectedTalent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                try { await signInAnonymously(auth); } catch (e) { console.warn("Anon Auth Disabled"); }
            }
        } catch(e) { console.error("Auth Failed", e); }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
    });
  }, []);

  // Data Sync (Firebase)
  useEffect(() => {
    if (!user || isDemoMode) return;
    
    // サブコレクションリスナー設定
    const unsubTalents = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'talents'), snap => setTalents(snap.docs.map(d=>d.data())));
    const unsubLessons = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lessons'), snap => setLessons(snap.docs.map(d=>d.data())));
    const unsubEvents = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'events'), snap => setEvents(snap.docs.map(d=>d.data())));
    const unsubSales = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'sales', 'company'), snap => {
        if(snap.exists()) setCompanySalesData(snap.data());
    });

    return () => { unsubTalents(); unsubLessons(); unsubEvents(); unsubSales(); };
  }, [user, isDemoMode]);

  // Actions
  const handleLogin = async (email, password, type) => {
      if(type==='demo') {
          setIsDemoMode(true); setUser({uid:'demo'}); 
          // Load Mock Data immediately for demo
          setTalents(generateMockData());
          setLessons(generateMockLessons());
          setEvents(generateMockEvents().concat(generateMockEvents()));
          setCompanySalesData({ 
              current: [1200, 1500, 1300, 1600, 1800, 2000, 1900, 2200, 2400, 2500, 2300, 2600].map(v=>v*1000), 
              previous: [1000, 1200, 1100, 1300, 1400, 1600, 1500, 1700, 1900, 2000, 1800, 2100].map(v=>v*1000) 
          });
          setLoading(false);
          return;
      }
      if(type==='email') await signInWithEmailAndPassword(auth, email, password);
  };
  
  const handleRegister = async (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const handleLogout = async () => { await signOut(auth); setIsDemoMode(false); setUser(null); };

  const saveToFirestore = (col, data, id) => {
      if(!user || isDemoMode) return;
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id), data);
  };
  
  const handleGenerateMock = () => {
      const mocks = generateMockData();
      if(isDemoMode) {
          setTalents(mocks);
          alert("デモデータを投入しました");
      } else {
          const batch = writeBatch(db);
          mocks.forEach(t => batch.set(doc(db, 'artifacts', appId, 'users', user.uid, 'talents', t.id), t));
          batch.commit().then(()=>alert("データを投入しました"));
      }
  };

  // Content Switching
  const renderContent = () => {
      if (isEditing || selectedTalent) {
          return <TalentForm 
              talent={selectedTalent || {}} 
              onSave={(data) => {
                  let newData = data.id ? data : {...data, id: generateId(), status: 'active'};
                  if(isDemoMode) {
                      setTalents(prev => data.id ? prev.map(t=>t.id===data.id?data:t) : [...prev, newData]);
                  } else {
                      saveToFirestore('talents', newData, newData.id);
                  }
                  setIsEditing(false); setSelectedTalent(null);
              }}
              onBack={() => { setIsEditing(false); setSelectedTalent(null); }}
              onDelete={(id) => {
                  if(isDemoMode) setTalents(prev => prev.filter(t=>t.id!==id));
                  else deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'talents', id));
                  setIsEditing(false); setSelectedTalent(null);
              }}
          />;
      }

      switch (activeTab) {
          case 'dashboard': return <DashboardContent talents={talents} companySalesData={companySalesData} events={events} />;
          case 'sales': return <SalesAnalysisContent 
              talents={talents} 
              companySalesData={companySalesData}
              onImportPL={(data) => {
                  if(isDemoMode) setCompanySalesData(prev => ({...prev, current: data}));
                  else saveToFirestore('sales', { ...companySalesData, current: data }, 'company');
                  alert("PLデータを取り込みました");
              }}
              onImportTalentSales={(updates) => {
                  if(isDemoMode) {
                      setTalents(prev => prev.map(t => {
                          const up = updates.find(u => u.name === t.name);
                          return up ? { ...t, ...up } : t;
                      }));
                      // 新規追加ロジックはデモモードでは簡易化(既存マッチのみ)
                  } else {
                      const batch = writeBatch(db);
                      updates.forEach(up => {
                          const t = talents.find(exist => exist.name === up.name);
                          if(t) {
                              batch.update(doc(db, 'artifacts', appId, 'users', user.uid, 'talents', t.id), { sales: up.sales, monthlyAverage: up.monthlyAverage });
                          }
                          // 新規タレント追加ロジックもここに実装可能
                      });
                      batch.commit();
                  }
                  alert(`${updates.length}件のタレント売上を更新しました`);
              }}
          />;
          case 'evaluations': return <TalentEvaluationsContent 
              talents={talents} 
              onUpdateEvaluation={(id, data) => {
                  if(isDemoMode) setTalents(prev => prev.map(t=>t.id===id ? {...t, ...data} : t));
                  else saveToFirestore('talents', { ...talents.find(t=>t.id===id), ...data }, id);
              }}
          />;
          case 'talents': return <TalentListContent 
              talents={talents} 
              onSelect={(t) => { setSelectedTalent(t); setIsEditing(true); }}
              onAddNew={() => { setSelectedTalent({}); setIsEditing(true); }}
          />;
          case 'lessons': return <LessonsContent 
              lessons={lessons}
              onAddLesson={(l) => {
                  const nl = {...l, id: generateId()};
                  if(isDemoMode) setLessons(prev => [...prev, nl]);
                  else saveToFirestore('lessons', nl, nl.id);
              }}
              onDeleteLesson={(id) => {
                  if(isDemoMode) setLessons(prev => prev.filter(l=>l.id!==id));
                  else deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lessons', id));
              }}
          />;
          default: return null;
      }
  };

  if(loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 bg-slate-50">Loading TalentPro...</div>;
  if(!user) return <Login onLogin={handleLogin} onRegister={handleRegister} />;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-600">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onGenerateMock={handleGenerateMock} user={user} isDemoMode={isDemoMode} onLogout={handleLogout} />
        <main className="ml-72 flex-1 p-10 h-screen overflow-y-auto">
            {renderContent()}
        </main>
    </div>
  );
};

export default App;
