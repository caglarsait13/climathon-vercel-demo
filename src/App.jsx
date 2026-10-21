import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip as LeafletTooltip, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { 
  Droplet, TrendingUp, Award, BarChart3, Map as MapIcon, 
  Factory, ArrowRightLeft, Maximize2, X, 
  ChevronRight, ChevronLeft, HelpCircle, Sparkles,
  FastForward, Calendar, ChevronDown, ChevronUp, CheckCircle2, Trees, Zap, Home, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const SECTOR_COLORS = {
  Metal: '#f87171',   
  Kimya: '#34d399',   
  Gıda: '#fbbf24',    
  Tekstil: '#60a5fa'  
};

const createSectorFactoryIcon = (sector, color) => {
  let svgInner = '';
  if (sector === 'Metal') {
    svgInner = '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>';
  } else if (sector === 'Kimya') {
    svgInner = '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path><path d="M8.5 2h7"></path><path d="M7 16h10"></path>';
  } else if (sector === 'Gıda') {
    svgInner = '<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"></path><path d="M15 2v20"></path><path d="M2.5 2v7a5 5 0 0 0 5 5h0a5 5 0 0 0 5-5V2"></path>';
  } else if (sector === 'Tekstil') {
    svgInner = '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path>';
  } else {
    svgInner = '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>';
  }

  return L.divIcon({
    className: 'sector-factory-badge-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
        border: 3.5px solid #ffffff;
        transition: transform 0.2s ease;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${svgInner}
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24]
  });
};

const GEBZE_BOUNDS = [
  [40.720, 29.320],
  [40.910, 29.620]
];

const ONBOARDING_STEPS = [
  {
    stepNumber: 1,
    title: "Günlük KPI Metrikleri ve Kazançlar",
    icon: Droplet, iconColor: "text-blue-500", badge: "ADIM 1 / 3",
    description: "Ekranın üst tarafında süzülen canlı kartlar, Gebze OSB havzasındaki döngüsel su takas borsasının o güne ait performansını ölçer.",
    bullets: [
      { label: "Kurtarılan Su:", text: "O gün doğadan çekilmesi veya şebekeden tüketilmesi engellenen toplam temiz su hacmi (Ton/Gün)." },
      { label: "Maddi Kazanç:", text: "Sanayicilerin o günkü şebeke suyu yerine P2P takas ile elde ettiği net finansal tasarruf." },
      { label: "Yeşil Mutabakat Kredisi:", text: "Günlük olarak kazanılan karbon ayak izi kredisinin euro (€) karşılığıdır." }
    ]
  },
  {
    stepNumber: 2,
    title: "Gün Öncesi Su Borsası (Harita)",
    icon: MapIcon, iconColor: "text-emerald-500", badge: "ADIM 2 / 3",
    description: "Alt taraftaki Takvim modülünden 2027 yılı içindeki herhangi bir günü seçerek sistemin o günkü kararlarını görebilirsiniz.",
    bullets: [
      { label: "Dinamik Takvim:", text: "Simülasyon 1 Ocak - 31 Aralık 2027 arasındaki 360 günlük mevsimsel ve sektörel senaryoları içerir." },
      { label: "Canlı Mavi Borular:", text: "Yapay zekanın o gün için açılmasına onay verdiği ve 50 ton üzerinde su aktarımı olan kârlı vanalardır." },
      { label: "Tesis Etkileşimi:", text: "Logolara tıklayarak fabrikanın o günkü net kazancını detaylı inceleyebilirsiniz." }
    ]
  },
  {
    stepNumber: 3,
    title: "Dashboard ve Analiz",
    icon: BarChart3, iconColor: "text-amber-500", badge: "ADIM 3 / 3",
    description: "Sağ üstteki switch butonu ile tam ekran Dashboard görünümüne geçebilir, seçili günün tesis bazlı dağılımlarını takip edebilirsiniz.",
    bullets: [
      { label: "4 Dinamik Panel:", text: "En çok su kazandıran tesisler, sektörel dağılım, aktif vanalar ve fabrika dizinini içerir." },
      { label: "Çoklu Zaman Dilimi:", text: "Dashboard üzerinden Günlük, Aylık veya Yıllık bazda tüm sonuçları ve grafikleri toplu olarak inceleyebilirsiniz." },
      { label: "Yeniden Açma:", text: "Bu rehbere dilediğiniz zaman üst bardaki '?' butonundan tekrar ulaşabilirsiniz." }
    ]
  }
];

function MapBoundsController() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(GEBZE_BOUNDS);
    map.options.maxBoundsViscosity = 1.0;
  }, [map]);
  return null;
}

export default function App() {
  const [viewMode, setViewMode] = useState('map');
  const [dashboardPeriod, setDashboardPeriod] = useState('daily'); 
  const [nodes, setNodes] = useState([]);
  const [liveEdges, setLiveEdges] = useState([]);
  const [metrics, setMetrics] = useState({ toplam_kurtarilan_su_ton: 0, toplam_tasarruf_tl: 0, karbon_ayak_izi_kredisi_euro: 0 });
  const [allDailyData, setAllDailyData] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const START_DATE = new Date("2027-01-01T00:00:00");
  const formatSimTime = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [simulationTime, setSimulationTime] = useState(START_DATE);
  const [pendingDateStr, setPendingDateStr] = useState(formatSimTime(START_DATE));
  const [isSimulatingLoading, setIsSimulatingLoading] = useState(false);
  const [expandedKpi, setExpandedKpi] = useState(null);
  
  const formatDateForUI = (date) => date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [nodesRes, dailyDataRes] = await Promise.all([
          fetch('/data/nodes.json').then(res => res.json()),
          fetch('/data/daily_data.json').then(res => res.json())
        ]);

        if (!isMounted) return;
        setNodes(nodesRes);
        setAllDailyData(dailyDataRes);
        
        const firstDay = "2027-01-01";
        if(dailyDataRes[firstDay]) {
           setLiveEdges(dailyDataRes[firstDay].edges);
           setMetrics(dailyDataRes[firstDay].metrics);
        }
      } catch (err) {
        console.error("Yerel Veri Yükleme Hatası:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
  }, []);

  const triggerSimulation = (targetDate) => {
    setIsSimulatingLoading(true);
    setTimeout(() => {
      const targetStr = formatSimTime(targetDate);
      if (allDailyData && allDailyData[targetStr]) {
        setLiveEdges(allDailyData[targetStr].edges);
        setMetrics(allDailyData[targetStr].metrics);
      } else {
        setLiveEdges([]);
        setMetrics({ toplam_kurtarilan_su_ton: 0, toplam_tasarruf_tl: 0, karbon_ayak_izi_kredisi_euro: 0 });
      }
      setSimulationTime(targetDate);
      setIsSimulatingLoading(false);
    }, 3000); 
  };

  const handlePendingDateChange = (e) => setPendingDateStr(e.target.value);

  const applyPendingDate = () => {
    const newDate = new Date(pendingDateStr);
    if (!isNaN(newDate)) triggerSimulation(newDate);
  };

  const handleNextDay = () => {
    const nextDay = new Date(simulationTime.getTime());
    nextDay.setDate(nextDay.getDate() + 1);
    if (nextDay.getFullYear() > 2027) return; 
    setPendingDateStr(formatSimTime(nextDay));
    triggerSimulation(nextDay);
  };
  
  const toggleKpi = (kpiName) => setExpandedKpi(prev => prev === kpiName ? null : kpiName);

  const nodeMap = useMemo(() => {
    const map = {};
    nodes.forEach(n => { if (n && n.Fabrika_ID) map[n.Fabrika_ID] = n; });
    return map;
  }, [nodes]);

  const displayEdges = useMemo(() => {
    if (viewMode === 'map' || dashboardPeriod === 'daily') return liveEdges;
    if (!allDailyData) return [];
    
    if (dashboardPeriod === 'monthly') {
      const monthKey = formatSimTime(simulationTime).substring(0, 7);
      return Object.keys(allDailyData)
        .filter(k => k.startsWith(monthKey) && k !== 'aggregates')
        .flatMap(k => allDailyData[k].edges);
    }
    
    if (dashboardPeriod === 'yearly') {
      return Object.keys(allDailyData)
        .filter(k => k !== 'aggregates')
        .flatMap(k => allDailyData[k].edges);
    }
    
    return liveEdges;
  }, [liveEdges, allDailyData, viewMode, dashboardPeriod, simulationTime]);

  const displayMetrics = useMemo(() => {
    if (viewMode === 'map' || dashboardPeriod === 'daily') return metrics;
    if (!allDailyData || !allDailyData.aggregates) return metrics;

    if (dashboardPeriod === 'monthly') {
      const monthKey = formatSimTime(simulationTime).substring(0, 7);
      return allDailyData.aggregates.monthly[monthKey] || metrics;
    }

    if (dashboardPeriod === 'yearly') {
      return allDailyData.aggregates.yearly || metrics;
    }
    
    return metrics;
  }, [metrics, allDailyData, viewMode, dashboardPeriod, simulationTime]);

  const processedEdges = useMemo(() => {
    const map = {};
    displayEdges.forEach(edge => {
      const vId = edge.Veren_Fabrika || edge.Veren_ID;
      const aId = edge.Alan_Fabrika || edge.Alan_ID;
      const key = `${vId}-${aId}`;

      const srcLat = edge.Veren_Enlem || nodeMap[vId]?.Enlem;
      const srcLon = edge.Veren_Boylam || nodeMap[vId]?.Boylam;
      const dstLat = edge.Alan_Enlem || nodeMap[aId]?.Enlem;
      const dstLon = edge.Alan_Boylam || nodeMap[aId]?.Boylam;

      if (srcLat && srcLon && dstLat && dstLon) {
        if (!map[key]) {
          map[key] = {
            ...edge, srcLat, srcLon, dstLat, dstLon, vId, aId,
            Veren_Isim: edge.Veren_Isim || nodeMap[vId]?.Gercek_Isim || vId,
            Alan_Isim: edge.Alan_Isim || nodeMap[aId]?.Gercek_Isim || aId,
            Aktarilan_Su_Ton: 0,
            Kazanilan_Tasarruf_TL: 0,
            Islem_Sayisi: 0
          };
        }
        map[key].Aktarilan_Su_Ton += Number(edge.Aktarilan_Su_Ton || 0);
        map[key].Kazanilan_Tasarruf_TL += Number(edge.Kazanilan_Tasarruf_TL || 0);
        map[key].Islem_Sayisi += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.Aktarilan_Su_Ton - a.Aktarilan_Su_Ton);
  }, [displayEdges, nodeMap]);

  const nodeEdgeSummary = useMemo(() => {
    const summary = {};
    liveEdges.filter(Boolean).forEach(edge => {
        const vId = edge.Veren_Fabrika || edge.Veren_ID;
        const aId = edge.Alan_Fabrika || edge.Alan_ID;
        const ton = Number(edge.Aktarilan_Su_Ton || 0);
        const tasarruf = Number(edge.Kazanilan_Tasarruf_TL || 0);
        
        if (!summary[vId]) summary[vId] = { verenTon: 0, alanTon: 0, tasarrufTl: 0 };
        summary[vId].verenTon += ton;
        
        if (!summary[aId]) summary[aId] = { verenTon: 0, alanTon: 0, tasarrufTl: 0 };
        summary[aId].alanTon += ton;
        summary[aId].tasarrufTl += tasarruf;
    });
    return summary;
  }, [liveEdges]);

  const aggregatedBarData = useMemo(() => {
    const map = {};
    processedEdges.forEach(edge => {
      let rawName = edge.Veren_Isim || 'Bilinmeyen Tesis';
      let factoryId = edge.Veren_Fabrika || edge.Veren_ID || '';
      const cleanKey = rawName.replace(/(A\.Ş\.|Sanayi ve Ticaret Anonim Şirketi|Ticaret|ve Sanayi|A\.S\.|Şti\.|San\.|AŞ|AS)/g, '').trim().toLowerCase();

      if (!map[cleanKey]) {
        const displayName = rawName.replace(/(A\.Ş\.|Sanayi ve Ticaret Anonim Şirketi|Ticaret ve Sanayi|A\.S\.|Şti\.|San\.|AŞ|AS)/g, '').trim();
        const words = displayName.split(' ');
        const shortName = words.length > 2 ? `${words[0]} ${words[1]}...` : (displayName || `Tesis #${factoryId}`);
        map[cleanKey] = { Veren_Isim: displayName || rawName, Display_Name: displayName || rawName, Short_Name: shortName, Total_Ton: 0, Total_Tasarruf: 0, Vana_Sayisi: 0 };
      }
      map[cleanKey].Total_Ton += Number(edge.Aktarilan_Su_Ton || 0);
      map[cleanKey].Total_Tasarruf += Number(edge.Kazanilan_Tasarruf_TL || 0);
      map[cleanKey].Vana_Sayisi += edge.Islem_Sayisi || 1;
    });

    return Object.values(map)
      .map(item => ({ ...item, Total_Ton: Math.round(item.Total_Ton) }))
      .sort((a, b) => b.Total_Ton - a.Total_Ton)
      .slice(0, 8);
  }, [processedEdges]);

  const sectorData = useMemo(() => {
    const counts = { Metal: 0, Kimya: 0, Gıda: 0, Tekstil: 0 };
    nodes.forEach(n => { if (n && n.Sektor && counts[n.Sektor] !== undefined) counts[n.Sektor] += 1; });
    const total = nodes.length || 1;
    return Object.keys(counts).map(sec => ({ name: sec, value: counts[sec], percentage: Math.round((counts[sec] / total) * 100), color: SECTOR_COLORS[sec] }));
  }, [nodes]);

  const getPeriodLabel = () => {
    if (dashboardPeriod === 'daily') return 'Günlük';
    if (dashboardPeriod === 'monthly') return 'Aylık';
    return 'Yıllık';
  };

  const getPeriodTitle = () => {
    if (dashboardPeriod === 'daily') return formatDateForUI(simulationTime);
    if (dashboardPeriod === 'monthly') return simulationTime.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    return "2027 Yılı (Tüm Simülasyon)";
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-white text-slate-800 flex flex-col items-center justify-center">
        <Droplet className="w-16 h-16 text-blue-500 animate-bounce mb-4" />
        <h1 className="text-2xl font-bold tracking-wider text-slate-700">Gebze OSB Dijital İkiz Yükleniyor...</h1>
      </div>
    );
  }

  const currentStep = ONBOARDING_STEPS[onboardingStep] || ONBOARDING_STEPS[0];
  const StepIcon = currentStep.icon;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-white text-slate-800 font-sans select-none flex flex-col">
      
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes akisAnimasyonu {
              from { stroke-dashoffset: 0; }
              to { stroke-dashoffset: -24; }
            }
            .leaflet-overlay-pane path[stroke="#1d4ed8"] {
              animation: akisAnimasyonu 1s linear infinite !important;
            }
          `
        }}
      />

      {/* ONBOARDING REHBERİ */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[4000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-slate-200 rounded-[30px] max-w-4xl w-full p-6 shadow-2xl flex flex-col relative my-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-5 mb-5">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-50 rounded-3xl border-2 border-blue-100 shrink-0"><StepIcon className={`w-12 h-12 ${currentStep.iconColor}`} /></div>
                <div><span className="text-xs font-black tracking-widest text-blue-600 bg-blue-50 border-2 border-blue-200 px-3 py-1.5 rounded-xl">{currentStep.badge}</span><h2 className="text-xl font-black text-slate-900 mt-2 leading-tight tracking-tight">{currentStep.title}</h2></div>
              </div>
              <button onClick={() => setShowOnboarding(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4 mb-6">
              <p className="text-slate-800 text-sm leading-relaxed font-bold bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">{currentStep.description}</p>
              <div className="space-y-3">
                {currentStep.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50/60 rounded-2xl border-2 border-blue-100">
                    <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-900 leading-relaxed"><strong className="text-slate-950 font-black mr-1 text-sm">{bullet.label}</strong>{bullet.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t-2 border-slate-100">
              <div className="flex items-center gap-2">
                {ONBOARDING_STEPS.map((_, idx) => <div key={idx} className={`h-3 rounded-full transition-all duration-300 ${idx === onboardingStep ? 'w-10 bg-blue-500 shadow-md' : 'w-3 bg-slate-200'}`} />)}
              </div>
              <div className="flex items-center gap-3">
                {onboardingStep > 0 && <button onClick={() => setOnboardingStep(prev => prev - 1)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-xs rounded-xl border-2 border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"><ChevronLeft className="w-4 h-4" /> Önceki</button>}
                {onboardingStep < ONBOARDING_STEPS.length - 1 ? <button onClick={() => setOnboardingStep(prev => prev + 1)} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer">Sonraki <ChevronRight className="w-4 h-4" /></button> : <button onClick={() => setShowOnboarding(false)} className="px-7 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/40 transition-all flex items-center gap-2 cursor-pointer">Sistemi Başlat ✨</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-16 md:h-20 bg-white border-b-2 border-slate-200 px-4 md:px-6 flex items-center justify-between shadow-xs z-[2000] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 shrink-0"><Droplet className="w-5 h-5 text-blue-500" /></div>
          <div className="truncate"><h1 className="text-slate-900 font-black text-sm md:text-lg tracking-tight truncate">Gebze OSB Akıllı Atık Su Ağı</h1><p className="text-[11px] md:text-xs text-slate-500 font-bold truncate">P2P Gün Öncesi Su Borsası</p></div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-blue-600 font-extrabold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"><HelpCircle className="w-4 h-4" /> <span className="hidden sm:inline">Nasıl Kullanılır?</span></button>
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-1">
            <button onClick={() => setViewMode('map')} className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${viewMode === 'map' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`} title="Harita"><MapIcon className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('dashboard')} className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${viewMode === 'dashboard' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`} title="Dashboard"><BarChart3 className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {viewMode === 'map' ? (
        <div className="relative w-full flex-1 overflow-hidden bg-slate-50 flex flex-col">
          
          {/* ÜST KPI KARTLARI (Yatay Kaydırılabilir & Telefonda Taşmaz) */}
          <div className="absolute top-2 left-2 right-2 md:top-4 md:left-6 z-[1900] flex gap-3 overflow-x-auto pb-1 pointer-events-auto items-stretch scrollbar-none">
            
            <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-lg flex flex-col min-w-[220px] md:min-w-[280px] cursor-pointer shrink-0" onClick={() => toggleKpi('water')}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 shrink-0"><Droplet className="w-5 h-5 md:w-7 md:h-7 text-blue-500" /></div>
                <div className="flex-1 min-w-0"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Kurtarılan Su</p><p className="text-base md:text-xl font-black text-slate-900 truncate">{metrics.toplam_kurtarilan_su_ton?.toLocaleString()} <span className="text-xs text-blue-600 font-bold">Ton</span></p></div>
                {expandedKpi === 'water' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {expandedKpi === 'water' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                  <Home className="w-4 h-4 text-blue-500 shrink-0" />
                  <p className="text-[11px] font-bold text-slate-700 leading-snug">Gebze'de <strong className="text-blue-600">{Math.round((metrics.toplam_kurtarilan_su_ton || 0) / 0.5).toLocaleString()} hanenin</strong> günlük su ihtiyacı karşılanır.</p>
                </div>
              )}
            </div>

            <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-lg flex flex-col min-w-[220px] md:min-w-[280px] cursor-pointer shrink-0" onClick={() => toggleKpi('money')}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 shrink-0"><TrendingUp className="w-5 h-5 md:w-7 md:h-7 text-emerald-500" /></div>
                <div className="flex-1 min-w-0"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Günlük Kazanç</p><p className="text-base md:text-xl font-black text-slate-900 truncate">₺{metrics.toplam_tasarruf_tl?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p></div>
                {expandedKpi === 'money' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {expandedKpi === 'money' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                  <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-[11px] font-bold text-slate-700 leading-snug">P2P takas ile elde edilen <strong className="text-emerald-600">net günlük finansal tasarruf</strong>.</p>
                </div>
              )}
            </div>

            <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-lg flex flex-col min-w-[220px] md:min-w-[280px] cursor-pointer shrink-0" onClick={() => toggleKpi('carbon')}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 shrink-0"><Award className="w-5 h-5 md:w-7 md:h-7 text-amber-500" /></div>
                <div className="flex-1 min-w-0"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Günlük AB Kredisi</p><p className="text-base md:text-xl font-black text-slate-900 truncate">€{metrics.karbon_ayak_izi_kredisi_euro?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p></div>
                {expandedKpi === 'carbon' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {expandedKpi === 'carbon' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                  <Trees className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[11px] font-bold text-slate-700 leading-snug">Yaklaşık <strong className="text-amber-600">{Math.round((metrics.karbon_ayak_izi_kredisi_euro || 0) * 2.5).toLocaleString()} ağacın</strong> günlük karbon absorpsiyonu.</p>
                </div>
              )}
            </div>
          </div>

          <MapContainer preferCanvas={false} center={[40.812, 29.455]} zoom={13} minZoom={12} maxZoom={16} className="w-full flex-1" zoomControl={false}>
            <MapBoundsController />
            <ZoomControl position="topright" />
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri, HERE, Garmin' />

            {liveEdges.map(edge => {
              const srcNode = nodeMap[edge.Veren_Fabrika || edge.Veren_ID];
              const dstNode = nodeMap[edge.Alan_Fabrika || edge.Alan_ID];
              const srcLat = edge.Veren_Enlem || srcNode?.Enlem;
              const srcLon = edge.Veren_Boylam || srcNode?.Boylam;
              const dstLat = edge.Alan_Enlem || dstNode?.Enlem;
              const dstLon = edge.Alan_Boylam || dstNode?.Boylam;
              if(!srcLat || !dstLat) return null;

              const weight = Math.max(4, Math.min(10, (edge.Aktarilan_Su_Ton || 50) / 15));
              const verenIsim = edge.Veren_Isim || srcNode?.Gercek_Isim;
              const alanIsim = edge.Alan_Isim || dstNode?.Gercek_Isim;

              return (
                <React.Fragment key={`live-${edge.Veren_ID}-${edge.Alan_ID}`}>
                  <Polyline positions={[[srcLat, srcLon], [dstLat, dstLon]]} pathOptions={{ color: '#60a5fa', weight: weight + 8, opacity: 0.2 }}>
                    <LeafletTooltip sticky direction="top">
                      <div className="font-sans text-xs p-1">
                        <p className="font-bold text-slate-900 text-sm mb-1.5 border-b border-slate-100 pb-1.5 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4 text-blue-600" /> Aktif Su Transferi</p>
                        <p className="text-slate-600"><b>Veren:</b> {verenIsim}</p>
                        <p className="text-slate-600"><b>Alan:</b> {alanIsim}</p>
                        <p className="text-blue-600 font-black mt-1.5">Hacim: {Math.round(edge.Aktarilan_Su_Ton)} Ton/Gün</p>
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                  
                  <Polyline
                    positions={[[srcLat, srcLon], [dstLat, dstLon]]}
                    pathOptions={{ color: '#1d4ed8', weight: Math.max(2, weight - 2), dashArray: '12 12', dashOffset: '0', className: 'su-akisi', opacity: 1, interactive: false }}
                  />
                </React.Fragment>
              );
            })}

            {nodes.map((node) => {
              if (!node || !node.Enlem || !node.Boylam) return null;
              const nodeColor = SECTOR_COLORS[node.Sektor] || '#94a3b8';
              const stats = nodeEdgeSummary[node.Fabrika_ID] || { verenTon: 0, alanTon: 0, tasarrufTl: 0 };
              const activeEdge = liveEdges.find(e => (e.Veren_Fabrika || e.Veren_ID) === node.Fabrika_ID || (e.Alan_Fabrika || e.Alan_ID) === node.Fabrika_ID);

              return (
                <Marker key={node.Fabrika_ID} position={[node.Enlem, node.Boylam]} icon={createSectorFactoryIcon(node.Sektor, nodeColor)}>
                  <Popup closeButton={true}>
                    <div className="p-3 w-72 font-sans">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-white" style={{ backgroundColor: nodeColor }}>{node.Sektor}</span>
                        <span className="text-xs font-mono font-bold text-slate-500">#{node.Fabrika_ID}</span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-tight mb-3">{node.Gercek_Isim}</h3>
                      <div className="bg-slate-100 p-2.5 rounded-xl text-xs space-y-1.5 mb-3">
                        <div className="flex justify-between text-slate-600"><span>Konum Bölgesi:</span><span className="font-bold text-slate-800">Gebze OSB Havzası</span></div>
                        <div className="flex justify-between text-slate-600"><span>Sistem Durumu:</span><span className={`font-extrabold ${activeEdge ? 'text-emerald-600' : 'text-slate-500'}`}>{activeEdge ? '● Aktif Transfer Var' : 'Beklemede'}</span></div>
                      </div>
                      {stats.verenTon > 0 && (
                        <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-xs mb-2"><p className="text-blue-800 font-bold">Günlük Verilen Su:</p><p className="text-blue-950 font-black text-base">{stats.verenTon} Ton/Gün</p></div>
                      )}
                      {stats.alanTon > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs space-y-1"><p className="text-emerald-800 font-bold">Günlük Alınan Su:</p><p className="text-emerald-950 font-black text-base">{stats.alanTon} Ton/Gün</p><div className="pt-1.5 border-t border-emerald-200/60 mt-1.5 flex justify-between items-center"><span className="text-emerald-800 font-bold">Finansal Tasarruf:</span><span className="text-emerald-950 font-black text-sm">₺{stats.tasarrufTl.toLocaleString()}</span></div></div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* ALT TARİH / SİMÜLASYON KONTROL PANELİ (Mobilde Tam Oturur) */}
          <div className="relative md:absolute bottom-0 left-0 right-0 md:left-1/2 md:transform md:-translate-x-1/2 md:bottom-4 z-[1000] bg-white/95 backdrop-blur-xl border-t-2 md:border-2 border-slate-200 shadow-xl rounded-t-2xl md:rounded-2xl px-3 py-3 flex flex-col md:flex-row items-center gap-2 md:gap-6 pointer-events-auto shrink-0">
            <div className="flex items-center justify-between w-full md:w-auto gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarih:</span>
              <span className="text-sm font-black text-slate-800">{formatDateForUI(simulationTime)}</span>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <input type="date" min="2027-01-01" max="2027-12-31" value={pendingDateStr} onChange={handlePendingDateChange} onClick={(e) => e.target.showPicker && e.target.showPicker()} disabled={isSimulatingLoading} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-black text-xs md:text-sm border border-slate-200 outline-none hover:bg-slate-200 disabled:opacity-50 transition-all cursor-pointer w-36 text-center select-none" />
              <button onClick={applyPendingDate} disabled={isSimulatingLoading || pendingDateStr === formatSimTime(simulationTime)} className="px-3 py-2 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-1 text-xs cursor-pointer"><CheckCircle2 className="w-4 h-4" /> Git</button>
              <button onClick={handleNextDay} disabled={isSimulatingLoading || formatSimTime(simulationTime) === "2027-12-31"} className="px-3 py-2 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1 text-xs cursor-pointer"><FastForward className="w-4 h-4" /> İleri</button>
            </div>
            {isSimulatingLoading && <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg animate-pulse whitespace-nowrap border border-white flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 animate-spin"/> Hesaplanıyor...</div>}
          </div>
        </div>
      ) : (
        /* DASHBOARD GÖRÜNÜMÜ */
        <div className="flex-1 w-full bg-slate-50 text-slate-800 p-4 md:p-6 overflow-y-auto flex flex-col gap-6 relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-sm gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full md:w-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg">Periyot:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto justify-between">
                <button onClick={() => setDashboardPeriod('daily')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardPeriod === 'daily' ? 'bg-white text-blue-600 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}`}>Günlük</button>
                <button onClick={() => setDashboardPeriod('monthly')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardPeriod === 'monthly' ? 'bg-white text-blue-600 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}`}>Aylık</button>
                <button onClick={() => setDashboardPeriod('yearly')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardPeriod === 'yearly' ? 'bg-white text-blue-600 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}`}>Yıllık</button>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 font-black text-xs rounded-xl border border-blue-200 w-full sm:w-auto justify-center">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate">{getPeriodTitle()}</span>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-[11px] text-emerald-900 font-bold w-full md:w-auto">
              <span>📊 Seçilen döneme ait sonuçlar gösterilmektedir.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-md flex items-center gap-4">
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100 shrink-0"><Droplet className="w-8 h-8 text-blue-500" /></div>
              <div><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{getPeriodLabel()} Su</p><p className="text-xl md:text-2xl font-black text-slate-900 mt-0.5">{Math.round(displayMetrics.toplam_kurtarilan_su_ton || 0).toLocaleString()} <span className="text-xs text-blue-600 font-bold">Ton</span></p></div>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-md flex items-center gap-4">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 shrink-0"><TrendingUp className="w-8 h-8 text-emerald-500" /></div>
              <div><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{getPeriodLabel()} Kazanç</p><p className="text-xl md:text-2xl font-black text-slate-900 mt-0.5">₺{(displayMetrics.toplam_tasarruf_tl || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p></div>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-md flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100 shrink-0"><Award className="w-8 h-8 text-amber-500" /></div>
              <div><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{getPeriodLabel()} Kredi</p><p className="text-xl md:text-2xl font-black text-slate-900 mt-0.5">€{(displayMetrics.karbon_ayak_izi_kredisi_euro || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p></div>
            </div>
          </div>

          {expandedPanel && (
            <div className="fixed inset-0 z-[3000] bg-white/95 backdrop-blur-xl p-4 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100"><Droplet className="w-5 h-5 text-blue-500" /></div>
                  <h2 className="text-base md:text-lg font-extrabold text-slate-800 tracking-wide truncate">
                    {expandedPanel === 'bar' && `En Yüksek Atık Su Kazandıran Tesisler (${getPeriodTitle()})`}
                    {expandedPanel === 'pie' && "Sektörel Dağılım"}
                    {expandedPanel === 'active-table' && `Aktif Vana Transfer Listesi (${getPeriodTitle()})`}
                    {expandedPanel === 'nodes-table' && "Fabrika Dizini"}
                  </h2>
                </div>
                <button onClick={() => setExpandedPanel(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs shadow-xs shrink-0"><X className="w-4 h-4 text-blue-500" /> Kapat</button>
              </div>

              <div className="flex-1 w-full overflow-y-auto">
                {expandedPanel === 'bar' && (
                  <div className="w-full h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregatedBarData}>
                        <XAxis dataKey="Display_Name" stroke="#64748b" fontSize={11} fontWeight="bold" />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight="bold" />
                        <RechartsTooltip content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (<div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl text-slate-800"><p className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1 mb-1">{data.Veren_Isim}</p><p className="text-blue-600 font-extrabold text-xs">Toplam Su: {data.Total_Ton.toLocaleString()} Ton</p></div>);
                            }
                            return null;
                          }} />
                        <Bar dataKey="Total_Ton" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {expandedPanel === 'pie' && (
                  <div className="w-full h-[500px] flex flex-col md:flex-row items-center justify-center gap-6">
                    <div className="w-full md:w-1/2 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={sectorData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name}: %${(percent * 100).toFixed(0)}`}>
                            {sectorData.map((sec, idx) => <Cell key={idx} fill={sec.color} />)}
                          </Pie>
                          <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/3 space-y-2.5">
                      {sectorData.map((sec, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center gap-2.5"><div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: sec.color }} /><span className="font-extrabold text-slate-800">{sec.name}</span></div>
                          <span className="font-black text-slate-900">{sec.value} Tesis (%{sec.percentage})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedPanel === 'active-table' && (
                  <div className="w-full h-full overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm">
                      <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 font-extrabold border-b border-slate-200">
                        <tr><th className="p-3">Veren Tesis</th><th className="p-3">Alan Tesis</th><th className="p-3">Hacim</th><th className="p-3">Tasarruf</th><th className="p-3">İşlem</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {processedEdges.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{e.Veren_Isim}</td>
                            <td className="p-3 text-slate-700">{e.Alan_Isim}</td>
                            <td className="p-3 text-blue-600 font-black">{Math.round(e.Aktarilan_Su_Ton || 0).toLocaleString()} Ton</td>
                            <td className="p-3 text-emerald-600 font-black">₺{(e.Kazanilan_Tasarruf_TL || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                            <td className="p-3 text-slate-500">{e.Islem_Sayisi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {expandedPanel === 'nodes-table' && (
                  <div className="w-full h-full overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm">
                      <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 font-extrabold border-b border-slate-200">
                        <tr><th className="p-3">Tesis Adı</th><th className="p-3">Sektör</th><th className="p-3">ID</th><th className="p-3">Konum</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {nodes.map((n) => (
                          <tr key={n.Fabrika_ID} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{n.Gercek_Isim}</td>
                            <td className="p-3"><span className="px-2.5 py-1 rounded-md text-[10px] font-black text-white uppercase" style={{ backgroundColor: SECTOR_COLORS[n.Sektor] }}>{n.Sektor}</span></td>
                            <td className="p-3 text-slate-500 font-mono">#{n.Fabrika_ID}</td>
                            <td className="p-3 text-slate-600 font-mono text-xs">{n.Enlem}, {n.Boylam}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs md:text-sm font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 truncate"><BarChart3 className="w-4 h-4 text-blue-500 shrink-0" /> <span className="truncate">En Çok Su Kazandıran Tesisler</span></h3>
                <button onClick={() => setExpandedPanel('bar')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer shrink-0"><Maximize2 className="w-3.5 h-3.5 text-blue-500" /></button>
              </div>
              <div className="w-full h-[240px]">
                {aggregatedBarData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 font-bold text-xs">Veri bulunmuyor.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedBarData}>
                      <XAxis dataKey="Short_Name" stroke="#64748b" fontSize={9} fontWeight="bold" interval={0} angle={-15} textAnchor="end" height={35} />
                      <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <RechartsTooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (<div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg text-slate-800"><p className="font-bold text-slate-900 text-xs mb-1">{data.Veren_Isim}</p><p className="text-blue-600 font-extrabold text-xs">Toplam Su: {data.Total_Ton.toLocaleString()} Ton</p></div>);
                          }
                          return null;
                        }} />
                      <Bar dataKey="Total_Ton" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs md:text-sm font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 truncate"><Factory className="w-4 h-4 text-emerald-500 shrink-0" /> <span className="truncate">Sektörel Dağılım</span></h3>
                <button onClick={() => setExpandedPanel('pie')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer shrink-0"><Maximize2 className="w-3.5 h-3.5 text-emerald-500" /></button>
              </div>
              <div className="w-full h-[210px] flex items-center justify-between gap-3">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sectorData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                        {sectorData.map((sec, idx) => <Cell key={idx} fill={sec.color} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-1.5">
                  {sectorData.map((sec, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} /><span className="font-bold text-slate-700 truncate">{sec.name}</span></div>
                      <span className="font-extrabold text-slate-900">{sec.value} Tesis</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs md:text-sm font-extrabold text-slate-700 uppercase tracking-wider truncate">🔄 Sistem Transferleri</h3>
                <button onClick={() => setExpandedPanel('active-table')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer shrink-0"><Maximize2 className="w-3.5 h-3.5 text-blue-500" /></button>
              </div>
              <div className="overflow-y-auto max-h-[220px] rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] sticky top-0 font-extrabold">
                    <tr><th className="p-2.5">Veren</th><th className="p-2.5">Alan</th><th className="p-2.5">Hacim</th><th className="p-2.5">Tasarruf</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedEdges.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-800">{e.Veren_Isim}</td>
                        <td className="p-2.5 text-slate-600">{e.Alan_Isim}</td>
                        <td className="p-2.5 text-blue-600 font-black">{Math.round(e.Aktarilan_Su_Ton || 0).toLocaleString()} Ton</td>
                        <td className="p-2.5 text-emerald-600 font-black">₺{(e.Kazanilan_Tasarruf_TL || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs md:text-sm font-extrabold text-slate-700 uppercase tracking-wider truncate">🏭 Fabrika Dizini</h3>
                <button onClick={() => setExpandedPanel('nodes-table')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer shrink-0"><Maximize2 className="w-3.5 h-3.5 text-amber-500" /></button>
              </div>
              <div className="overflow-y-auto max-h-[220px] rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] sticky top-0 font-extrabold">
                    <tr><th className="p-2.5">Tesis Adı</th><th className="p-2.5">Sektör</th><th className="p-2.5">ID</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nodes.map((n) => (
                      <tr key={n.Fabrika_ID} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-800">{n.Gercek_Isim}</td>
                        <td className="p-2.5"><span className="px-2 py-0.5 rounded text-[9px] font-black text-white uppercase" style={{ backgroundColor: SECTOR_COLORS[n.Sektor] }}>{n.Sektor}</span></td>
                        <td className="p-2.5 text-slate-500 font-mono">#{n.Fabrika_ID}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}