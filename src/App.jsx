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
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2.5px solid #ffffff;
        transition: transform 0.2s ease;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${svgInner}
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
};

const GEBZE_BOUNDS = [
  [40.720, 29.320],
  [40.910, 29.620]
];

const ONBOARDING_STEPS = [
  {
    stepNumber: 0,
    isWelcome: true,
    title: "W3Flow - Waste Water Web Flow",
    slogan: "We flow through the roots",
    icon: Sparkles, iconColor: "text-blue-600", badge: "HOŞ GELDİNİZ",
    description: "Gebze OSB sanayi havzasında sanayiciler arası merkeziyetsiz atık su takasını yöneten ve döngüsel su ekonomisini yönlendiren dijital ikiz platformuna hoş geldiniz.",
    bullets: [
      { label: "P2P Su Takası:", text: "Sanayi tesisleri arasında atık suyun doğrudan, güvenli ve verimli transferini sağlar." },
      { label: "Çevresel & Finansal Kazanım:", text: "Doğadan temiz su çekimini azaltır, arıtma süreçlerindeki karbon emisyonlarını düşürür ve sanayicilere net maliyet avantajı sunar." },
      { label: "Yapay Zeka Optimizasyonu:", text: "Gün öncesi makine öğrenmesi ile en kârlı ve sürdürülebilir vanaları açarak fabrikaları dinamik olarak eşleştirir." }
    ]
  },
  {
    stepNumber: 1,
    title: "Günlük KPI Metrikleri ve Kazançlar",
    icon: Droplet, iconColor: "text-blue-500", badge: "ADIM 1 / 3",
    description: "Ekranın üst tarafında süzülen canlı kartlar, Gebze OSB havzasındaki döngüsel su takas borsasının o güne ait performansını ölçer.",
    bullets: [
      { label: "Kurtarılan Su:", text: "O gün doğadan çekilmesi veya şebekeden tüketilmesi engellenen toplam temiz su hacmi (Ton/Gün)." },
      { label: "Maddi Kazanç:", text: "Sanayicilerin o günkü şebeke suyu yerine takas ile elde ettiği net finansal tasarruf." },
      { label: "Yeşil Mutabakat Kredisi:", text: "Günlük olarak kazanılan karbon ayak izi kredisinin euro (€) karşılığıdır." }
    ]
  },
  {
    stepNumber: 2,
    title: "Gün Öncesi Su Borsası (Harita)",
    icon: MapIcon, iconColor: "text-emerald-500", badge: "ADIM 2 / 3",
    description: "Alt taraftaki Takvim modülünden 2027 yılı içindeki herhangi bir günü seçerek sistemin o günkü kararlarını görebilirsiniz.",
    bullets: [
      { label: "Dinamik Takvim:", text: "Veriseti 1 Ocak - 31 Aralık 2027 arasındaki 1 yıllık mevsimsel ve sektörel senaryoları içerir." },
      { label: "Canlı Mavi Borular:", text: "Yapay zekanın o gün için açılmasına onay verdiği ve 50 ton üzerinde su aktarımı olan kârlı vanaları haritayı büyüterek görebilirsiniz." },
      { label: "Tesis Etkileşimi:", text: "Logolara tıklayarak fabrikanın o günkü net kazancını ve su aktarım miktarlarını detaylı inceleyebilirsiniz." }
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

  // Arayüz bileşenlerinin boyut küçültme durumları (Minimization States)
  const [isKpisMinimized, setIsKpisMinimized] = useState(false);
  const [isControlsMinimized, setIsControlsMinimized] = useState(false);

  // Halka Grafik İçin Aktif Sektör Durumu
  const [activeSector, setActiveSector] = useState(null);

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
    return "2027 Yılı (Tüm Yıl Analizi)";
  };

  if (loading) {
    return (
      <div className="h-dvh w-full bg-white text-slate-800 flex flex-col items-center justify-center">
        <Droplet className="w-16 h-16 text-blue-500 animate-bounce mb-4" />
        <h1 className="text-2xl font-bold tracking-wider text-slate-700">Gebze OSB Dijital İkiz Yükleniyor...</h1>
      </div>
    );
  }

  const currentStep = ONBOARDING_STEPS[onboardingStep] || ONBOARDING_STEPS[0];
  const StepIcon = currentStep.icon;

  return (
    <div className="h-dvh w-full relative overflow-hidden bg-white text-slate-800 font-sans select-none flex flex-col">
      
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

      {/* ONBOARDING REHBERİ VE KARŞILAMA EKRANI */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[4000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-4xl w-full max-h-full overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-300">
            {/* Başlık alanı */}
            <div className="shrink-0 flex items-center justify-between border-b-2 border-slate-100 px-6 py-5 xl:px-10 xl:py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-2xl border-2 border-blue-100 shrink-0"><StepIcon className={`w-10 h-10 ${currentStep.iconColor}`} /></div>
                <div className="min-w-0">
                  <span className="text-xs font-black tracking-widest text-blue-600 bg-blue-50 border-2 border-blue-200 px-3 py-1.5 rounded-lg">{currentStep.badge}</span>
                  <h2 className="text-xl xl:text-2xl font-black text-slate-900 mt-2 leading-tight tracking-tight">{currentStep.title}</h2>
                  {currentStep.slogan && (
                    <p className="text-sm xl:text-base font-black italic text-blue-600 tracking-wide mt-1">
                      "{currentStep.slogan}"
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowOnboarding(false)} className="text-slate-400 hover:text-slate-900 p-2.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0"><X className="w-7 h-7" /></button>
            </div>

            {/* İçerik metinleri */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 xl:px-10 xl:py-6 space-y-4">
              <p className="text-slate-800 text-base xl:text-lg leading-relaxed font-bold bg-slate-50 p-5 rounded-2xl border-2 border-slate-200">{currentStep.description}</p>
              <div className="space-y-3">
                {currentStep.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 xl:p-5 bg-blue-50/60 rounded-2xl border-2 border-blue-100">
                    <Sparkles className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm xl:text-base text-slate-900 leading-relaxed"><strong className="text-slate-950 font-black mr-1.5 text-base xl:text-lg">{bullet.label}</strong>{bullet.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alt Gezinme Barı */}
            <div className="shrink-0 flex items-center justify-between border-t-2 border-slate-100 px-6 py-4 xl:px-10 xl:py-5">
              <div className="flex items-center gap-2.5">
                {ONBOARDING_STEPS.map((_, idx) => <div key={idx} className={`h-3 rounded-full transition-all duration-300 ${idx === onboardingStep ? 'w-10 bg-blue-500 shadow-lg shadow-blue-500/40' : 'w-3 bg-slate-200'}`} />)}
              </div>
              <div className="flex items-center gap-3">
                {onboardingStep > 0 && <button onClick={() => setOnboardingStep(prev => prev - 1)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-base rounded-xl border-2 border-slate-200 transition-all flex items-center gap-2 cursor-pointer"><ChevronLeft className="w-5 h-5" /> Önceki</button>}
                {onboardingStep < ONBOARDING_STEPS.length - 1 ? (
                  <button onClick={() => setOnboardingStep(prev => prev + 1)} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black text-base rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer">
                    {onboardingStep === 0 ? 'Rehberi Başlat' : 'Sonraki'} <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button onClick={() => setShowOnboarding(false)} className="px-7 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-base rounded-xl shadow-lg shadow-emerald-500/40 transition-all flex items-center gap-2 cursor-pointer">
                    Sistemi Başlat ✨
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-28 bg-white border-b-2 border-slate-200 px-10 flex items-center justify-between shadow-xs z-[2000] shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100"><Droplet className="w-9 h-9 text-blue-500" /></div>
          <div>
            <h1 className="text-slate-900 font-black text-2xl tracking-tight">W3Flow</h1>
            <p className="text-base text-slate-500 font-bold mt-0.5">Gebze OSB Merkeziyetsiz Akıllı Atık Su Takas Ağı</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <button onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }} className="flex items-center gap-2.5 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-blue-600 font-extrabold text-base rounded-2xl border-2 border-slate-200 transition-all cursor-pointer shadow-xs"><HelpCircle className="w-6 h-6" /> Nasıl Kullanılır?</button>
          <div className="bg-slate-100 p-2 rounded-2xl border-2 border-slate-200 flex gap-2">
            <button onClick={() => setViewMode('map')} className={`p-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${viewMode === 'map' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 scale-105' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'}`} title="Harita Görünümü"><MapIcon className="w-7 h-7" /></button>
            <button onClick={() => setViewMode('dashboard')} className={`p-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${viewMode === 'dashboard' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 scale-105' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'}`} title="Dashboard Görünümü"><BarChart3 className="w-7 h-7" /></button>
          </div>
        </div>
      </header>

      {viewMode === 'map' ? (
        <div className="relative w-full flex-1 overflow-hidden bg-slate-50">
          
          {/* KPI KARTLARI - DARALTILABİLİR ALAN */}
          {isKpisMinimized ? (
            <div className="absolute top-6 left-8 z-[1900] pointer-events-auto">
              <button 
                onClick={() => setIsKpisMinimized(false)}
                className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-3xl border border-slate-200 shadow-xl flex items-center gap-6 cursor-pointer hover:shadow-2xl transition-all group"
                title="Metrik Kartlarını Genişlet"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                    <Droplet className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-extrabold text-slate-800 text-sm">{metrics.toplam_kurtarilan_su_ton?.toLocaleString()} Ton</span>
                </div>
                <div className="h-5 w-px bg-slate-200"></div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="font-extrabold text-slate-800 text-sm">₺{metrics.toplam_tasarruf_tl?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="h-5 w-px bg-slate-200"></div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                    <Award className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="font-extrabold text-slate-800 text-sm">€{metrics.karbon_ayak_izi_kredisi_euro?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="ml-2 pl-4 border-l border-slate-200 text-blue-600 group-hover:text-blue-700 flex items-center gap-1 text-xs font-black">
                  <span>Genişlet</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>
            </div>
          ) : (
            <div className="absolute top-6 left-8 z-[1900] flex gap-3 pointer-events-auto items-start">
              <div className="flex gap-6 items-start">
                <div className="bg-white/95 backdrop-blur-md px-8 py-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col min-w-[22.5rem] cursor-pointer hover:shadow-2xl transition-all" onClick={() => toggleKpi('water')}>
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 shrink-0"><Droplet className="w-12 h-12 text-blue-500" /></div>
                    <div className="flex-1"><p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Günlük Kurtarılan Su</p><p className="text-3xl font-black text-slate-900 mt-1">{metrics.toplam_kurtarilan_su_ton?.toLocaleString()} <span className="text-base text-blue-600 font-extrabold">Ton</span></p></div>
                    {expandedKpi === 'water' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                  {expandedKpi === 'water' && (
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3.5 animate-in slide-in-from-top-2">
                      <Home className="w-7 h-7 text-blue-500 shrink-0" />
                      <p className="text-sm font-bold text-slate-700 leading-snug">Bugün kurtarılan bu su, Gebze'de <strong className="text-blue-600 font-black text-base">{Math.round((metrics.toplam_kurtarilan_su_ton || 0) / 0.5).toLocaleString()} hanenin günlük</strong> su ihtiyacını karşılar.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white/95 backdrop-blur-md px-8 py-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col min-w-[22.5rem] cursor-pointer hover:shadow-2xl transition-all" onClick={() => toggleKpi('money')}>
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shrink-0"><TrendingUp className="w-12 h-12 text-emerald-500" /></div>
                    <div className="flex-1"><p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Günlük Kazanç</p><p className="text-3xl font-black text-slate-900 mt-1">₺{metrics.toplam_tasarruf_tl?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p></div>
                    {expandedKpi === 'money' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                  {expandedKpi === 'money' && (
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3.5 animate-in slide-in-from-top-2">
                      <Zap className="w-7 h-7 text-emerald-500 shrink-0" />
                      <p className="text-sm font-bold text-slate-700 leading-snug">Bu tutar, sanayicilerin bugün şebeke suyu yerine P2P takas ile elde ettiği <strong className="text-emerald-600 font-black text-base">net günlük finansal tasarruftur</strong>.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white/95 backdrop-blur-md px-8 py-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col min-w-[22.5rem] cursor-pointer hover:shadow-2xl transition-all" onClick={() => toggleKpi('carbon')}>
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 shrink-0"><Award className="w-12 h-12 text-amber-500" /></div>
                    <div className="flex-1"><p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Günlük AB Kredisi</p><p className="text-3xl font-black text-slate-900 mt-1">€{metrics.karbon_ayak_izi_kredisi_euro?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p></div>
                    {expandedKpi === 'carbon' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                  {expandedKpi === 'carbon' && (
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3.5 animate-in slide-in-from-top-2">
                      <Trees className="w-7 h-7 text-amber-500 shrink-0" />
                      <p className="text-sm font-bold text-slate-700 leading-snug">Bugünkü emisyon indirimi, yaklaşık <strong className="text-amber-600 font-black text-base">{Math.round((metrics.karbon_ayak_izi_kredisi_euro || 0) * 2.5).toLocaleString()} yetişkin ağacın günlük</strong> karbon absorpsiyonuna bedeldir.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Daraltma Butonu */}
              <button 
                onClick={() => setIsKpisMinimized(true)}
                className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="KPI Kartlarını Küçült"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>
          )}

          <MapContainer preferCanvas={false} center={[40.812, 29.455]} zoom={13} minZoom={12} maxZoom={16} className="w-full h-full" zoomControl={false}>
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
                  <Polyline 
                    positions={[[srcLat, srcLon], [dstLat, dstLon]]} 
                    pathOptions={{ color: '#60a5fa', weight: weight + 8, opacity: 0.2 }} 
                  >
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
                    positions={[
                      [srcLat, srcLon],
                      [dstLat, dstLon]
                    ]}
                    pathOptions={{
                      color: '#1d4ed8',
                      weight: Math.max(2, weight - 2),
                      dashArray: '12 12',
                      dashOffset: '0',
                      className: 'su-akisi',
                      opacity: 1,
                      interactive: false
                    }}
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

          {/* ALT TARIH SEÇİCİ KONTROL ÇUBUĞU - DARALTILABİLİR ALAN */}
          {isControlsMinimized ? (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000] pointer-events-auto">
              <button 
                onClick={() => setIsControlsMinimized(false)}
                className="bg-white/95 backdrop-blur-xl border-2 border-slate-200 shadow-2xl rounded-full px-7 py-3.5 flex items-center gap-5 cursor-pointer hover:bg-slate-50 transition-all group"
                title="Tarih Kontrollerini Genişlet"
              >
                <div className="p-2 bg-blue-50 rounded-full border border-blue-100">
                  <Calendar className="text-blue-600 w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Analiz Tarihi</span>
                  <span className="text-base font-black text-slate-800 tracking-wide mt-0.5">{formatDateForUI(simulationTime)}</span>
                </div>
                <div className="ml-3 pl-4 border-l border-slate-200 text-blue-600 group-hover:text-blue-700 flex items-center gap-1.5 text-xs font-black">
                  <span>Kontrolleri Göster</span>
                  <ChevronUp className="w-4 h-4" />
                </div>
              </button>
            </div>
          ) : (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-xl border-2 border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2rem] px-9 py-5 flex items-center gap-10 pointer-events-auto transition-all">
                <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100"><Calendar className="text-blue-600 w-8 h-8" /></div>
                <div className="flex flex-col"><span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Analiz Tarihi</span><span className="text-2xl font-black text-slate-800 tracking-wide">{formatDateForUI(simulationTime)}</span></div>
              </div>
              <div className="h-14 w-px bg-slate-300"></div>
              <div className="flex items-center gap-4">
                <input type="date" min="2027-01-01" max="2027-12-31" value={pendingDateStr} onChange={handlePendingDateChange} onClick={(e) => e.target.showPicker && e.target.showPicker()} disabled={isSimulatingLoading} className="px-5 py-4 rounded-2xl bg-slate-100 text-slate-700 font-black text-xl border-2 border-slate-200 outline-none hover:bg-slate-200 disabled:opacity-50 transition-all cursor-pointer w-52 select-none text-center [color-scheme:light]" title="Tarih Seçmek İçin Tıklayın" />
                <button onClick={applyPendingDate} disabled={isSimulatingLoading || pendingDateStr === formatSimTime(simulationTime)} className="px-8 py-4 rounded-2xl bg-emerald-500 text-white font-black hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center gap-2.5 text-lg cursor-pointer"><CheckCircle2 className="w-6 h-6" /> Tarihe Git</button>
                <button onClick={handleNextDay} disabled={isSimulatingLoading || formatSimTime(simulationTime) === "2027-12-31"} className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-xl shadow-blue-600/30 disabled:opacity-50 transition-all flex items-center gap-2.5 text-lg cursor-pointer ml-4"><FastForward className="w-6 h-6" /> Gün Atla</button>
                <button onClick={() => setIsControlsMinimized(true)} className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-2xl transition-all cursor-pointer border border-slate-200 ml-2" title="Kontrol Çubuğunu Küçült">
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>
              {isSimulatingLoading && <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-sm font-black px-6 py-2.5 rounded-full shadow-xl shadow-blue-600/40 animate-pulse whitespace-nowrap border-2 border-white flex items-center gap-2"><Clock className="w-4 h-4 animate-spin"/> Yapay Zeka Ağ Optimizasyonunu Hesaplıyor...</div>}
            </div>
          )}
        </div>
      ) : (
        /* DASHBOARD GÖRÜNÜMÜ */
        <div className="flex-1 w-full bg-slate-50 text-slate-800 p-8 overflow-y-auto flex flex-col gap-8 relative">
          <div className="flex items-center justify-between bg-white border border-slate-200 p-5 rounded-3xl shadow-sm gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3.5 py-2 rounded-xl">Analiz Periyodu:</span>
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button 
                  onClick={() => setDashboardPeriod('daily')} 
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dashboardPeriod === 'daily' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}`}
                >
                  Günlük
                </button>
                <button 
                  onClick={() => setDashboardPeriod('monthly')} 
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dashboardPeriod === 'monthly' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}`}
                >
                  Aylık
                </button>
                <button 
                  onClick={() => setDashboardPeriod('yearly')} 
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dashboardPeriod === 'yearly' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}`}
                >
                  Yıllık
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 font-black text-base rounded-2xl border border-blue-200 shadow-xs ml-2">
                <Calendar className="w-5 h-5" />
                <span>{getPeriodTitle()}</span>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
              <span>📊</span>
              <span><strong>Durum:</strong> Seçilen zaman dilimine ait analiz sonuçları tüm bileşenlerde gösterilmektedir.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 shrink-0">
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg flex items-center gap-6">
              <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 shrink-0"><Droplet className="w-12 h-12 text-blue-500" /></div>
              <div><p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{getPeriodLabel()} Kurtarılan Su</p><p className="text-4xl font-black text-slate-900 mt-1">{Math.round(displayMetrics.toplam_kurtarilan_su_ton || 0).toLocaleString()} <span className="text-lg text-blue-600 font-extrabold">Ton</span></p></div>
            </div>
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg flex items-center gap-6">
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 shrink-0"><TrendingUp className="w-12 h-12 text-emerald-500" /></div>
              <div><p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{getPeriodLabel()} Kazanç</p><p className="text-4xl font-black text-slate-900 mt-1">₺{(displayMetrics.toplam_tasarruf_tl || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            </div>
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg flex items-center gap-6">
              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 shrink-0"><Award className="w-12 h-12 text-amber-500" /></div>
              <div><p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{getPeriodLabel()} AB Kredisi</p><p className="text-4xl font-black text-slate-900 mt-1">€{(displayMetrics.karbon_ayak_izi_kredisi_euro || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            </div>
          </div>

          {expandedPanel && (
            <div className="fixed inset-0 z-[3000] bg-white/95 backdrop-blur-xl p-8 flex flex-col">
              <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100"><Droplet className="w-6 h-6 text-blue-500" /></div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-wide">
                    {expandedPanel === 'bar' && `En Yüksek Atık Su Geri Kazandıran Tesisler (${getPeriodTitle()})`}
                    {expandedPanel === 'pie' && "Havzadaki Fabrikaların Sektörel Dağılımı"}
                    {expandedPanel === 'active-table' && `Aktif Vana Transfer Listesi (${getPeriodTitle()})`}
                    {expandedPanel === 'nodes-table' && "Tüm Havza Fabrika Dizini"}
                  </h2>
                </div>
                <button onClick={() => setExpandedPanel(null)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer font-bold text-sm shadow-sm"><X className="w-5 h-5 text-blue-500" /> Kapat</button>
              </div>

              <div className="flex-1 w-full overflow-y-auto">
                {expandedPanel === 'bar' && (
                  <div className="w-full h-[40rem]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregatedBarData}>
                        <XAxis dataKey="Display_Name" stroke="#64748b" fontSize={14} fontWeight="bold" />
                        <YAxis stroke="#64748b" fontSize={14} fontWeight="bold" />
                        <RechartsTooltip content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (<div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xl text-slate-800"><p className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2 mb-2">{data.Veren_Isim}</p><p className="text-blue-600 font-extrabold text-sm">Toplam Verilen Su: {data.Total_Ton.toLocaleString()} Ton</p><p className="text-slate-500 font-medium text-xs mt-1">Sistem Aktivasyonu: {data.Vana_Sayisi} İşlem</p></div>);
                            }
                            return null;
                          }} />
                        <Bar dataKey="Total_Ton" fill="#60a5fa" radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {expandedPanel === 'pie' && (
                  <div className="w-full h-[40rem] flex items-center justify-center gap-12">
                    <div className="w-1/2 h-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={sectorData} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius="60%" 
                            outerRadius="82%" 
                            paddingAngle={4} 
                            dataKey="value"
                            onMouseEnter={(_, index) => setActiveSector(sectorData[index])}
                            onMouseLeave={() => setActiveSector(null)}
                          >
                            {sectorData.map((sec, idx) => <Cell key={idx} fill={sec.color} className="cursor-pointer outline-none" />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Genişletilmiş Modal Halka Grafiğin Merkezindeki Dinamik Metin Katmanı */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {activeSector ? (
                          <div className="text-center animate-in fade-in zoom-in-95 duration-150">
                            <p className="text-4xl font-black text-slate-900 leading-none">{activeSector.value} Tesis</p>
                            <p className="text-sm font-black uppercase tracking-wider mt-2" style={{ color: activeSector.color }}>
                              {activeSector.name} Sektörü (%{activeSector.percentage})
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-4xl font-black text-slate-800 leading-none">{nodes.length}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Toplam Tesis</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-1/3 space-y-4">
                      {sectorData.map((sec, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
                          <div className="flex items-center gap-3.5"><div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} /><span className="text-base font-extrabold text-slate-800">{sec.name} Sektörü</span></div>
                          <span className="text-base font-black text-slate-900">{sec.value} Tesis (%{sec.percentage})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedPanel === 'active-table' && (
                  <div className="w-full h-full">
                    <table className="w-full text-left text-base">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 font-extrabold border-b border-slate-200">
                        <tr><th className="p-5">Veren Tesis</th><th className="p-5">Alan Tesis</th><th className="p-5">Aktarılan Toplam Hacim</th><th className="p-5">Finansal Tasarruf</th><th className="p-5">İşlem Sayısı</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {processedEdges.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 font-bold text-slate-900">{e.Veren_Isim}</td>
                            <td className="p-5 text-slate-700 font-semibold">{e.Alan_Isim}</td>
                            <td className="p-5 text-blue-600 font-black">{Math.round(e.Aktarilan_Su_Ton || 0).toLocaleString()} Ton</td>
                            <td className="p-5 text-emerald-600 font-black">₺{(e.Kazanilan_Tasarruf_TL || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                            <td className="p-5 text-slate-500 font-bold">{e.Islem_Sayisi} İşlem</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {expandedPanel === 'nodes-table' && (
                  <div className="w-full h-full">
                    <table className="w-full text-left text-base">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 font-extrabold border-b border-slate-200">
                        <tr><th className="p-5">Tesis Adı</th><th className="p-5">Sektör</th><th className="p-5">Sistem ID</th><th className="p-5">Konum (Enlem / Boylam)</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {nodes.map((n) => (
                          <tr key={n.Fabrika_ID} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 font-bold text-slate-900">{n.Gercek_Isim}</td>
                            <td className="p-5"><span className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white shadow-xs tracking-wider uppercase" style={{ backgroundColor: SECTOR_COLORS[n.Sektor] }}>{n.Sektor}</span></td>
                            <td className="p-5 text-slate-500 font-mono font-bold">#{n.Fabrika_ID}</td>
                            <td className="p-5 text-slate-600 font-mono text-sm">{n.Enlem}, {n.Boylam}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-[40rem]">
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3"><BarChart3 className="w-6 h-6 text-blue-500" /> En Çok Su Kazandıran Tesisler ({getPeriodTitle()})</h3>
                <button onClick={() => setExpandedPanel('bar')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"><Maximize2 className="w-4 h-4 text-blue-500" /></button>
              </div>
              <div className="flex-1 w-full min-h-[17.5rem]">
                {aggregatedBarData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 font-bold">Bu zaman dilimi için henüz transfer verisi bulunmuyor.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedBarData}>
                      <XAxis dataKey="Short_Name" stroke="#64748b" fontSize={11} fontWeight="bold" interval={0} angle={-15} textAnchor="end" height={45} />
                      <YAxis stroke="#64748b" fontSize={12} fontWeight="bold" />
                      <RechartsTooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (<div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xl text-slate-800"><p className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1.5 mb-1.5">{data.Veren_Isim}</p><p className="text-blue-600 font-extrabold text-xs">Toplam Verilen Su: {data.Total_Ton.toLocaleString()} Ton</p><p className="text-slate-500 font-medium text-xs mt-1">İşlem: {data.Vana_Sayisi}</p></div>);
                          }
                          return null;
                        }} />
                      <Bar dataKey="Total_Ton" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3"><Factory className="w-6 h-6 text-emerald-500" /> Fabrikaların Sektörel Dağılımı</h3>
                <button onClick={() => setExpandedPanel('pie')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"><Maximize2 className="w-4 h-4 text-emerald-500" /></button>
              </div>
              <div className="flex-1 w-full min-h-[18rem] flex items-center justify-between gap-4">
                <div className="w-1/2 h-[17rem] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={sectorData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius="62%" 
                        outerRadius="95%" 
                        paddingAngle={4} 
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveSector(sectorData[index])}
                        onMouseLeave={() => setActiveSector(null)}
                      >
                        {sectorData.map((sec, idx) => <Cell key={idx} fill={sec.color} className="cursor-pointer outline-none" />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Dashboard Halka Grafiğin Merkezindeki Dinamik Metin Katmanı */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {activeSector ? (
                      <div className="text-center animate-in fade-in zoom-in-95 duration-150">
                        <p className="text-2xl font-black text-slate-900 leading-none">{activeSector.value} Tesis</p>
                        <p className="text-xs font-black uppercase tracking-wider mt-1" style={{ color: activeSector.color }}>
                          {activeSector.name} (%{activeSector.percentage})
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-2xl font-black text-slate-800 leading-none">{nodes.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Toplam Tesis</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-1/2 space-y-2.5">
                  {sectorData.map((sec, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} /><span className="text-xs font-bold text-slate-700">{sec.name}</span></div>
                      <span className="text-xs font-extrabold text-slate-900">{sec.value} Tesis</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider">🔄 Sistem Transfer Kayıtları ({getPeriodLabel()})</h3>
                <button onClick={() => setExpandedPanel('active-table')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"><Maximize2 className="w-4 h-4 text-blue-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[20rem] rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 font-extrabold border-b border-slate-200">
                    <tr><th className="p-4">Veren Tesis</th><th className="p-4">Alan Tesis</th><th className="p-4">Aktarılan Hacim</th><th className="p-4">Finansal Tasarruf</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedEdges.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{e.Veren_Isim}</td>
                        <td className="p-4 text-slate-600 font-semibold">{e.Alan_Isim}</td>
                        <td className="p-4 text-blue-600 font-black">{Math.round(e.Aktarilan_Su_Ton || 0).toLocaleString()} Ton</td>
                        <td className="p-4 text-emerald-600 font-black">₺{(e.Kazanilan_Tasarruf_TL || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider">🏭 Tüm Havza Fabrika Dizini</h3>
                <button onClick={() => setExpandedPanel('nodes-table')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"><Maximize2 className="w-4 h-4 text-amber-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[20rem] rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 font-extrabold border-b border-slate-200">
                    <tr><th className="p-4">Tesis Adı</th><th className="p-4">Sektör</th><th className="p-4">Sistem ID</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nodes.map((n) => (
                      <tr key={n.Fabrika_ID} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{n.Gercek_Isim}</td>
                        <td className="p-4"><span className="px-3 py-1 rounded-md text-xs font-black text-white shadow-xs tracking-wider uppercase" style={{ backgroundColor: SECTOR_COLORS[n.Sektor] }}>{n.Sektor}</span></td>
                        <td className="p-4 text-slate-500 font-mono font-bold">#{n.Fabrika_ID}</td>
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