import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip as LeafletTooltip, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { 
  Droplet, TrendingUp, Award, BarChart3, Map as MapIcon, 
  Factory, ArrowRightLeft, Maximize2, X, Route,
  ChevronRight, ChevronLeft, HelpCircle, Sparkles,
  FastForward, Calendar, ChevronDown, ChevronUp, CheckCircle2, Trees, Zap, Home, Clock, Compass, Activity, Network
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, ReferenceLine
} from 'recharts';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr } from 'date-fns/locale';

// Türkçe lokalizasyon ayarını kaydediyoruz
registerLocale('tr', tr);

// Takvim tetikleyicisini standart bir input yerine tamamen tıklanabilir bir buton yapıyoruz
const CustomCalendarButton = React.forwardRef(({ value, onClick, disabled }, ref) => (
  <button
    type="button"
    className="px-5 py-4 rounded-2xl bg-slate-100 text-slate-700 font-black text-xl border-2 border-slate-200 outline-none hover:bg-slate-200 disabled:opacity-50 transition-all cursor-pointer w-52 select-none text-center"
    onClick={onClick}
    ref={ref}
    disabled={disabled}
    title="Tarih Seçmek İçin Tıklayın"
  >
    {value}
  </button>
));

const SECTOR_COLORS = {
  Metal: '#f87171',   
  Kimya: '#34d399',   
  Gıda: '#fbbf24',    
  Tekstil: '#60a5fa'  
};

// İki koordinat arası Haversine mesafe hesaplama (km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ===================== PANEL 4: ALTYAPI MALİYETİ & AMORTİSMAN MODELİ =====================
// Tüm parametreler tek yerde tutulur; detay ekranındaki "Parametreler ve Kabuller" tablosu da buradan beslenir.
const DAYS_PER_MONTH = 365 / 12;

const INFRA = {
  suDegeriTlTon: (315.75 + 210.5) / 2, // İSU Ekim 2026: sanayi (315,75) ve ortak arıtmalı OSB (210,50) ortalaması, TL/m³ = TL/ton
  routeFactor: 1.3,          // kuş uçuşu mesafe -> gerçek hat güzergâhı
  designVelocity: 1.5,       // m/s
  sdr: 17,                   // PE100 SDR17 (PN10) boru: iç çap = dış çap x (1 - 2/SDR)
  usdTry: 47.4,              // TL/$ (Temmuz 2026 piyasa verisi, yaklaşık)
  pipeUsdPerM315: 42,        // 315 mm PE100 boru, $/m; fiyat çapın karesiyle ölçeklenir
  insaatEndeksi: 1.25,       // İller Bankası Aralık 2025 birim fiyatlarından 2027'ye taşıma katsayısı
  kaziOrani: 0.5,            // kazı, dolgu, yüzey onarımı: (boru + döşeme + ek) maliyetinin oranı
  pompaIstasyonuTl: 1000000, // hat başına pompa, vana, pano, ölçüm
  digerOrani: 0.15,          // proje, izin, beklenmedik giderler
  pompaKwhPerTon: 0.13,      // 30 m yük, %65 verim
  elektrikTlKwh: 4.07,       // EPDK Nisan 2026, alçak gerilim sanayi (dağıtım dahil)
  bakimOrani: 0.02           // yıllık, CAPEX'in oranı
};

const PIPE_DN = [63, 75, 90, 110, 125, 160, 200, 250, 315, 355, 400, 500];

// Boru malzemesi (TL/m): 315 mm = 42 $/m, SDR sabit olduğundan çapın karesiyle orantılı
const pipeMaterialTlPerM = (dn) => INFRA.pipeUsdPerM315 * Math.pow(dn / 315, 2) * INFRA.usdTry;

// Döşeme işçiliği + makine (TL/m, boru hariç): İller Bankası Aralık 2025, Ø180 = 149,63 ve Ø500 = 480,81 arasında doğrusal
const dosemeTlPerM = (dn) => Math.max(25, 149.63 + ((480.81 - 149.63) / (500 - 180)) * (dn - 180)) * INFRA.insaatEndeksi;

// Alın kaynağı ek yeri bedeli (TL/adet): İller Bankası Aralık 2025, Ø90 / Ø160 / Ø355 (10 atü) noktaları arasında doğrusal
const ekBedeliTl = (dn) => {
  const pts = [[90, 1145.79], [160, 1448.68], [355, 2349.6]];
  if (dn <= pts[0][0]) return pts[0][1];
  if (dn >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, fa] = pts[i];
    const [b, fb] = pts[i + 1];
    if (dn >= a && dn <= b) return fa + ((fb - fa) * (dn - a)) / (b - a);
  }
  return pts[0][1];
};

const computeInfraPlan = (allDailyData) => {
  const dayKeys = Object.keys(allDailyData).filter(k => k !== 'aggregates').sort();
  const pairs = {};
  const daily = [];

  dayKeys.forEach(dayKey => {
    const edges = allDailyData[dayKey]?.edges || [];
    let ton = 0;
    let tl = 0;
    edges.forEach(e => {
      const t = Number(e.Aktarilan_Su_Ton || 0);
      ton += t;
      tl += Number(e.Kazanilan_Tasarruf_TL || 0);
      const key = `${e.Veren_Fabrika}>${e.Alan_Fabrika}`;
      if (!pairs[key]) {
        pairs[key] = {
          veren: e.Veren_Isim,
          alan: e.Alan_Isim,
          km: calculateDistance(e.Veren_Enlem, e.Veren_Boylam, e.Alan_Enlem, e.Alan_Boylam),
          peakTon: 0,
          activeDays: 0
        };
      }
      pairs[key].peakTon = Math.max(pairs[key].peakTon, t);
      pairs[key].activeDays += 1;
    });
    daily.push({ ton, tl });
  });

  // Her çift için bir boru hattı: çap, pik günlük akışa göre seçilir
  let malzemeTl = 0;
  let dosemeEkTl = 0;
  let pompaTl = 0;
  let toplamHatM = 0;
  const pipelines = Object.values(pairs).map(p => {
    const q = p.peakTon / 24 / 3600; // m³/s, pik gün 24 saat boyunca eşit akış
    const requiredInner = Math.sqrt((4 * q) / (Math.PI * INFRA.designVelocity));
    const dn = PIPE_DN.find(d => (d / 1000) * (1 - 2 / INFRA.sdr) >= requiredInner) || PIPE_DN[PIPE_DN.length - 1];
    const lengthM = p.km * 1000 * INFRA.routeFactor;

    const malzeme = pipeMaterialTlPerM(dn) * lengthM;
    const dosemeEk = (dosemeTlPerM(dn) + ekBedeliTl(dn) / 12) * lengthM; // 12 m'lik boy başına bir ek
    const kazi = (malzeme + dosemeEk) * INFRA.kaziOrani;
    const pompa = INFRA.pompaIstasyonuTl;
    const cost = (malzeme + dosemeEk + kazi + pompa) * (1 + INFRA.digerOrani);

    malzemeTl += malzeme;
    dosemeEkTl += dosemeEk;
    pompaTl += pompa;
    toplamHatM += lengthM;
    return { ...p, dn, lengthM, cost };
  }).sort((a, b) => b.cost - a.cost);

  const boruHatTl = malzemeTl + dosemeEkTl;
  const kaziTl = boruHatTl * INFRA.kaziOrani;
  const digerTl = (boruHatTl + kaziTl + pompaTl) * INFRA.digerOrani;
  const capex = boruHatTl + kaziTl + pompaTl + digerTl;

  // Yıllık işletme: pompalama enerjisi + bakım
  const energyPerTon = INFRA.pompaKwhPerTon * INFRA.elektrikTlKwh;
  const maintPerDay = (capex * INFRA.bakimOrani) / 365;
  const toplamTon = daily.reduce((s, d) => s + d.ton, 0);
  const brutYillik = daily.reduce((s, d) => s + d.tl, 0);
  const enerjiYillik = toplamTon * energyPerTon;
  const bakimYillik = capex * INFRA.bakimOrani;
  const netYillik = brutYillik - enerjiYillik - bakimYillik;

  // Kümülatif geri ödeme: tüm hatlar 1 Ocak'ta hazır varsayılır
  let cum = -capex;
  let breakEvenDay = null;
  const curve = [{ ay: 0, net: cum / 1e6 }];
  daily.forEach((d, i) => {
    const g = d.tl - d.ton * energyPerTon - maintPerDay;
    const prev = cum;
    cum += g;
    if (breakEvenDay === null && cum >= 0 && g > 0) breakEvenDay = i + (-prev) / g;
    curve.push({ ay: (i + 1) / DAYS_PER_MONTH, net: cum / 1e6 });
  });
  if (breakEvenDay === null) {
    const avgDaily = daily.length > 0 ? (cum + capex) / daily.length : 0;
    breakEvenDay = avgDaily > 0 ? daily.length + (-cum) / avgDaily : Infinity;
  }
  const paybackMonths = breakEvenDay / DAYS_PER_MONTH;

  return {
    capex,
    capexKalemleri: [
      { ad: 'Boru malzemesi (PE100)', tutar: malzemeTl },
      { ad: 'Döşeme işçiliği ve ek yerleri', tutar: dosemeEkTl },
      { ad: 'Kazı, dolgu, yüzey onarımı', tutar: kaziTl },
      { ad: 'Pompa istasyonu, vana, pano', tutar: pompaTl },
      { ad: 'Proje, izin, beklenmedik', tutar: digerTl }
    ],
    hatSayisi: pipelines.length,
    toplamHatKm: toplamHatM / 1000,
    pipelines,
    brutYillik,
    enerjiYillik,
    bakimYillik,
    netYillik,
    paybackMonths,
    curve
  };
};

const formatTlCompact = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return `₺${(n / 1e9).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} Mr`;
  if (Math.abs(n) >= 1e6) return `₺${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
};

const formatDistance = (km) => {
  if (!km || km <= 0) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} km`;
};

const formatPayback = (months) => {
  if (!Number.isFinite(months)) return '—';
  if (months < 1) return `${Math.max(1, Math.round(months * DAYS_PER_MONTH))} gün`;
  return `${months.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ay`;
};

// Detay ekranındaki parametre tablosu. tur: 'kaynak' (resmi/piyasa verisi), 'varsayim', 'kabul' (mühendislik hesabı)
const INFRA_PARAM_ROWS = [
  { ad: 'Su birim değeri', deger: `${INFRA.suDegeriTlTon.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL/ton`, tur: 'kaynak', not: 'İSU Ekim 2026 tarifesi: sanayi 315,75 TL/m³ ile ortak arıtmalı OSB 210,50 TL/m³ değerlerinin ortalaması. Tüm kazanç rakamları bu değerle hesaplanır.' },
  { ad: 'Boru malzemesi (PE100)', deger: `315 mm için ${INFRA.pipeUsdPerM315} $/m`, tur: 'kaynak', not: '2026 piyasa fiyat listesi. Diğer çaplar için fiyat çapın karesiyle ölçeklenir.' },
  { ad: 'Döviz kuru', deger: `${INFRA.usdTry.toLocaleString('tr-TR')} TL/$`, tur: 'kaynak', not: 'Temmuz 2026 piyasa verisi, yaklaşık değer.' },
  { ad: 'Döşeme işçiliği', deger: 'Ø180: 149,63 TL/m, Ø500: 480,81 TL/m', tur: 'kaynak', not: 'İller Bankası birim fiyatları, Aralık 2025 (boru hariç). Ara çaplar doğrusal alınır.' },
  { ad: 'İnşaat fiyat endeksi', deger: `x${INFRA.insaatEndeksi.toLocaleString('tr-TR')}`, tur: 'varsayim', not: 'Aralık 2025 birim fiyatlarının 2027 başına taşınması için kabul edilen katsayı.' },
  { ad: 'Kaynak ek yeri', deger: 'Ø90: 1.146 TL, Ø160: 1.449 TL, Ø355: 2.350 TL', tur: 'kaynak', not: 'İller Bankası alın kaynağı birim fiyatları, her 12 m boyda bir ek.' },
  { ad: 'Güzergâh katsayısı', deger: `x${INFRA.routeFactor.toLocaleString('tr-TR')}`, tur: 'varsayim', not: 'Kuş uçuşu mesafe gerçek boru güzergâhından kısadır.' },
  { ad: 'Boru çapı seçimi', deger: `${INFRA.designVelocity.toLocaleString('tr-TR')} m/s, SDR${INFRA.sdr}`, tur: 'kabul', not: 'Her hattın yıl içindeki pik günlük akışı 24 saate yayılarak çap seçilir.' },
  { ad: 'Kazı, dolgu, yüzey onarımı', deger: `%${Math.round(INFRA.kaziOrani * 100)}`, tur: 'varsayim', not: 'Boru, döşeme ve ek maliyetinin oranı olarak alınmıştır.' },
  { ad: 'Pompa istasyonu, vana, pano', deger: `${(INFRA.pompaIstasyonuTl / 1e6).toLocaleString('tr-TR', { minimumFractionDigits: 1 })} Mn TL / hat`, tur: 'varsayim', not: 'Toplam altyapı maliyetinin en büyük kalemi. Gerçek teklifle güncellenmelidir.' },
  { ad: 'Proje, izin, beklenmedik', deger: `%${Math.round(INFRA.digerOrani * 100)}`, tur: 'varsayim', not: 'Hat, kazı ve pompa maliyetinin toplamına eklenir.' },
  { ad: 'Pompalama enerjisi', deger: `${INFRA.pompaKwhPerTon.toLocaleString('tr-TR')} kWh/ton x ${INFRA.elektrikTlKwh.toLocaleString('tr-TR')} TL/kWh`, tur: 'kaynak', not: 'EPDK Nisan 2026 alçak gerilim sanayi tarifesi. Enerji miktarı 30 m yük ve %65 verimle hesaplanmıştır.' },
  { ad: 'Bakım gideri', deger: `Yılda CAPEX'in %${Math.round(INFRA.bakimOrani * 100)}'si`, tur: 'varsayim', not: 'Su ve pompa altyapısı için yaygın kabul.' },
  { ad: 'Kurulum zamanı', deger: "Tüm hatlar 1 Ocak 2027'de hazır", tur: 'kabul', not: 'Yıl içinde kullanılan her çift (tek gün çalışanlar dahil) altyapı maliyetine tam olarak girer.' }
];

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
      { label: "4 Dinamik Panel:", text: "En çok su kazandıran tesisler, sektörel dağılım, aktif vanalar ve fabrika dizini ile altyapı maliyeti ve amortisman analizini içerir." },
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

  const [isKpisMinimized, setIsKpisMinimized] = useState(false);
  const [isControlsMinimized, setIsControlsMinimized] = useState(false);

  const [activeSector, setActiveSector] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);

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
    
    return () => { isMounted = false; };
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
    nodes.forEach(n => { if (n && n.Fabrika_ID !== undefined) map[String(n.Fabrika_ID)] = n; });
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

  const nodeEdgeSummary = useMemo(() => {
    const summary = {};
    liveEdges.filter(Boolean).forEach(edge => {
        const vId = edge.Veren_Fabrika || edge.Veren_ID;
        const aId = edge.Alan_Fabrika || edge.Alan_ID;
        const ton = Number(edge.Aktarilan_Su_Ton || 0);
        const tasarruf = Number(edge.Kazanilan_Tasarruf_TL || 0);
        
        if (!summary[vId]) summary[vId] = { verenTon: 0, alanTon: 0, tasarrufTl: 0, baglantiSayisi: 0 };
        summary[vId].verenTon += ton;
        summary[vId].baglantiSayisi += 1;
        
        if (!summary[aId]) summary[aId] = { verenTon: 0, alanTon: 0, tasarrufTl: 0 };
        summary[aId].alanTon += ton;
        summary[aId].tasarrufTl += tasarruf;
    });
    return summary;
  }, [liveEdges]);

  const aggregatedBarData = useMemo(() => {
    const map = {};
    displayEdges.forEach(edge => {
      let rawName = edge.Veren_Isim || 'Bilinmeyen Tesis';
      let factoryId = edge.Veren_Fabrika || edge.Veren_ID || '';
      const cleanKey = rawName.replace(/(A\.Ş\.|Sanayi ve Ticaret Anonim Şirketi|Ticaret|ve Sanayi|A\.S\.|Şti\.|San\.|AŞ|AS)/g, '').trim().toLowerCase();

      if (!map[cleanKey]) {
        const displayName = rawName.replace(/(A\.Ş\.|Sanayi ve Ticaret Anonim Şirketi|Ticaret ve Sanayi|A\.S\.|Şti\.|San\.|AŞ|AS)/g, '').trim();
        const words = displayName.split(' ');
        const shortName = words.length > 2 ? `${words[0]} ${words[1]}...` : (displayName || `Tesis #${factoryId}`);
        map[cleanKey] = { 
          id: cleanKey,
          Veren_Isim: displayName || rawName, 
          Display_Name: displayName || rawName, 
          Short_Name: shortName, 
          Total_Ton: 0, 
          Total_Tasarruf: 0, 
          Vana_Sayisi: 0,
          destinations: {}, 
          Total_Tasarruf_TL: 0,
          Kapasite_Verimliligi: Math.floor(Math.random() * (98 - 75 + 1)) + 75 
        };
      }
      const ton = Number(edge.Aktarilan_Su_Ton || 0);
      const tasarrufTl = Number(edge.Kazanilan_Tasarruf_TL || 0);
      const alanAdi = edge.Alan_Isim || nodeMap[String(edge.Alan_Fabrika || edge.Alan_ID)]?.Gercek_Isim || 'Alıcı Tesis';
      
      map[cleanKey].Total_Ton += ton;
      map[cleanKey].Total_Tasarruf_TL += tasarrufTl;
      map[cleanKey].Vana_Sayisi += edge.Islem_Sayisi || 1;
      
      if (!map[cleanKey].destinations[alanAdi]) {
        map[cleanKey].destinations[alanAdi] = { ton: 0, tasarrufTl: 0 };
      }
      map[cleanKey].destinations[alanAdi].ton += ton;
      map[cleanKey].destinations[alanAdi].tasarrufTl += tasarrufTl;
    });

    return Object.values(map)
      .map(item => ({ 
        ...item, 
        Total_Ton: Math.round(item.Total_Ton),
        Total_Tasarruf_TL: Math.round(item.Total_Tasarruf_TL),
        Baglanti_Listesi: Object.entries(item.destinations).map(([alanAdi, data]) => ({
          alanAdi,
          ton: Math.round(data.ton),
          tasarrufTl: Math.round(data.tasarrufTl)
        }))
      }))
      .sort((a, b) => b.Total_Ton - a.Total_Ton);
  }, [displayEdges, nodeMap]);

  const sectorData = useMemo(() => {
    const counts = { Metal: 0, Kimya: 0, Gıda: 0, Tekstil: 0 };
    nodes.forEach(n => { if (n && n.Sektor && counts[n.Sektor] !== undefined) counts[n.Sektor] += 1; });
    const total = nodes.length || 1;
    return Object.keys(counts).map(sec => ({ name: sec, value: counts[sec], percentage: Math.round((counts[sec] / total) * 100), color: SECTOR_COLORS[sec] }));
  }, [nodes]);

  const sectoralSymbiosisData = useMemo(() => {
    const matrix = {};
    const sectors = ['Metal', 'Kimya', 'Gıda', 'Tekstil'];
    
    sectors.forEach(s1 => {
      matrix[s1] = {};
      sectors.forEach(s2 => {
        matrix[s1][s2] = { ton: 0, islemSayisi: 0, tasarrufTl: 0 };
      });
    });

    const sectorStats = {
      Metal: { suKazanci: 0, tasarruf: 0, tesisSayisi: sectorData.find(s => s.name === 'Metal')?.value || 1 },
      Kimya: { suKazanci: 0, tasarruf: 0, tesisSayisi: sectorData.find(s => s.name === 'Kimya')?.value || 1 },
      Gıda: { suKazanci: 0, tasarruf: 0, tesisSayisi: sectorData.find(s => s.name === 'Gıda')?.value || 1 },
      Tekstil: { suKazanci: 0, tasarruf: 0, tesisSayisi: sectorData.find(s => s.name === 'Tekstil')?.value || 1 },
    };

    displayEdges.forEach(edge => {
      const vNode = nodeMap[String(edge.Veren_Fabrika || edge.Veren_ID)];
      const aNode = nodeMap[String(edge.Alan_Fabrika || edge.Alan_ID)];
      if (!vNode || !aNode) return;

      const sVeren = vNode.Sektor;
      const sAlan = aNode.Sektor;
      const ton = Number(edge.Aktarilan_Su_Ton || 0);
      const tasarruf = Number(edge.Kazanilan_Tasarruf_TL || 0);

      if (matrix[sVeren] && matrix[sVeren][sAlan]) {
        matrix[sVeren][sAlan].ton += ton;
        matrix[sVeren][sAlan].tasarrufTl += tasarruf;
        matrix[sVeren][sAlan].islemSayisi += 1;
      }

      if (sectorStats[sVeren]) sectorStats[sVeren].suKazanci += ton;
      if (sectorStats[sAlan]) sectorStats[sAlan].tasarruf += tasarruf;
    });

    const topLinks = [];
    sectors.forEach(s1 => {
      sectors.forEach(s2 => {
        if (matrix[s1][s2].ton > 0) {
          topLinks.push({
            veren: s1,
            alan: s2,
            ton: Math.round(matrix[s1][s2].ton),
            tasarruf: Math.round(matrix[s1][s2].tasarrufTl),
            islem: matrix[s1][s2].islemSayisi,
            colorVeren: SECTOR_COLORS[s1],
            colorAlan: SECTOR_COLORS[s2]
          });
        }
      });
    });
    topLinks.sort((a, b) => b.ton - a.ton);

    return { matrix, topLinks, sectorStats };
  }, [displayEdges, nodeMap, sectorData]);

  // Panel 4: Hiperlokalite & Altyapı Geri Dönüşü
  // Özet kartlar seçilen döneme (günlük, aylık, yıllık) göre veriden hesaplanır.
  const periodImpact = useMemo(() => {
    let totalTon = 0;
    let totalCo2Kg = 0;
    let weightedDist = 0;
    let distTon = 0;

    displayEdges.forEach(edge => {
      const ton = Number(edge.Aktarilan_Su_Ton || 0);
      totalTon += ton;
      totalCo2Kg += Number(edge.Net_CO2_Kazanc_kg || 0);

      const vNode = nodeMap[String(edge.Veren_Fabrika || edge.Veren_ID)];
      const aNode = nodeMap[String(edge.Alan_Fabrika || edge.Alan_ID)];
      const srcLat = edge.Veren_Enlem || vNode?.Enlem;
      const srcLon = edge.Veren_Boylam || vNode?.Boylam;
      const dstLat = edge.Alan_Enlem || aNode?.Enlem;
      const dstLon = edge.Alan_Boylam || aNode?.Boylam;

      const dist = calculateDistance(srcLat, srcLon, dstLat, dstLon);
      if (dist > 0 && ton > 0) {
        weightedDist += dist * ton;
        distTon += ton;
      }
    });

    return {
      avgDistKm: distTon > 0 ? weightedDist / distTon : 0,
      totalTon,
      co2Ton: totalCo2Kg / 1000,
      transferCount: displayEdges.length
    };
  }, [displayEdges, nodeMap]);

  // Altyapı maliyeti ve amortisman dönemden bağımsızdır: her zaman 2027 yılının tüm aktarımlarına göre hesaplanır.
  const infraPlan = useMemo(() => (allDailyData ? computeInfraPlan(allDailyData) : null), [allDailyData]);

  const getUnitSuffix = () => {
    if (dashboardPeriod === 'daily') return 'Ton/Gün';
    if (dashboardPeriod === 'monthly') return 'Ton/Ay';
    return 'Ton/Yıl';
  };

  const comprehensiveNodesList = useMemo(() => {
    return nodes.map(n => {
      const activeEdge = liveEdges.find(e => (e.Veren_Fabrika || e.Veren_ID) === n.Fabrika_ID || (e.Alan_Fabrika || e.Alan_ID) === n.Fabrika_ID);
      const isSender = liveEdges.some(e => (e.Veren_Fabrika || e.Veren_ID) === n.Fabrika_ID);
      const isReceiver = liveEdges.some(e => (e.Alan_Fabrika || e.Alan_ID) === n.Fabrika_ID);
      
      let statusText = "Beklemede (Pasif)";
      let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
      
      if (isSender && isReceiver) {
        statusText = "Aktif (Hem Veren/Hem Alan)";
        badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
      } else if (isSender) {
        statusText = "Aktif Verici Tesis";
        badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
      } else if (isReceiver) {
        statusText = "Aktif Alıcı Tesis";
        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
      }

      return {
        ...n,
        statusText,
        badgeColor
      };
    }).sort((a, b) => a.Gercek_Isim.localeCompare(b.Gercek_Isim));
  }, [nodes, liveEdges]);

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

            .react-datepicker-wrapper {
              display: inline-block;
              width: auto;
            }
            .react-datepicker-popper {
              z-index: 3000 !important;
            }
            .react-datepicker {
              font-family: inherit;
              border-radius: 1.5rem;
              border: 2px solid #e2e8f0;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              padding: 0.75rem;
              background-color: #ffffff;
            }
            .react-datepicker__header {
              background-color: #f8fafc;
              border-bottom: 1px solid #e2e8f0;
              border-top-left-radius: 1.25rem;
              border-top-right-radius: 1.25rem;
              padding-top: 0.75rem;
              text-transform: capitalize;
            }
            .react-datepicker__current-month {
              font-weight: 800;
              color: #0f172a;
              font-size: 1.1rem;
              text-transform: capitalize;
            }
            .react-datepicker__day-name {
              color: #64748b;
              font-weight: 700;
              text-transform: capitalize;
            }
            .react-datepicker__day {
              border-radius: 0.75rem;
              font-weight: 700;
              color: #334155;
            }
            .react-datepicker__day:hover {
              background-color: #e0f2fe;
              color: #0284c7;
            }
            .react-datepicker__day--selected {
              background-color: #2563eb !important;
              color: #ffffff !important;
              font-weight: 900;
            }
            .react-datepicker__day--outside-month {
              color: #cbd5e1 !important;
              background-color: transparent !important;
              font-weight: 500;
            }
            .react-datepicker__day--outside-month:hover {
              background-color: #f1f5f9 !important;
              color: #94a3b8 !important;
            }
            .react-datepicker__day--disabled {
              color: #cbd5e1 !important;
            }
          `
        }}
      />

      {/* ONBOARDING REHBERİ VE KARŞILAMA EKRANI */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[4000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-4xl w-full max-h-full overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-300">
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
            <h1 className="text-slate-900 font-black text-2xl tracking-tight">W3Flow - Waste Water Web Flow</h1>
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
              const srcNode = nodeMap[String(edge.Veren_Fabrika || edge.Veren_ID)];
              const dstNode = nodeMap[String(edge.Alan_Fabrika || edge.Alan_ID)];
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
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-xl border-2 border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2rem] px-9 py-5 flex items-center gap-10 pointer-events-auto transition-all">
              <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100"><Calendar className="text-blue-600 w-8 h-8" /></div>
                <div className="flex flex-col"><span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Analiz Tarihi</span><span className="text-2xl font-black text-slate-800 tracking-wide">{formatDateForUI(simulationTime)}</span></div>
              </div>
              <div className="h-14 w-px bg-slate-300"></div>
              <div className="flex items-center gap-4">
                
                <DatePicker
                  selected={pendingDateStr ? new Date(pendingDateStr) : simulationTime}
                  onChange={(date) => {
                    if (date) {
                      setPendingDateStr(formatSimTime(date));
                    }
                  }}
                  minDate={new Date("2027-01-01")}
                  maxDate={new Date("2027-12-31")}
                  dateFormat="yyyy-MM-dd"
                  popperPlacement="top-start"
                  disabled={isSimulatingLoading}
                  locale="tr"
                  customInput={<CustomCalendarButton />}
                />

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
            <div className="fixed inset-0 z-[3000] bg-white/95 backdrop-blur-xl p-8 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100"><Droplet className="w-6 h-6 text-blue-500" /></div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-wide">
                    {expandedPanel === 'bar' && `En Yüksek Atık Su Geri Kazandıran Tesisler ve Performans Detayları (${getPeriodTitle()})`}
                    {expandedPanel === 'pie' && "Havzadaki Fabrikaların Sektörel Dağılımı ve Kapsamlı Envanter Matrisi"}
                    {expandedPanel === 'symbiosis' && `Sektörel Simbiyoz ve Takas Matrisi (${getPeriodTitle()})`}
                    {expandedPanel === 'infra-roi' && 'Altyapı Maliyeti ve Amortisman Analizi (2027 yılı baz alınmıştır)'}
                  </h2>
                </div>
                <button onClick={() => setExpandedPanel(null)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer font-bold text-sm shadow-sm"><X className="w-5 h-5 text-blue-500" /> Kapat</button>
              </div>

              <div className="flex-1 w-full pb-10">
                {expandedPanel === 'bar' && (
                  <div className="w-full flex flex-col gap-8">
                    <div className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h3 className="text-base font-black text-slate-800 mb-4">📈 Aktif Su Veren Tüm Tesisler Sıralaması</h3>
                      <div className="w-full h-[24rem] overflow-x-auto">
                        <div style={{ minWidth: `${Math.max(800, aggregatedBarData.length * 80)}px` }} className="h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={aggregatedBarData}>
                              <XAxis dataKey="Display_Name" stroke="#64748b" fontSize={12} fontWeight="bold" interval={0} angle={-35} textAnchor="end" height={100} />
                              <YAxis stroke="#64748b" fontSize={14} fontWeight="bold" />
                              <RechartsTooltip content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (<div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xl text-slate-800"><p className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2 mb-2">{data.Veren_Isim}</p><p className="text-blue-600 font-extrabold text-sm">Toplam Verilen Su: {data.Total_Ton.toLocaleString()} Ton</p><p className="text-emerald-600 font-extrabold text-sm mt-1">Finansal Tasarruf: ₺{data.Total_Tasarruf_TL.toLocaleString()}</p></div>);
                                  }
                                  return null;
                                }} />
                              <Bar dataKey="Total_Ton" fill="#60a5fa" radius={[12, 12, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h3 className="text-base font-black text-slate-800 mb-2 flex items-center gap-2"><span>📊</span> Tesis Bazlı Derinlemesine Performans ve Çevresel Katkı Matrisi</h3>
                      <p className="text-xs text-slate-500 font-bold mb-4">*(Bir tesisin birden fazla alıcıya su verdiği durumlarda satıra tıklayarak detaylı dağılımı ve alan fabrikaların tasarruf paylarını görebilirsiniz.)*</p>
                      
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-extrabold border-b border-slate-200">
                            <tr>
                              <th className="p-4 w-12 text-center">#</th>
                              <th className="p-4">Tesis Adı</th>
                              <th className="p-4">Toplam Verilen Su (Ton)</th>
                              <th className="p-4">Ağ Bağlantı Sayısı</th>
                              <th className="p-4">Finansal Tasarruf (₺)</th>
                              <th className="p-4">Kapasite Kullanım Verimliliği</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {aggregatedBarData.map((item) => {
                              const isExpanded = expandedRowId === item.id;
                              return (
                                <React.Fragment key={item.id}>
                                  <tr onClick={() => setExpandedRowId(isExpanded ? null : item.id)} className="hover:bg-blue-50/50 transition-colors cursor-pointer select-none">
                                    <td className="p-4 text-center font-extrabold text-slate-400">
                                      {isExpanded ? <ChevronUp className="w-5 h-5 text-blue-600 mx-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 mx-auto" />}
                                    </td>
                                    <td className="p-4 font-extrabold text-slate-900 flex items-center gap-2">
                                      <span>{item.Veren_Isim}</span>
                                      <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-full">Detay için tıkla</span>
                                    </td>
                                    <td className="p-4 text-blue-600 font-black">{item.Total_Ton.toLocaleString()} Ton</td>
                                    <td className="p-4 text-slate-700 font-bold">{item.Baglanti_Listesi.length} Farklı Tesis</td>
                                    <td className="p-4 text-emerald-600 font-black">₺{item.Total_Tasarruf_TL.toLocaleString()}</td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-28 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${item.Kapasite_Verimliligi}%` }}></div>
                                        </div>
                                        <span className="font-extrabold text-slate-800 text-xs">%{item.Kapasite_Verimliligi}</span>
                                      </div>
                                    </td>
                                  </tr>

                                  {isExpanded && (
                                    <tr className="bg-slate-50/80 animate-in fade-in duration-200">
                                      <td colSpan="6" className="p-6 px-12">
                                        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm">
                                          <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 mb-3 flex items-center gap-2"><span>💧</span> {item.Veren_Isim} Tesisinin Su Aktardığı Alıcı Fabrikalar, Tonaj ve Finansal Tasarruf Payları</h4>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {item.Baglanti_Listesi.map((dest, dIdx) => (
                                              <div key={dIdx} className="flex flex-col p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                                                <span className="font-black text-slate-900 truncate" title={dest.alanAdi}>{dest.alanAdi}</span>
                                                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                                                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{dest.ton} Ton</span>
                                                  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">₺{dest.tasarrufTl.toLocaleString()}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {expandedPanel === 'pie' && (
                  <div className="w-full flex flex-col gap-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {sectorData.map((sec, idx) => (
                        <div key={idx} className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10" style={{ backgroundColor: sec.color }}></div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: sec.color }}></div>
                            <h4 className="text-base font-extrabold text-slate-800">{sec.name} Sektörü</h4>
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-3xl font-black text-slate-900">{sec.value} <span className="text-sm text-slate-500 font-bold">Tesis</span></span>
                            <span className="text-xl font-black" style={{ color: sec.color }}>%{sec.percentage}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-4">
                            <div className="h-full rounded-full" style={{ width: `${sec.percentage}%`, backgroundColor: sec.color }}></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><span>🏭</span> Kapsamlı Tesis Envanter Matrisi</h3>
                        <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">Toplam {comprehensiveNodesList.length} Tesis Listeleniyor</span>
                      </div>
                      
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white max-h-[32rem]">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 font-extrabold border-b border-slate-200 z-10">
                            <tr>
                              <th className="p-4">Tesis Adı</th>
                              <th className="p-4">Sektör</th>
                              <th className="p-4">Sistem ID</th>
                              <th className="p-4">Coğrafi Konum (Enlem / Boylam)</th>
                              {dashboardPeriod === 'daily' && <th className="p-4">Seçili Günkü Vana Durumu</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {comprehensiveNodesList.map((n) => (
                              <tr key={n.Fabrika_ID} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-extrabold text-slate-900">{n.Gercek_Isim}</td>
                                <td className="p-4">
                                  <span className="px-3 py-1 rounded-lg text-xs font-black text-white shadow-xs tracking-wider uppercase" style={{ backgroundColor: SECTOR_COLORS[n.Sektor] }}>
                                    {n.Sektor}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-500 font-mono font-bold">#{n.Fabrika_ID}</td>
                                <td className="p-4 text-slate-600 font-mono text-xs">
                                  <div className="flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-blue-500" /><span>{n.Enlem}, {n.Boylam}</span></div>
                                </td>
                                {dashboardPeriod === 'daily' && (
                                  <td className="p-4">
                                    <span className={`px-3 py-1 rounded-lg text-xs font-black border ${n.badgeColor}`}>
                                      {n.statusText}
                                    </span>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {expandedPanel === 'symbiosis' && (
                  <div className="w-full flex flex-col gap-8">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h3 className="text-base font-black text-slate-800 mb-2 flex items-center gap-2"><span>🔄</span> Sektörler Arası Atık Su Takas ve İlişki Matrisi</h3>
                      <p className="text-xs text-slate-500 font-bold mb-4">*(Satırlar atık suyu veren sektörü, sütunlar ise atık suyu hammadde olarak alan sektörü gösterir. Birim: <strong>{getUnitSuffix()}</strong>)*</p>
                      
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="w-full text-center text-sm">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-extrabold border-b border-slate-200">
                            <tr>
                              <th className="p-4 text-left">Veren \ Alan Sektör</th>
                              <th className="p-4">Metal</th>
                              <th className="p-4">Kimya</th>
                              <th className="p-4">Gıda</th>
                              <th className="p-4">Tekstil</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {['Metal', 'Kimya', 'Gıda', 'Tekstil'].map((s1) => (
                              <tr key={s1} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-left font-black text-slate-900 flex items-center gap-2">
                                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: SECTOR_COLORS[s1] }}></div>
                                  <span>{s1} Sektörü</span>
                                </td>
                                {['Metal', 'Kimya', 'Gıda', 'Tekstil'].map((s2) => {
                                  const cellData = sectoralSymbiosisData.matrix[s1][s2];
                                  return (
                                    <td key={s2} className="p-4">
                                      {cellData.ton > 0 ? (
                                        <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                                          <p className="font-black text-blue-600 text-sm">{cellData.ton.toLocaleString()} {getUnitSuffix()}</p>
                                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">₺{cellData.tasarrufTl.toLocaleString()} Tasarruf</p>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300 font-bold">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2"><span>📊</span> Sektör Başına Ortalama Değerler ve Makro Ekonomik Katkı</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {['Metal', 'Kimya', 'Gıda', 'Tekstil'].map((sec) => {
                          const stats = sectoralSymbiosisData.sectorStats[sec];
                          const color = SECTOR_COLORS[sec];
                          return (
                            <div key={sec} className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></div>
                                <h4 className="text-base font-extrabold text-slate-800">{sec} Sektörü</h4>
                              </div>
                              <div className="space-y-3">
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Toplam Su Kazancı</span>
                                  <span className="text-xl font-black text-blue-600">{stats.suKazanci.toLocaleString()} {getUnitSuffix()}</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Finansal Tasarruf Katkısı</span>
                                  <span className="text-xl font-black text-emerald-600">₺{stats.tasarruf.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {expandedPanel === 'infra-roi' && infraPlan && (
                  <div className="w-full flex flex-col gap-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-blue-50 border border-blue-200 p-6 rounded-3xl">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-600 block mb-1">Toplam Altyapı Maliyeti</span>
                        <span className="text-4xl font-black text-blue-950">{formatTlCompact(infraPlan.capex)}</span>
                        <p className="text-xs text-blue-700 mt-2 font-bold">Tek seferlik yatırım. Yıl içinde kullanılan tüm tesis çiftleri arasında boru hattı kurulduğu varsayılmıştır.</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-600 block mb-1">Yıllık Net Getiri</span>
                        <span className="text-4xl font-black text-emerald-950">{formatTlCompact(infraPlan.netYillik)}</span>
                        <p className="text-xs text-emerald-700 mt-2 font-bold">Brüt tasarruf {formatTlCompact(infraPlan.brutYillik)}. Pompalama enerjisi ({formatTlCompact(infraPlan.enerjiYillik)}) ve bakım ({formatTlCompact(infraPlan.bakimYillik)}) düşülmüştür.</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 p-6 rounded-3xl">
                        <span className="text-xs font-black uppercase tracking-wider text-purple-600 block mb-1">Amortisman Süresi</span>
                        <span className="text-4xl font-black text-purple-950">{formatPayback(infraPlan.paybackMonths)}</span>
                        <p className="text-xs text-purple-700 mt-2 font-bold">Sistem 1 Ocak 2027'de devreye girdiğinde kümülatif net getirinin altyapı maliyetini karşıladığı an.</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">Boru Hattı Envanteri</span>
                        <span className="text-4xl font-black text-slate-900">{infraPlan.hatSayisi} hat</span>
                        <p className="text-xs text-slate-600 mt-2 font-bold">Toplam {formatDistance(infraPlan.toplamHatKm)} boru. Güzergâh katsayısı dahil.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-base font-black text-slate-800 mb-1">Geri Ödeme Eğrisi</h3>
                        <p className="text-xs text-slate-500 font-bold mb-4">Kümülatif net getiri eksi altyapı maliyeti. Eğrinin sıfırı geçtiği nokta amortisman anıdır.</p>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={infraPlan.curve.filter(p => p.ay <= Math.min(12, Math.max(3, Math.ceil(infraPlan.paybackMonths * 2))))}
                              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                type="number"
                                dataKey="ay"
                                domain={[0, 'dataMax']}
                                tickFormatter={(v) => `${Math.round(v)}. ay`}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                              />
                              <YAxis tickFormatter={(v) => `${Math.round(v)} Mn`} tick={{ fontSize: 11, fill: '#64748b' }} width={64} />
                              <RechartsTooltip
                                formatter={(v) => [`₺${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`, 'Kümülatif net']}
                                labelFormatter={(v) => `${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}. ay`}
                              />
                              <ReferenceLine y={0} stroke="#7c3aed" strokeDasharray="4 4" />
                              <Line type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={3} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-base font-black text-slate-800 mb-4">Altyapı Maliyet Kalemleri</h3>
                        <div className="flex flex-col gap-4">
                          {infraPlan.capexKalemleri.map(k => {
                            const pct = infraPlan.capex > 0 ? (k.tutar / infraPlan.capex) * 100 : 0;
                            return (
                              <div key={k.ad}>
                                <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1.5">
                                  <span>{k.ad}</span>
                                  <span>{formatTlCompact(k.tutar)} <span className="text-slate-400 font-semibold">(%{pct.toFixed(0)})</span></span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                      <h3 className="text-base font-black text-slate-800 mb-1">En Maliyetli Hatlar</h3>
                      <p className="text-xs text-slate-500 font-bold mb-4">{infraPlan.hatSayisi} hattan en yüksek maliyetli 8 tanesi. "Aktif gün" sütunu, hattın yıl içinde kaç gün kullanıldığını gösterir.</p>
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                            <th className="py-3 pr-4">Hat</th>
                            <th className="py-3 pr-4">Boru uzunluğu</th>
                            <th className="py-3 pr-4">Çap</th>
                            <th className="py-3 pr-4">Pik akış</th>
                            <th className="py-3 pr-4">Aktif gün</th>
                            <th className="py-3 text-right">Maliyet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {infraPlan.pipelines.slice(0, 8).map((p, idx) => (
                            <tr key={`${p.veren}-${p.alan}-${idx}`} className="border-b border-slate-100 font-bold text-slate-700">
                              <td className="py-3 pr-4">{p.veren} <ChevronRight className="w-3.5 h-3.5 inline text-slate-400" /> {p.alan}</td>
                              <td className="py-3 pr-4">{Math.round(p.lengthM)} m</td>
                              <td className="py-3 pr-4">Ø{p.dn} mm</td>
                              <td className="py-3 pr-4">{p.peakTon.toLocaleString('tr-TR')} ton/gün</td>
                              <td className="py-3 pr-4">{p.activeDays}</td>
                              <td className="py-3 text-right">{formatTlCompact(p.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h3 className="text-base font-black text-slate-800 mb-1">Parametreler ve Kabuller</h3>
                      <p className="text-xs text-slate-500 font-bold mb-5">Hesapta kullanılan her değerin dayanağı. Yeşil rozet resmi veya piyasa kaynağından alınan değeri, sarı rozet projeye özel varsayımı, gri rozet mühendislik kabulünü gösterir.</p>
                      <div className="flex flex-col divide-y divide-slate-200">
                        {INFRA_PARAM_ROWS.map(row => (
                          <div key={row.ad} className="py-3 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-start">
                            <div className="md:col-span-3 text-sm font-black text-slate-800">{row.ad}</div>
                            <div className="md:col-span-3 text-sm font-bold text-blue-700">{row.deger}</div>
                            <div className="md:col-span-2">
                              <span className={`inline-block text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                                row.tur === 'kaynak' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.tur === 'varsayim' ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {row.tur === 'kaynak' ? 'Kaynaklı' : row.tur === 'varsayim' ? 'Varsayım' : 'Kabul'}
                              </span>
                            </div>
                            <div className="md:col-span-4 text-xs font-semibold text-slate-500 leading-relaxed">{row.not}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-[40rem]">
            {/* PANEL 1: En Çok Su Kazandıran Tesisler */}
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3"><BarChart3 className="w-6 h-6 text-blue-500" /> En Çok Su Kazandıran Tesisler ({getPeriodTitle()})</h3>
                <button onClick={() => setExpandedPanel('bar')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200" title="Detaylı Matrise Git"><Maximize2 className="w-4 h-4 text-blue-500" /></button>
              </div>
              <div className="flex-1 w-full min-h-[17.5rem]">
                {aggregatedBarData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 font-bold">Bu zaman dilimi için henüz transfer verisi bulunmuyor.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedBarData.slice(0, 5)}>
                      <XAxis dataKey="Short_Name" stroke="#64748b" fontSize={11} fontWeight="bold" interval={0} angle={-15} textAnchor="end" height={45} />
                      <YAxis stroke="#64748b" fontSize={12} fontWeight="bold" />
                      <RechartsTooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (<div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xl text-slate-800"><p className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1.5 mb-1.5">{data.Veren_Isim}</p><p className="text-blue-600 font-extrabold text-xs">Toplam Verilen Su: {data.Total_Ton.toLocaleString()} {getUnitSuffix()}</p><p className="text-emerald-600 font-extrabold text-xs mt-1">Finansal Tasarruf: ₺{data.Total_Tasarruf_TL.toLocaleString()}</p></div>);
                          }
                          return null;
                        }} />
                      <Bar dataKey="Total_Ton" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* PANEL 2: Sektörel Dağılım ve Havza Fabrika Dizini */}
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3"><Factory className="w-6 h-6 text-emerald-500" /> Fabrikaların Sektörel Dağılımı</h3>
                <button onClick={() => setExpandedPanel('pie')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200" title="Detaylı Envanter Matrisine Git"><Maximize2 className="w-4 h-4 text-emerald-500" /></button>
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

            {/* PANEL 3: Sektörel Simbiyoz ve Döngüsel Ağ */}
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3"><Network className="w-6 h-6 text-purple-500" /> Sektörel Simbiyoz & En Güçlü Bağlar</h3>
                <button onClick={() => setExpandedPanel('symbiosis')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200" title="Detaylı Matrise Git"><Maximize2 className="w-4 h-4 text-purple-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[20rem] space-y-3">
                {sectoralSymbiosisData.topLinks.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 font-bold">Bu zaman dilimi için sektörel bağ verisi bulunmuyor.</div>
                ) : (
                  sectoralSymbiosisData.topLinks.slice(0, 5).map((link, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg text-white font-black uppercase text-[10px]" style={{ backgroundColor: link.colorVeren }}>{link.veren}</span>
                        <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                        <span className="px-3 py-1 rounded-lg text-white font-black uppercase text-[10px]" style={{ backgroundColor: link.colorAlan }}>{link.alan}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-blue-600 text-sm block">{link.ton.toLocaleString()} {getUnitSuffix()}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">₺{link.tasarruf.toLocaleString()} Tasarruf</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PANEL 4: Hiperlokalite & Altyapı Geri Dönüşü - Mesafe, Su, Emisyon & Amortisman */}
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col relative group">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3"><Route className="w-6 h-6 text-blue-600" /> Bölgesel Erişim & Altyapı Geri Dönüşü</h3>
                <button onClick={() => setExpandedPanel('infra-roi')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200" title="Detaylı Altyapı Analizine Git"><Maximize2 className="w-4 h-4 text-blue-600" /></button>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4 content-center">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Ortalama Taşıma Mesafesi</span>
                  <span className="text-2xl font-black text-blue-600">{formatDistance(periodImpact.avgDistKm)}</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">Kuş uçuşu, su miktarına göre ağırlıklı</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Tasarruf Edilen Su</span>
                  <span className="text-2xl font-black text-cyan-600">{periodImpact.totalTon.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ton</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">{getPeriodLabel()}, {periodImpact.transferCount.toLocaleString('tr-TR')} aktarım</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Azaltılan Emisyon</span>
                  <span className="text-2xl font-black text-emerald-600">{periodImpact.co2Ton.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ton CO₂</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">{getPeriodLabel()} net kazanç</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Amortisman Süresi</span>
                  <span className="text-2xl font-black text-purple-600">{infraPlan ? formatPayback(infraPlan.paybackMonths) : '—'}</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">2027 yılı baz alınarak, seçili dönemden bağımsız</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}