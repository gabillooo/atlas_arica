import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/leaflet-custom.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  Home, Search, MapPin, FileText, Settings, User,
  ChevronRight, X, AlertTriangle, TrendingUp, Ruler, Calendar,
  Pencil, Trash2,
} from 'lucide-react';

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
});

/* ── Types ─────────────────────────────────────────────────── */
type Status = 'good' | 'warning' | 'critical';
type View   = 'inicio' | 'buscar' | 'mapa' | 'reportes' | 'config';

interface Seg {
  id: string; street: string; sector: string; status: Status;
  date: string; priority: number; damageType: string;
  length: number; width: number;
  sLat: number; sLng: number; eLat: number; eLng: number;
}

const COLOR: Record<Status, string> = { critical:'#EF4444', warning:'#F59E0B', good:'#10B981' };
const LABEL: Record<Status, string> = { critical:'Crítico', warning:'Alerta', good:'Bueno' };
const SECTORS   = ['SECTOR CENTRO','SECTOR NORTE','SECTOR SUR','SECTOR COSTANERA','SECTOR ESTE'];
const DMG_TYPES = ['Bache profundo','Bache superficial','Grietas longitudinales','Grietas transversales',
  'Grietas piel de cocodrilo','Hundimiento','Hundimiento severo','Deformación del pavimento',
  'Desprendimiento de carpeta','Mantenimiento preventivo','Recién pavimentado','Estado óptimo'];

/* ── Coordenadas corregidas según OpenStreetMap Arica ──────── */
// Centro referencia: Plaza Colón -18.4749, -70.3101
// Eje costero (oeste): ~-70.322  |  Eje este: ~-70.295
// Norte ciudad: ~-18.460        |  Sur ciudad: ~-18.490
const INITIAL_DATA: Seg[] = [
  // Av. Comandante San Martín — costanera, corre N-S paralela al mar (muy al oeste)
  { id:'1',  street:'Av. Comandante San Martín', sector:'SECTOR COSTANERA', status:'critical', date:'2026-05-03', priority:9.2, damageType:'Bache profundo',            length:500, width:14, sLat:-18.4720, sLng:-70.3220, eLat:-18.4800, eLng:-70.3220 },
  // Av. 21 de Mayo — eje E-O comercial del centro, pasa frente al terminal de buses
  { id:'2',  street:'Av. 21 de Mayo',            sector:'SECTOR CENTRO',    status:'warning',  date:'2026-05-01', priority:7.5, damageType:'Grietas longitudinales',    length:700, width:12, sLat:-18.4755, sLng:-70.3165, eLat:-18.4755, eLng:-70.3040 },
  // Av. General Velásquez — E-O, paralela a 21 de Mayo, 3 cuadras al sur
  { id:'3',  street:'Av. General Velásquez',     sector:'SECTOR CENTRO',    status:'good',     date:'2026-04-28', priority:3.1, damageType:'Mantenimiento preventivo',  length:580, width:14, sLat:-18.4785, sLng:-70.3155, eLat:-18.4785, eLng:-70.3050 },
  // Calle Sotomayor — N-S, entre Baquedano y 21 de Mayo
  { id:'4',  street:'Calle Sotomayor',           sector:'SECTOR CENTRO',    status:'warning',  date:'2026-05-04', priority:6.8, damageType:'Deformación del pavimento', length:280, width:10, sLat:-18.4735, sLng:-70.3118, eLat:-18.4785, eLng:-70.3118 },
  // Calle Patricio Lynch — N-S, una cuadra al oeste de Sotomayor
  { id:'5',  street:'Calle Patricio Lynch',      sector:'SECTOR CENTRO',    status:'critical', date:'2026-05-06', priority:8.5, damageType:'Hundimiento',               length:280, width:10, sLat:-18.4735, sLng:-70.3135, eLat:-18.4785, eLng:-70.3135 },
  // Av. Diego Portales — E-O, sector norte de la ciudad
  { id:'6',  street:'Av. Diego Portales',        sector:'SECTOR NORTE',     status:'warning',  date:'2026-05-02', priority:5.8, damageType:'Grietas transversales',     length:600, width:12, sLat:-18.4648, sLng:-70.3130, eLat:-18.4648, eLng:-70.3040 },
  // Av. Santa María — E-O, paralela a Velásquez más al sur
  { id:'7',  street:'Av. Santa María',           sector:'SECTOR CENTRO',    status:'good',     date:'2026-04-25', priority:2.3, damageType:'Estado óptimo',             length:500, width:12, sLat:-18.4800, sLng:-70.3145, eLat:-18.4800, eLng:-70.3050 },
  // Calle Baquedano — peatonal histórica E-O, muy cerca de Plaza Colón
  { id:'8',  street:'Calle Baquedano',           sector:'SECTOR CENTRO',    status:'critical', date:'2026-05-07', priority:9.5, damageType:'Grietas piel de cocodrilo',length:420, width: 9, sLat:-18.4752, sLng:-70.3155, eLat:-18.4752, eLng:-70.3082 },
  // Calle Colón — N-S, cruza Plaza Colón (-18.4749, -70.3101)
  { id:'9',  street:'Calle Colón',               sector:'SECTOR CENTRO',    status:'warning',  date:'2026-05-05', priority:6.2, damageType:'Desprendimiento de carpeta',length:350, width: 8, sLat:-18.4725, sLng:-70.3101, eLat:-18.4788, eLng:-70.3101 },
  // Av. Capitán Ávalos — E-O, sector sur
  { id:'10', street:'Av. Capitán Ávalos',        sector:'SECTOR SUR',       status:'good',     date:'2026-04-20', priority:1.8, damageType:'Recién pavimentado',        length:500, width:14, sLat:-18.4845, sLng:-70.3145, eLat:-18.4845, eLng:-70.3055 },
  // Calle 18 de Septiembre — E-O, entre Baquedano y 21 de Mayo
  { id:'11', street:'Calle 18 de Septiembre',    sector:'SECTOR CENTRO',    status:'warning',  date:'2026-05-08', priority:7.2, damageType:'Baches múltiples',          length:380, width: 9, sLat:-18.4770, sLng:-70.3150, eLat:-18.4770, eLng:-70.3080 },
  // Av. Máximo Lira — E-O, sector norte (más al norte que Portales)
  { id:'12', street:'Av. Máximo Lira',           sector:'SECTOR NORTE',     status:'critical', date:'2026-05-09', priority:8.8, damageType:'Hundimiento severo',        length:550, width:12, sLat:-18.4625, sLng:-70.3140, eLat:-18.4625, eLng:-70.3055 },
  // Calle Yungay — E-O, sector sur profundo
  { id:'13', street:'Calle Yungay',              sector:'SECTOR SUR',       status:'critical', date:'2026-05-10', priority:8.1, damageType:'Grietas piel de cocodrilo',length:400, width:10, sLat:-18.4862, sLng:-70.3125, eLat:-18.4862, eLng:-70.3048 },
  // Calle Maipú — E-O, entre Colón y Baquedano
  { id:'14', street:'Calle Maipú',               sector:'SECTOR CENTRO',    status:'warning',  date:'2026-05-11', priority:5.4, damageType:'Grietas longitudinales',    length:380, width:10, sLat:-18.4760, sLng:-70.3082, eLat:-18.4760, eLng:-70.3015 },
  // Av. España — E-O, entre Velásquez y Santa María
  { id:'15', street:'Av. España',                sector:'SECTOR CENTRO',    status:'good',     date:'2026-04-15', priority:2.0, damageType:'Mantenimiento preventivo',  length:460, width:14, sLat:-18.4792, sLng:-70.3155, eLat:-18.4792, eLng:-70.3060 },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CL');

/* ── Shared form field styles ──────────────────────────────── */
const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none';

/* ── Map ───────────────────────────────────────────────────── */
function AricaMap({ segs, selected, onSelect }: { segs: Seg[]; selected: string|null; onSelect:(s:Seg)=>void }) {
  const mapRef  = useRef<L.Map|null>(null);
  const divRef  = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Map<string, L.Polyline>>(new Map());

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    mapRef.current = L.map(divRef.current).setView([-18.4750, -70.3100], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    linesRef.current.forEach(l => l.remove());
    linesRef.current.clear();
    segs.forEach(seg => {
      const sel = seg.id === selected;
      const line = L.polyline([[seg.sLat, seg.sLng],[seg.eLat, seg.eLng]], {
        color: COLOR[seg.status], weight: sel ? 10 : 7, opacity: sel ? 1 : 0.75,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map);
      line.bindPopup(`<b style="font-size:13px">${seg.street}</b><br>
        <span style="color:#666;font-size:12px">${seg.sector}</span><br><br>
        <span style="font-size:12px">
          <b>Estado:</b> ${LABEL[seg.status]}<br>
          <b>Tipo:</b> ${seg.damageType}<br>
          <b>Tramo:</b> ${seg.length}m × ${seg.width}m<br>
          <b>Prioridad:</b> ${seg.priority.toFixed(1)}/10
        </span>`);
      line.on('click', () => onSelect(seg));
      line.on('mouseover', function() { this.setStyle({ weight: 12, opacity: 1 }); });
      line.on('mouseout',  function() { this.setStyle({ weight: sel ? 10 : 7, opacity: sel ? 1 : 0.75 }); });
      linesRef.current.set(seg.id, line);
    });
    if (segs.length > 0) {
      const pts = segs.flatMap(s => [[s.sLat, s.sLng],[s.eLat, s.eLng]]) as [number,number][];
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    }
  }, [segs, selected, onSelect]);

  return <div ref={divRef} className="w-full h-full" />;
}

/* ── Edit modal ────────────────────────────────────────────── */
function EditModal({ seg, onClose, onSave }: { seg: Seg; onClose:()=>void; onSave:(s:Seg)=>void }) {
  const [f, setF] = useState({
    street: seg.street, sector: seg.sector, status: seg.status as Status,
    damageType: seg.damageType, length: String(seg.length), width: String(seg.width),
    priority: String(seg.priority), date: seg.date,
    sLat: String(seg.sLat), sLng: String(seg.sLng),
    eLat: String(seg.eLat), eLng: String(seg.eLng),
  });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...seg,
      street: f.street.trim(), sector: f.sector, status: f.status,
      damageType: f.damageType,
      length:   parseFloat(f.length)   || seg.length,
      width:    parseFloat(f.width)    || seg.width,
      priority: parseFloat(f.priority) || seg.priority,
      date: f.date,
      sLat: parseFloat(f.sLat) || seg.sLat, sLng: parseFloat(f.sLng) || seg.sLng,
      eLat: parseFloat(f.eLat) || seg.eLat, eLng: parseFloat(f.eLng) || seg.eLng,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100 z-10">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Editar Tramo</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          {/* Calle y sector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Calle / Avenida *</label>
              <input required list="edit-streets" value={f.street} onChange={e=>set('street',e.target.value)}
                className={INPUT} placeholder="Av. 21 de Mayo" />
              <datalist id="edit-streets">
                {INITIAL_DATA.map(s=><option key={s.id} value={s.street}/>)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sector *</label>
              <select required value={f.sector} onChange={e=>set('sector',e.target.value)} className={INPUT}>
                <option value="">Seleccionar…</option>
                {SECTORS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Estado del Tramo *</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['good',     'Bueno',   'border-green-400 bg-green-50 text-green-800'],
                ['warning',  'Alerta',  'border-yellow-400 bg-yellow-50 text-yellow-800'],
                ['critical', 'Crítico', 'border-red-400 bg-red-50 text-red-800'],
              ] as [Status,string,string][]).map(([v,l,cls])=>(
                <button key={v} type="button" onClick={()=>set('status',v)}
                  className={`py-2 text-sm font-semibold rounded-lg border-2 transition-all ${f.status===v ? cls : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de deterioro */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Deterioro *</label>
            <select required value={f.damageType} onChange={e=>set('damageType',e.target.value)} className={INPUT}>
              <option value="">Seleccionar…</option>
              {DMG_TYPES.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>

          {/* Dimensiones y prioridad */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Longitud (m)</label>
              <input type="number" min="1" value={f.length} onChange={e=>set('length',e.target.value)}
                className={INPUT} placeholder="150" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ancho (m)</label>
              <input type="number" min="1" value={f.width} onChange={e=>set('width',e.target.value)}
                className={INPUT} placeholder="10" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prioridad (0–10)</label>
              <input type="number" min="0" max="10" step="0.1" value={f.priority} onChange={e=>set('priority',e.target.value)}
                className={INPUT} placeholder="5.0" />
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de Inspección</label>
            <input type="date" value={f.date} onChange={e=>set('date',e.target.value)} className={INPUT} />
          </div>

          {/* Coordenadas GPS */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" /> Coordenadas GPS del Tramo
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-gray-500 font-medium mb-1.5">Punto de inicio</p>
                <input type="text" value={f.sLat} onChange={e=>set('sLat',e.target.value)}
                  placeholder="Latitud  ej: -18.4752" className={`${INPUT} mb-1.5 font-mono text-xs`} />
                <input type="text" value={f.sLng} onChange={e=>set('sLng',e.target.value)}
                  placeholder="Longitud ej: -70.3155" className={`${INPUT} font-mono text-xs`} />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium mb-1.5">Punto final</p>
                <input type="text" value={f.eLat} onChange={e=>set('eLat',e.target.value)}
                  placeholder="Latitud  ej: -18.4752" className={`${INPUT} mb-1.5 font-mono text-xs`} />
                <input type="text" value={f.eLng} onChange={e=>set('eLng',e.target.value)}
                  placeholder="Longitud ej: -70.3082" className={`${INPUT} font-mono text-xs`} />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Detail modal ──────────────────────────────────────────── */
function DetailModal({ seg, onClose, onReport, onEdit, onDelete }: {
  seg: Seg; onClose:()=>void; onReport:()=>void; onEdit:()=>void; onDelete:()=>void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const area   = seg.length * seg.width;
  const pColor = seg.priority >= 8 ? 'text-red-600' : seg.priority >= 5 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{seg.street}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{seg.sector}</p>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button onClick={onEdit} title="Editar tramo"
              className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={()=>setConfirmDel(true)} title="Eliminar tramo"
              className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg ml-1">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Confirm delete */}
        {confirmDel ? (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">¿Eliminar este tramo?</p>
                <p className="text-xs text-red-600 mt-1">
                  Se eliminará <strong>{seg.street}</strong> permanentemente. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmDel(false)}
                className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={()=>{ onDelete(); onClose(); }}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
                Sí, eliminar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: COLOR[seg.status] }}>
                {LABEL[seg.status]} · {seg.damageType}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {([
                  { icon: Ruler,      label: 'Dimensiones', val: `${seg.length}m × ${seg.width}m`, sub: `${area.toLocaleString()} m²` },
                  { icon: TrendingUp, label: 'Prioridad',   val: <span className={`text-xl font-black ${pColor}`}>{seg.priority.toFixed(1)}</span>, sub: 'sobre 10' },
                  { icon: Calendar,   label: 'Inspección',  val: fmtDate(seg.date), sub: '' },
                  { icon: MapPin,     label: 'Coordenadas', val: `${seg.sLat.toFixed(4)}, ${seg.sLng.toFixed(4)}`, sub: `→ ${seg.eLat.toFixed(4)}, ${seg.eLng.toFixed(4)}` },
                ] as { icon:any; label:string; val:any; sub:string }[]).map(({ icon: Icon, label, val, sub }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{val}</p>
                    {sub && <p className="text-[11px] text-gray-400 font-mono">{sub}</p>}
                  </div>
                ))}
              </div>
              {seg.status === 'critical' && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">Requiere <strong>atención urgente</strong>. Se recomienda intervención inmediata.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={onEdit}
                className="flex-1 py-2.5 text-sm border border-blue-300 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 flex items-center justify-center gap-1.5">
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button onClick={()=>{ onClose(); onReport(); }}
                className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                Crear Reporte
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Report modal ──────────────────────────────────────────── */
function ReportModal({ segs, onClose }: { segs: Seg[]; onClose:()=>void }) {
  const [f, setF] = useState({ street:'', sector:'', damageType:'', severity:'moderado', desc:'' });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Reporte enviado:\n${f.street} (${f.sector})\nTipo: ${f.damageType} · ${f.severity}`);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Nuevo Reporte de Tramo</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Calle *</label>
              <input required list="rep-streets" value={f.street} onChange={e=>set('street',e.target.value)}
                placeholder="Av. 21 de Mayo" className={INPUT} />
              <datalist id="rep-streets">{segs.map(s=><option key={s.id} value={s.street}/>)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sector *</label>
              <select required value={f.sector} onChange={e=>set('sector',e.target.value)} className={INPUT}>
                <option value="">Seleccionar…</option>
                {SECTORS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Deterioro *</label>
            <select required value={f.damageType} onChange={e=>set('damageType',e.target.value)} className={INPUT}>
              <option value="">Seleccionar…</option>
              {DMG_TYPES.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Severidad</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['leve',     'Leve',     'border-green-400 bg-green-50 text-green-800'],
                ['moderado', 'Moderado', 'border-yellow-400 bg-yellow-50 text-yellow-800'],
                ['grave',    'Grave',    'border-red-400 bg-red-50 text-red-800'],
              ] as [string,string,string][]).map(([v,l,cls])=>(
                <button key={v} type="button" onClick={()=>set('severity',v)}
                  className={`py-2 text-sm font-medium rounded-lg border-2 transition-all ${f.severity===v ? cls : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
            <textarea value={f.desc} onChange={e=>set('desc',e.target.value)} rows={3}
              placeholder="Describe el estado del tramo…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit"
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Enviar Reporte</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main App ──────────────────────────────────────────────── */
export default function App() {
  const [segs,       setSegs]     = useState<Seg[]>(INITIAL_DATA);
  const [view,       setView]     = useState<View>('mapa');
  const [selected,   setSelected] = useState<Seg|null>(null);
  const [showDetail, setDetail]   = useState(false);
  const [showEdit,   setEdit]     = useState(false);
  const [showReport, setReport]   = useState(false);
  const [query,      setQuery]    = useState('');

  const filtered = segs.filter(s =>
    s.street.toLowerCase().includes(query.toLowerCase()) ||
    s.sector.toLowerCase().includes(query.toLowerCase()) ||
    s.damageType.toLowerCase().includes(query.toLowerCase())
  );

  const selectSeg  = (s: Seg) => { setSelected(s); setDetail(false); setEdit(false); };

  const handleEdit = (updated: Seg) => {
    setSegs(p => p.map(s => s.id === updated.id ? updated : s));
    setSelected(updated);
    setEdit(false);
  };

  const handleDelete = (id: string) => {
    setSegs(p => p.filter(s => s.id !== id));
    setSelected(null);
    setDetail(false);
  };

  const navItems: { id: View; icon: any; title: string }[] = [
    { id:'inicio',   icon:Home,     title:'Inicio' },
    { id:'buscar',   icon:Search,   title:'Buscar' },
    { id:'mapa',     icon:MapPin,   title:'Mapa' },
    { id:'reportes', icon:FileText, title:'Reportes' },
  ];

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Modals */}
      {showReport && <ReportModal segs={segs} onClose={()=>setReport(false)} />}
      {showEdit && selected && (
        <EditModal seg={selected} onClose={()=>setEdit(false)} onSave={handleEdit} />
      )}
      {showDetail && selected && (
        <DetailModal
          seg={selected}
          onClose={()=>setDetail(false)}
          onReport={()=>setReport(true)}
          onEdit={()=>{ setDetail(false); setEdit(true); }}
          onDelete={()=>handleDelete(selected.id)}
        />
      )}

      {/* Sidebar nav */}
      <nav className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-1 flex-shrink-0 z-10">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        {navItems.map(({ id, icon: Icon, title }) => (
          <button key={id} onClick={()=>setView(id)} title={title}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${view===id ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Icon className="w-5 h-5" />
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={()=>setView('config')} title="Configuración"
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${view==='config' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>
          <Settings className="w-5 h-5" />
        </button>
        <button className="w-12 h-12 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100" title="Usuario">
          <User className="w-5 h-5" />
        </button>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-5 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-gray-900">ATLAS Arica</h1>
            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">PP10 Etapa I</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar calle o sector…" value={query} onChange={e=>setQuery(e.target.value)}
              className="w-72 pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </header>

        {/* ── VISTA MAPA ── */}
        {view === 'mapa' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 relative overflow-hidden">
                <AricaMap segs={filtered} selected={selected?.id ?? null} onSelect={selectSeg} />

                {/* Leyenda */}
                <div className="absolute top-3 left-3 bg-white rounded-lg shadow px-3 py-2.5 border border-gray-200 z-[1000] pointer-events-none">
                  <p className="text-[11px] font-semibold text-gray-700 mb-1.5">Estado del Pavimento</p>
                  {(['good','warning','critical'] as Status[]).map(s => (
                    <div key={s} className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-5 h-2 rounded-full" style={{ backgroundColor: COLOR[s] }} />
                      <span className="text-[11px] text-gray-600">{LABEL[s]}</span>
                    </div>
                  ))}
                </div>

                {/* Botón reporte */}
                <button onClick={()=>setReport(true)}
                  className="absolute bottom-4 right-4 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-colors z-[1000]">
                  <FileText className="w-4 h-4" /> Nuevo Reporte
                </button>

                {/* Card tramo seleccionado */}
                {selected && (
                  <div className="absolute top-3 right-3 bg-white rounded-xl shadow-xl p-4 border border-gray-200 z-[1000]" style={{width:256}}>
                    {/* Acciones rápidas */}
                    <div className="absolute top-2 right-2 flex items-center gap-0.5">
                      <button onClick={()=>setEdit(true)} title="Editar"
                        className="p-1.5 hover:bg-blue-50 text-blue-400 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={()=>{ handleDelete(selected.id); }} title="Eliminar"
                        className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                        onClickCapture={e => {
                          if (!window.confirm(`¿Eliminar "${selected.street}"?`)) e.stopPropagation();
                        }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={()=>setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>

                    <p className="text-sm font-bold text-gray-900 pr-20 leading-tight">{selected.street}</p>
                    <p className="text-xs text-gray-500 mt-0.5 mb-2">{selected.sector}</p>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white mb-3"
                      style={{ backgroundColor: COLOR[selected.status] }}>{LABEL[selected.status]}</span>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><b className="text-gray-800">Tipo:</b> {selected.damageType}</p>
                      <p><b className="text-gray-800">Tramo:</b> {selected.length}m × {selected.width}m</p>
                      <p><b className="text-gray-800">Prioridad:</b> {selected.priority.toFixed(1)}/10</p>
                      <p><b className="text-gray-800">Fecha:</b> {fmtDate(selected.date)}</p>
                    </div>
                    <button onClick={()=>setDetail(true)}
                      className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      Ver Detalles Completos
                    </button>
                  </div>
                )}
              </div>

              {/* Tarjetas inferiores */}
              <div className="h-44 bg-white border-t border-gray-200 flex-shrink-0">
                <div className="h-full flex overflow-x-auto">
                  {filtered.map(seg => (
                    <button key={seg.id} onClick={()=>selectSeg(seg)}
                      className={`flex-shrink-0 w-36 h-full flex flex-col border-r border-gray-100 transition-colors text-left ${selected?.id===seg.id ? 'bg-blue-50 border-l-[3px] border-l-blue-500' : 'hover:bg-gray-50'}`}>
                      <div className="w-full h-1.5" style={{ backgroundColor: COLOR[seg.status] }} />
                      <div className="h-20 bg-gradient-to-br from-gray-200 to-gray-300 relative w-full">
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-white rounded"
                          style={{ backgroundColor: COLOR[seg.status] }}>{LABEL[seg.status]}</span>
                        <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/40 text-white px-1 rounded">
                          P:{seg.priority.toFixed(1)}</span>
                      </div>
                      <div className="px-2 py-1.5 flex-1 flex flex-col justify-between min-h-0">
                        <p className="text-[11px] font-semibold text-gray-900 leading-tight line-clamp-2">{seg.street}</p>
                        <div>
                          <p className="text-[10px] text-gray-500 truncate">{seg.damageType}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(seg.date)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar derecho */}
            <aside className="w-60 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
              <div className="px-4 py-4 border-b border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Resumen</p>
                {(['critical','warning','good'] as Status[]).map(s => {
                  const cnt = segs.filter(d=>d.status===s).length;
                  const cls = s==='critical'?'bg-red-500':s==='warning'?'bg-yellow-500':'bg-green-500';
                  return (
                    <div key={s} className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${cls}`} />
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full ${cls}`} style={{ width:`${(cnt/segs.length)*100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-4">{cnt}</span>
                      <span className="text-xs text-gray-500 w-14">{LABEL[s]}</span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-gray-400 mt-2 text-center">{segs.length} tramos registrados</p>
              </div>

              {selected ? (
                <div className="px-4 py-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Tramo Seleccionado</p>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{selected.street}</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-3">{selected.sector}</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs mb-3">
                    <div className="bg-gray-50 rounded px-2 py-1.5">
                      <p className="text-[10px] text-gray-400">Estado</p>
                      <p className="font-semibold" style={{ color: COLOR[selected.status] }}>{LABEL[selected.status]}</p>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1.5">
                      <p className="text-[10px] text-gray-400">Prioridad</p>
                      <p className="font-bold text-gray-800">{selected.priority.toFixed(1)}/10</p>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1.5 col-span-2">
                      <p className="text-[10px] text-gray-400">Deterioro</p>
                      <p className="font-medium text-gray-700 truncate">{selected.damageType}</p>
                    </div>
                  </div>
                  {/* Acciones en sidebar */}
                  <div className="flex gap-2 mb-2">
                    <button onClick={()=>setEdit(true)}
                      className="flex-1 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 flex items-center justify-center gap-1">
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    <button onClick={()=>setDetail(true)}
                      className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1">
                      Ver <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-400">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-25" />
                  <p className="text-xs">Selecciona un tramo<br />del mapa o de las<br />tarjetas inferiores</p>
                </div>
              )}

              <div className="px-4 py-3 mt-auto border-t border-gray-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">Atención urgente:</span>{' '}
                    {segs.filter(d=>d.status==='critical').length} tramos críticos
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── VISTA BUSCAR ── */}
        {view === 'buscar' && (
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Buscar Calles</h2>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Nombre, sector o tipo de deterioro…"
                  value={query} onChange={e=>setQuery(e.target.value)} autoFocus
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-gray-400 mt-2">{filtered.length} resultado{filtered.length!==1?'s':''}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2 max-w-2xl">
                {filtered.map(seg => (
                  <div key={seg.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <button onClick={()=>{ selectSeg(seg); setView('mapa'); }} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR[seg.status] }} />
                        <p className="text-sm font-bold text-gray-900 truncate">{seg.street}</p>
                      </button>
                      <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                        <span className="text-[11px] font-semibold text-white px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: COLOR[seg.status] }}>{LABEL[seg.status]}</span>
                        <button onClick={()=>{ selectSeg(seg); setEdit(true); }} title="Editar"
                          className="p-1.5 hover:bg-blue-50 text-blue-400 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={()=>{ if(window.confirm(`¿Eliminar "${seg.street}"?`)) handleDelete(seg.id); }} title="Eliminar"
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-4">{seg.sector} · {seg.damageType} · P:{seg.priority.toFixed(1)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VISTA REPORTES ── */}
        {view === 'reportes' && (
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Reportes de Tramos</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ordenados por prioridad</p>
              </div>
              <button onClick={()=>setReport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                <FileText className="w-4 h-4" /> Nuevo Reporte
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2 max-w-2xl">
                {[...segs].sort((a,b)=>b.priority-a.priority).map((seg,i) => (
                  <div key={seg.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-500">#{i+1}</span>
                      </div>
                      <button onClick={()=>{ selectSeg(seg); setView('mapa'); }} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold text-gray-900 truncate">{seg.street}</p>
                        <p className="text-xs text-gray-500">{seg.sector} · {seg.damageType} · {fmtDate(seg.date)}</p>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex flex-col items-end gap-1 mr-1">
                          <span className="text-[11px] font-semibold text-white px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: COLOR[seg.status] }}>{LABEL[seg.status]}</span>
                          <span className="text-xs font-bold text-gray-600">P:{seg.priority.toFixed(1)}</span>
                        </div>
                        <button onClick={()=>{ selectSeg(seg); setEdit(true); }} title="Editar"
                          className="p-1.5 hover:bg-blue-50 text-blue-400 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={()=>{ if(window.confirm(`¿Eliminar "${seg.street}"?`)) handleDelete(seg.id); }} title="Eliminar"
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VISTA INICIO ── */}
        {view === 'inicio' && (
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Panel de Control</h2>
                <p className="text-sm text-gray-500">ATLAS Arica – PP10 Etapa I</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {([
                  ['critical','text-red-600','bg-red-50 border-red-100','Críticos'],
                  ['warning','text-yellow-600','bg-yellow-50 border-yellow-100','En Alerta'],
                  ['good','text-green-600','bg-green-50 border-green-100','Buenos'],
                ] as [Status,string,string,string][]).map(([s,tc,bg,l]) => (
                  <div key={s} className={`rounded-xl border p-5 ${bg}`}>
                    <p className={`text-3xl font-black ${tc}`}>{segs.filter(d=>d.status===s).length}</p>
                    <p className="text-sm text-gray-600 mt-1">{l}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <p className="text-sm font-bold text-gray-900">Top 5 Prioridad</p>
                </div>
                {[...segs].sort((a,b)=>b.priority-a.priority).slice(0,5).map((seg,i) => (
                  <div key={seg.id} className="px-5 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-bold text-gray-400 w-4">#{i+1}</span>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR[seg.status] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{seg.street}</p>
                      <p className="text-xs text-gray-500">{seg.damageType}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{seg.priority.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>setView('mapa')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <MapPin className="w-5 h-5" /> Ver en el Mapa
              </button>
            </div>
          </div>
        )}

        {view === 'config' && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Settings className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Configuración</p>
              <p className="text-xs mt-1">Próximamente disponible</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
