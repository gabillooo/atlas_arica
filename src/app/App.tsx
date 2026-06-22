import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Home, Search, MapPin, FileText, Settings, Plus, User,
  ChevronRight, X, Calendar, AlertTriangle, BarChart3, TrendingUp, Clock, Loader2,
  Upload, Trash2, CheckCircle, LogOut, Pencil
} from 'lucide-react';
import { ReportForm } from './components/ReportForm';
import { AricaMap } from './components/AricaMap';
import { fetchStreetsFromOSM, clearStreetCache, loadSegmentsFromStorage, saveSegmentsToStorage } from '../services/streetData';

interface RoadSegment {
  id: string;
  eventCode?: string;
  street: string;
  sector: string;
  status: 'good' | 'warning' | 'critical' | 'repaired';
  date: string;
  priority: number;
  coordinates: [number, number][];
  damageType: string;
  image?: string;
  photos?: string[];
  history?: string[];
  attachments?: string[];
  locationReference?: string;
  length: number;
  width: number;
}

interface SegmentAddPayload {
  coordinates: [number, number][];
}

const metersBetween = ([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) => {
  const latMeters = (lat1 - lat2) * 111_320;
  const lngMeters = (lng1 - lng2) * 111_320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(latMeters, lngMeters);
};

const distancePointToLineMeters = (point: [number, number], start: [number, number], end: [number, number]) => {
  const avgLat = ((point[0] + start[0] + end[0]) / 3) * Math.PI / 180;
  const toXY = ([lat, lng]: [number, number]) => ({
    x: lng * 111_320 * Math.cos(avgLat),
    y: lat * 111_320,
  });

  const p = toXY(point);
  const a = toXY(start);
  const b = toXY(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projected = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(p.x - projected.x, p.y - projected.y);
};

const distancePointToPathMeters = (point: [number, number], path: [number, number][]) => {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return metersBetween(point, path[0]);

  return Math.min(...path.slice(1).map((coord, index) =>
    distancePointToLineMeters(point, path[index], coord)
  ));
};

const distancePathToPathMeters = (drawnPath: [number, number][], roadPath: [number, number][]) => {
  return Math.min(...drawnPath.map(point => distancePointToPathMeters(point, roadPath)));
};

export default function App() {
  const [activeView, setActiveView] = useState<'inicio' | 'buscar' | 'mapa' | 'reportes' | 'config' | 'detalles' | 'perfil'>('mapa');
  const [selectedSegment, setSelectedSegment] = useState<RoadSegment | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RoadSegment['status']>('all');
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [mapFocusRequest, setMapFocusRequest] = useState<{ segmentId: string; requestId: number } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('atlas-authenticated') === 'true');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('atlas-dark-mode') === 'true');
  const [importSummary, setImportSummary] = useState('');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(true);
  const [bottomBannerHeight, setBottomBannerHeight] = useState(() => {
    const savedHeight = Number(localStorage.getItem('atlas-bottom-banner-height'));
    return Number.isFinite(savedHeight) && savedHeight >= 104 && savedHeight <= 190 ? savedHeight : 126;
  });
  const [bottomBannerVisible, setBottomBannerVisible] = useState(() => localStorage.getItem('atlas-bottom-banner-visible') !== 'false');
  const [editingSegment, setEditingSegment] = useState<RoadSegment | null>(null);
  const [editForm, setEditForm] = useState({
    sector: '',
    damageType: '',
    locationReference: '',
    status: 'warning' as RoadSegment['status'],
    length: '',
    width: '',
    priority: '',
    date: '',
  });

  // Cargar calles desde OpenStreetMap o localStorage
  useEffect(() => {
    const loadStreets = async () => {
      setLoading(true);
      try {
        // Primero cargar desde localStorage (datos persistidos)
        const storedSegments = loadSegmentsFromStorage();
        
        const hasOnlyOsmSeed = storedSegments.length > 0 && storedSegments.every(segment => segment.id.startsWith('osm-'));

        if (storedSegments.length > 0 && !hasOnlyOsmSeed) {
          console.log('Usando segmentos desde localStorage');
          setSegments(storedSegments);
        } else {
          console.log('Cargando calles reales desde OpenStreetMap...');
          const data = await fetchStreetsFromOSM(true);
          setSegments(data);
          saveSegmentsToStorage(data);
        }
      } catch (error) {
        console.error('Error loading streets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStreets();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('atlas-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('atlas-bottom-banner-height', String(bottomBannerHeight));
  }, [bottomBannerHeight]);

  useEffect(() => {
    localStorage.setItem('atlas-bottom-banner-visible', String(bottomBannerVisible));
  }, [bottomBannerVisible]);

  const handleNewReport = useCallback((data: any) => {
    const start = data.gpsCoords?.start;

    if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lng)) {
      alert('Para reflejar el evento en el mapa debes ingresar o capturar una coordenada GPS válida.');
      return;
    }

    const statusBySeverity: Record<string, RoadSegment['status']> = {
      leve: 'good',
      moderado: 'warning',
      grave: 'critical',
    };

    const priorityBySeverity: Record<string, number> = {
      leve: 3,
      moderado: 6.5,
      grave: 9,
    };

    const timestamp = Date.now();
    const newSegment: RoadSegment = {
      id: `report-${timestamp}`,
      eventCode: `EV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(timestamp).slice(-4)}`,
      street: data.street || 'Calle por asociar',
      sector: data.sector,
      status: statusBySeverity[data.severity] ?? 'warning',
      date: new Date().toISOString().split('T')[0],
      priority: priorityBySeverity[data.severity] ?? 6,
      coordinates: [[start.lat, start.lng]],
      damageType: data.damageType,
      length: Number(data.segmentLength) || 0,
      width: Number(data.segmentWidth) || 0,
      image: data.photos?.[0],
      photos: data.photos ?? [],
      attachments: data.photos ?? [],
      locationReference: data.startReference || data.description || data.street,
      history: [
        `${new Date().toLocaleString('es-CL')}: Reporte creado`,
        data.description ? `Descripción: ${data.description}` : 'Sin descripción adicional',
      ],
    };

    setSegments((currentSegments) => {
      const updatedSegments = [...currentSegments, newSegment];
      saveSegmentsToStorage(updatedSegments);
      return updatedSegments;
    });
    setSelectedSegment(newSegment);
    setShowReportForm(false);
    alert('Reporte enviado exitosamente');
  }, []);

  const getStatusColor = useCallback((status: RoadSegment['status']) => {
    switch (status) {
      case 'critical': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'good': return '#10B981';
      case 'repaired': return '#6B7280';
    }
  }, []);

  const getStatusLabel = useCallback((status: RoadSegment['status']) => {
    switch (status) {
      case 'critical': return 'Crítico';
      case 'warning': return 'Alerta';
      case 'good': return 'Bueno';
      case 'repaired': return 'Reparado';
    }
  }, []);

  const getEventCode = useCallback((segment: RoadSegment) => {
    if (segment.eventCode) return segment.eventCode;
    if (segment.id.startsWith('report-')) return `EV-${segment.id.replace('report-', '').slice(-6)}`;
    if (segment.id.startsWith('import-')) return `EV-IMP-${segment.id.split('-').slice(-1)[0]}`;
    if (segment.id.startsWith('osm-')) return `REF-${segment.id.replace('osm-', '').slice(-5)}`;
    return `EV-${segment.id.slice(-6).toUpperCase()}`;
  }, []);

  const getEventTitle = useCallback((segment: RoadSegment) => {
    return `${getEventCode(segment)} · ${segment.damageType}`;
  }, [getEventCode]);

  const getEventReference = useCallback((segment: RoadSegment) => {
    return segment.locationReference || segment.street || 'Sin referencia vial';
  }, []);

  const handleSegmentClick = useCallback((segment: RoadSegment) => {
    setSelectedSegment(segment);
    setDetailsPanelOpen(true);
  }, []);

  const handleSegmentFocus = useCallback((segment: RoadSegment) => {
    setSelectedSegment(segment);
    setDetailsPanelOpen(true);
    setActiveView('mapa');
    setMapFocusRequest({ segmentId: segment.id, requestId: Date.now() });
  }, []);

  const handleCloseReportForm = useCallback(() => {
    setShowReportForm(false);
  }, []);

  const handleProfileClick = useCallback(() => {
    setActiveView('perfil');
  }, []);

  const handleLogin = useCallback((event: any) => {
    event.preventDefault();

    if (loginEmail === 'admin@atlas.cl' && loginPassword === 'atlas2026') {
      localStorage.setItem('atlas-authenticated', 'true');
      setIsAuthenticated(true);
      setLoginError('');
      setLoginAttempts(0);
      return;
    }

    const nextAttempts = loginAttempts + 1;
    setLoginAttempts(nextAttempts);
    setLoginError(nextAttempts >= 3
      ? 'Credenciales inválidas. Se alcanzaron 3 intentos fallidos.'
      : `Credenciales inválidas. Intento ${nextAttempts} de 3.`
    );
  }, [loginAttempts, loginEmail, loginPassword]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('atlas-authenticated');
    setIsAuthenticated(false);
    setLoginPassword('');
    setSelectedSegment(null);
  }, []);

  const handleReloadStreets = useCallback(async () => {
    clearStreetCache();
    setLoading(true);
    try {
      const data = await fetchStreetsFromOSM(true);
      setSegments(data);
      saveSegmentsToStorage(data);
    } catch (error) {
      console.error('Error loading streets from OSM:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddSegment = useCallback(({ coordinates }: SegmentAddPayload) => {
    const timestamp = Date.now();
    const nearbyRoads = segments
      .filter(segment => segment.id.startsWith('osm-') && segment.coordinates.length > 0)
      .map(segment => ({
        segment,
        distance: distancePathToPathMeters(coordinates, segment.coordinates),
      }))
      .filter(item => item.distance <= (coordinates.length > 1 ? 45 : 32))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    const roadNames = Array.from(new Set(nearbyRoads.map(item => item.segment.street).filter(Boolean)));
    const reference = coordinates.length > 1
      ? roadNames.length > 0
        ? `Tramo dibujado cerca de ${roadNames.join(' / ')}`
        : 'Tramo dibujado manualmente'
      : roadNames.length > 0
        ? `Punto localizado cerca de ${roadNames[0]}`
        : 'Punto seleccionado en mapa';

    const drawnLength = coordinates.length > 1 ? metersBetween(coordinates[0], coordinates[coordinates.length - 1]) : 0;
    const closestRoad = nearbyRoads[0]?.segment;
    const newSegment: RoadSegment = {
      id: `custom-${timestamp}`,
      eventCode: `EV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(timestamp).slice(-4)}`,
      street: roadNames[0] ?? 'Calle por asociar',
      sector: closestRoad?.sector ?? 'SECTOR CENTRO',
      status: 'critical',
      date: new Date().toISOString().split('T')[0],
      priority: 8.0,
      coordinates,
      damageType: coordinates.length > 1 ? 'Tramo deteriorado dibujado' : 'Bache reportado',
      locationReference: reference,
      length: coordinates.length > 1 ? Math.max(1, Math.round(drawnLength)) : 1,
      width: 5
    };
    
    setSegments((currentSegments) => {
      const updatedSegments = [...currentSegments, newSegment];
      saveSegmentsToStorage(updatedSegments);
      return updatedSegments;
    });
    console.log('Bache agregado:', newSegment);
  }, [segments]);

  const handleDeleteSegment = useCallback((segmentId: string) => {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;

    setSegments((currentSegments) => {
      const updatedSegments = currentSegments.filter(s => s.id !== segmentId);
      saveSegmentsToStorage(updatedSegments);
      return updatedSegments;
    });
    if (selectedSegment?.id === segmentId) {
      setSelectedSegment(null);
      setActiveView('mapa');
    }
    console.log('Bache eliminado:', segmentId);
  }, [selectedSegment]);

  const updateSegment = useCallback((segmentId: string, updates: Partial<RoadSegment>) => {
    setSegments((currentSegments) => {
      const updatedSegments = currentSegments.map(segment => {
        if (segment.id !== segmentId) return segment;

        return {
          ...segment,
          ...updates,
          history: [
            ...(segment.history ?? []),
            `${new Date().toISOString()}: Registro actualizado`,
          ],
        };
      });
      saveSegmentsToStorage(updatedSegments);
      const updatedSelected = updatedSegments.find(segment => segment.id === segmentId) ?? null;
      setSelectedSegment(updatedSelected);
      return updatedSegments;
    });
  }, []);

  const handleEditSegment = useCallback((segmentToEdit: RoadSegment) => {
    setEditingSegment(segmentToEdit);
    setEditForm({
      sector: segmentToEdit.sector,
      damageType: segmentToEdit.damageType,
      locationReference: segmentToEdit.locationReference ?? '',
      status: segmentToEdit.status,
      length: String(segmentToEdit.length),
      width: String(segmentToEdit.width),
      priority: String(segmentToEdit.priority),
      date: segmentToEdit.date,
    });
  }, []);

  const handleCloseEditSegment = useCallback(() => {
    setEditingSegment(null);
  }, []);

  const handleSubmitEditSegment = useCallback((event: any) => {
    event.preventDefault();
    if (!editingSegment) return;

    const length = Number(editForm.length);
    const width = Number(editForm.width);
    const priority = Number(editForm.priority);

    if (
      !editForm.sector.trim() ||
      !editForm.damageType.trim() ||
      !Number.isFinite(length) ||
      !Number.isFinite(width) ||
      !Number.isFinite(priority) ||
      length < 0 ||
      width < 0
    ) {
      alert('Completa sector, tipo de daño, tamaño, ancho y prioridad con valores válidos.');
      return;
    }

    updateSegment(editingSegment.id, {
      sector: editForm.sector.trim(),
      damageType: editForm.damageType.trim(),
      locationReference: editForm.locationReference.trim() || editingSegment.locationReference || editingSegment.street,
      status: editForm.status,
      length,
      width,
      priority: Math.min(10, Math.max(0, priority)),
      date: editForm.date || editingSegment.date,
    });
    setEditingSegment(null);
  }, [editForm, editingSegment, updateSegment]);

  const handleEditSelectedSegment = useCallback(() => {
    if (!selectedSegment) return;
    handleEditSegment(selectedSegment);
  }, [handleEditSegment, selectedSegment]);

  const handleMarkRepaired = useCallback((segmentId: string) => {
    updateSegment(segmentId, {
      status: 'repaired',
      damageType: 'Reparado',
      priority: 0,
    });
  }, [updateSegment]);

  const parseSeverity = useCallback((value: string): RoadSegment['status'] | null => {
    const normalized = value.trim().toLowerCase();
    if (['bajo', 'leve', 'good', 'verde'].includes(normalized)) return 'good';
    if (['medio', 'moderado', 'warning', 'alerta', 'amarillo'].includes(normalized)) return 'warning';
    if (['critico', 'crítico', 'grave', 'critical', 'rojo'].includes(normalized)) return 'critical';
    if (['reparado', 'repaired', 'gris'].includes(normalized)) return 'repaired';
    return null;
  }, []);

  const handleHistoricalImport = useCallback((event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = text.split(/\r?\n/).filter(Boolean);
      const headers = rows[0]?.split(/[;,]/).map(header => header.trim().toLowerCase()) ?? [];
      const requiredColumns = ['lat', 'long', 'severidad', 'fecha'];
      const missingColumns = requiredColumns.filter(column => !headers.includes(column));

      if (missingColumns.length > 0) {
        setImportSummary(`Formato inválido. Faltan columnas: ${missingColumns.join(', ')}.`);
        return;
      }

      const existingCoords = new Set(segments.flatMap(segment =>
        segment.coordinates.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`)
      ));
      const importedCoords = new Set<string>();
      const importedSegments: RoadSegment[] = [];
      let failed = 0;
      let duplicates = 0;

      rows.slice(1).forEach((row, index) => {
        const values = row.split(/[;,]/).map(value => value.trim());
        const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? '']));
        const lat = Number(record.lat);
        const lng = Number(record.long);
        const status = parseSeverity(record.severidad);
        const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !status || !record.fecha) {
          failed += 1;
          return;
        }

        if (existingCoords.has(coordKey) || importedCoords.has(coordKey)) {
          duplicates += 1;
          return;
        }

        importedCoords.add(coordKey);
        importedSegments.push({
          id: `import-${Date.now()}-${index}`,
          street: record.calle || 'Registro histórico',
          sector: record.sector || 'SECTOR SIN CLASIFICAR',
          status,
          date: record.fecha,
          priority: status === 'critical' ? 9 : status === 'warning' ? 6 : status === 'good' ? 3 : 0,
          coordinates: [[lat, lng]],
          damageType: record.dano || record.daño || 'Dato histórico importado',
          length: Number(record.largo) || 10,
          width: Number(record.ancho) || 5,
          history: [`${new Date().toLocaleString('es-CL')}: Importado desde ${file.name}`],
        });
      });

      if (duplicates > 0 && !confirm(`Se detectaron ${duplicates} registros duplicados por coordenadas. Se omitirán y se importará el resto. ¿Continuar?`)) {
        setImportSummary(`Importación cancelada. Duplicados detectados: ${duplicates}.`);
        return;
      }

      setSegments((currentSegments) => {
        const updatedSegments = [...currentSegments, ...importedSegments];
        saveSegmentsToStorage(updatedSegments);
        return updatedSegments;
      });
      setImportSummary(`Importación finalizada: ${importedSegments.length} cargados, ${failed} fallidos, ${duplicates} duplicados omitidos.`);
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [parseSeverity, segments]);

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
  }, []);

  const filteredSegments = useMemo(() => {
    const streetQuery = streetFilter.trim().toLowerCase();
    const generalQuery = searchQuery.trim().toLowerCase();

    return segments.filter(segment => {
      const matchesStatus = statusFilter === 'all' || segment.status === statusFilter;
      const matchesStreet = !streetQuery || segment.street.toLowerCase().includes(streetQuery);
      const matchesSearch = !generalQuery || [
        getEventCode(segment),
        segment.damageType,
        getEventReference(segment),
        segment.street,
        segment.sector,
      ].some(value => value.toLowerCase().includes(generalQuery));

      return matchesStatus && matchesStreet && matchesSearch;
    });
  }, [getEventCode, getEventReference, searchQuery, segments, statusFilter, streetFilter]);

  const criticalCount = useMemo(() => segments.filter(s => s.status === 'critical').length, [segments]);
  const warningCount = useMemo(() => segments.filter(s => s.status === 'warning').length, [segments]);
  const goodCount = useMemo(() => segments.filter(s => s.status === 'good').length, [segments]);

  const toDateKey = (date: Date) => date.toISOString().split('T')[0];

  const parseHistoryDate = (entry: string, fallbackDate: string) => {
    const isoMatch = entry.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (isoMatch) return isoMatch;

    const localMatch = entry.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (localMatch) {
      const [, day, month, year] = localMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return fallbackDate;
  };

  const buildDailyHistory = (segment: RoadSegment) => {
    const rows = [
      {
        date: segment.date,
        label: 'Registro inicial del evento',
        status: segment.status,
        priority: segment.priority,
      },
      ...(segment.history ?? []).map((entry) => ({
        date: parseHistoryDate(entry, segment.date),
        label: entry.replace(/^\d{4}-\d{2}-\d{2}T[^:]+:\s*/, '').trim(),
        status: segment.status,
        priority: segment.priority,
      })),
    ];

    return rows.reduce((grouped, row) => {
      const existing = grouped.get(row.date) ?? [];
      existing.push(row);
      grouped.set(row.date, existing);
      return grouped;
    }, new Map<string, typeof rows>());
  };

  const buildCalendarDays = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; dateKey: string | null; day: number | null }> = [];

    for (let index = 0; index < startOffset; index += 1) {
      cells.push({ key: `empty-${index}`, dateKey: null, day: null });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      cells.push({ key: toDateKey(date), dateKey: toDateKey(date), day });
    }

    return cells;
  };

  // Vista INICIO
  const renderHomeView = () => (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Panel de Control</h2>
        <button
          onClick={handleReloadStreets}
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
        >
          Actualizar referencias
        </button>
      </div>
      
      {/* Estadísticas principales */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-xs text-gray-600">Eventos Críticos</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
              <p className="text-xs text-gray-600">En Alerta</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{goodCount}</p>
              <p className="text-xs text-gray-600">En Buen Estado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Información de la fuente de datos */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800">
          <strong>Eventos registrados:</strong> {segments.length > 0 ? 
            `${segments.length} puntos de evento o referencia` : 
            'Sin eventos cargados'}
        </p>
      </div>

      {/* Últimos reportes */}
      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          ÚLTIMOS REPORTES
        </h3>
        <div className="space-y-2">
          {filteredSegments.slice(0, 5).map(segment => (
            <div
              key={segment.id}
              onClick={() => handleSegmentFocus(segment)}
              className="p-3 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getStatusColor(segment.status) }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{getEventTitle(segment)}</p>
                    <p className="text-xs text-gray-600">{getEventReference(segment)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(segment.date).toLocaleDateString('es-CL')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Vista BUSCAR
  const renderSearchView = () => (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Buscar eventos</h2>
      
      <div className="bg-white rounded-lg border border-gray-300 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, daño, referencia, calle o sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      </div>

      {searchQuery && (
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          <p className="text-sm text-gray-600 mb-3">
            {filteredSegments.length} resultado(s) encontrado(s)
          </p>
          <div className="space-y-2">
            {filteredSegments.map(segment => (
              <div
                key={segment.id}
                onClick={() => {
                  handleSegmentFocus(segment);
                }}
                className="p-3 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getStatusColor(segment.status) }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{getEventTitle(segment)}</p>
                      <p className="text-xs text-gray-600">{getEventReference(segment)}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searchQuery && (
        <div className="bg-white rounded-lg border border-gray-300 p-8 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Escribe para buscar eventos, referencias o sectores</p>
        </div>
      )}
    </div>
  );

  // Vista REPORTES
  const renderReportsView = () => (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Administrar eventos viales</h2>
          <p className="text-sm text-gray-600">Edita gravedad, medidas, evidencia y estado de reparación.</p>
        </div>
        <button
          onClick={() => setShowReportForm(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo Reporte
        </button>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <div className="space-y-3">
          {filteredSegments.map(segment => (
            <div
              key={segment.id}
              onClick={() => handleSegmentFocus(segment)}
              className="p-4 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getStatusColor(segment.status) }}
                    />
                    <h4 className="text-sm font-semibold text-gray-900">{getEventTitle(segment)}</h4>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-600 border border-gray-200">
                      {getStatusLabel(segment.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{segment.damageType}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{segment.sector}</span>
                    <span>{new Date(segment.date).toLocaleDateString('es-CL')}</span>
                    <span>Prioridad: {segment.priority.toFixed(1)}/10</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEditSegment(segment);
                    }}
                    className="flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleMarkRepaired(segment.id);
                    }}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Reparado
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSegment(segment.id);
                    }}
                    className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Vista CONFIG
  // Vista DETALLES
  const renderDetailsView = () => {
    if (!selectedSegment) {
      return (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Detalles del evento vial</h2>
          <div className="bg-white rounded-lg border border-gray-300 p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Selecciona un evento en el mapa para ver sus detalles</p>
          </div>
        </div>
      );
    }

    const dailyHistory = buildDailyHistory(selectedSegment);
    const historyDates = Array.from(dailyHistory.keys()).sort();
    const latestHistoryDate = historyDates[historyDates.length - 1] ?? selectedSegment.date;
    const activeHistoryDate = selectedHistoryDate && dailyHistory.has(selectedHistoryDate)
      ? selectedHistoryDate
      : latestHistoryDate;
    const activeHistoryEntries = dailyHistory.get(activeHistoryDate) ?? [];
    const calendarMonth = new Date(`${activeHistoryDate}T12:00:00`);
    const calendarDays = buildCalendarDays(calendarMonth);
    const monthLabel = calendarMonth.toLocaleDateString('es-CL', {
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Detalles del evento vial</h2>
          <button
            onClick={() => setActiveView('mapa')}
            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-md hover:bg-gray-300"
          >
            Volver al Mapa
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 p-6">
          {/* Header con estado */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{getEventTitle(selectedSegment)}</h3>
              <p className="text-sm text-gray-600">{selectedSegment.sector}</p>
            </div>
            <div
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: getStatusColor(selectedSegment.status) }}
            >
              {getStatusLabel(selectedSegment.status)}
            </div>
          </div>

          {/* Información principal */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Tipo de Daño</p>
              <p className="text-sm font-semibold text-gray-900">{selectedSegment.damageType}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Fecha de Reporte</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(selectedSegment.date).toLocaleDateString('es-CL', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>

          {/* Dimensiones y prioridad */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Longitud</p>
              <p className="text-lg font-bold text-gray-900">{selectedSegment.length}m</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Ancho</p>
              <p className="text-lg font-bold text-gray-900">{selectedSegment.width}m</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Prioridad</p>
              <p className="text-lg font-bold text-gray-900">{selectedSegment.priority.toFixed(1)}/10</p>
            </div>
          </div>

          {/* Coordenadas */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Coordenada exacta del evento</h4>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              <div className="space-y-1">
                {selectedSegment.coordinates.map((coord, index) => (
                  <div key={index} className="text-xs font-mono text-gray-700">
                    <span className="text-gray-500">{index === 0 ? 'GPS' : `Referencia ${index + 1}`}:</span> 
                    {' '}[{coord[0].toFixed(6)}, {coord[1].toFixed(6)}]
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(selectedSegment.photos?.length ?? 0) > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Evidencia Fotográfica</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedSegment.photos?.map((photo, index) => (
                  <img
                    key={photo}
                    src={photo}
                    alt={`Evidencia ${index + 1}`}
                    className="h-28 w-full rounded-lg object-cover border border-gray-200"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-gray-900">Historial diario</h4>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                {historyDates.length} dia(s) con registro
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold capitalize text-gray-900">{monthLabel}</p>
                </div>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-500">
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((dayLabel, index) => (
                    <span key={`${dayLabel}-${index}`}>{dayLabel}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const hasHistory = Boolean(day.dateKey && dailyHistory.has(day.dateKey));
                    const isActive = day.dateKey === activeHistoryDate;

                    return (
                      <button
                        key={day.key}
                        type="button"
                        disabled={!day.dateKey}
                        onClick={() => day.dateKey && hasHistory && setSelectedHistoryDate(day.dateKey)}
                        className={`relative h-9 rounded-md text-xs transition-colors ${
                          !day.dateKey
                            ? 'cursor-default'
                            : isActive
                              ? 'bg-gray-900 text-white'
                              : hasHistory
                                ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                                : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {day.day}
                        {hasHistory && (
                          <span
                            className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                            style={{ backgroundColor: isActive ? '#FFFFFF' : getStatusColor(selectedSegment.status) }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Dia seleccionado</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(`${activeHistoryDate}T12:00:00`).toLocaleDateString('es-CL', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
                    style={{ backgroundColor: getStatusColor(selectedSegment.status) }}
                  >
                    {getStatusLabel(selectedSegment.status)}
                  </span>
                </div>

                <div className="space-y-2">
                  {activeHistoryEntries.map((entry, index) => (
                    <div key={`${entry.label}-${index}`} className="rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Prioridad registrada: {entry.priority.toFixed(1)}/10
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Registro cronologico</h5>
              <div className="space-y-2">
                {(selectedSegment.history?.length ? selectedSegment.history : ['Sin historial registrado']).map((entry, index) => (
                  <p key={`${entry}-${index}`} className="text-xs text-gray-700">{entry}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => {
                setActiveView('mapa');
                setSelectedSegment(selectedSegment);
              }}
              className="bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Ver en Mapa
            </button>
            <button
              onClick={handleEditSelectedSegment}
              className="bg-gray-800 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-900 flex items-center justify-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => handleMarkRepaired(selectedSegment.id)}
              className="bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Reparado
            </button>
            <button
              onClick={() => handleDeleteSegment(selectedSegment.id)}
              className="bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>ID del segmento:</strong> {selectedSegment.id}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Este evento forma parte del sistema de monitoreo vial de Arica. 
            Para reportar cambios o actualizaciones, contacte al administrador.
          </p>
        </div>
      </div>
    );
  };

  const renderProfileView = () => (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Perfil de usuario</h2>
          <p className="mt-1 text-sm text-gray-600">Información general de la sesión y permisos activos.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-lg border border-gray-300 bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <User className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Administrador Demo</h3>
                <p className="text-sm text-gray-600">admin@atlas.cl</p>
                <span className="mt-2 inline-flex rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                  Sesión activa
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between border-t border-gray-200 pt-3">
                <span className="text-gray-600">Rol</span>
                <span className="font-medium text-gray-900">Administrador del sistema</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3">
                <span className="text-gray-600">Tipo de cuenta</span>
                <span className="font-medium text-gray-900">Prueba local</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3">
                <span className="text-gray-600">Último acceso</span>
                <span className="font-medium text-gray-900">{new Date().toLocaleDateString('es-CL')}</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-300 bg-white p-5">
            <h3 className="text-base font-semibold text-gray-900">Permisos habilitados</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                'Visualizar mapa georreferenciado',
                'Crear reportes con coordenadas GPS',
                'Editar severidad y dimensiones',
                'Eliminar registros con confirmación',
                'Importar datos históricos CSV',
                'Consultar historial diario',
              ].map((permission) => (
                <div key={permission} className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span className="text-sm text-gray-700">{permission}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-900">Estado técnico</p>
              <p className="mt-1 text-xs text-blue-700">
                Esta sesión usa autenticación local de demostración. La validación final con Supabase debe conectarse cuando la base de datos esté definida.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  const renderConfigView = () => (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h2>
      
      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">Notificaciones</p>
              <p className="text-xs text-gray-600">Recibir alertas de daños críticos</p>
            </div>
            <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700">
              Activo
            </button>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">Modo Oscuro</p>
              <p className="text-xs text-gray-600">Cambiar tema de la aplicación</p>
            </div>
            <button
              type="button"
              onClick={() => setDarkMode(prev => !prev)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                darkMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {darkMode ? 'Activo' : 'Inactivo'}
            </button>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">Idioma</p>
              <p className="text-xs text-gray-600">Español (Chile)</p>
            </div>
            <span className="text-xs text-gray-500">ES-CL</span>
          </div>

          <div className="py-2 border-b border-gray-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Carga masiva histórica</p>
                <p className="text-xs text-gray-600">CSV con columnas lat, long, severidad y fecha</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
                <Upload className="w-4 h-4" />
                Importar CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleHistoricalImport}
                  className="hidden"
                />
              </label>
            </div>
            {importSummary && (
              <p className="mt-2 text-xs text-gray-700">{importSummary}</p>
            )}
          </div>
          
          <div className="pt-4">
            <p className="text-xs text-gray-500 text-center">
              ATLAS Arica v1.0.0<br />
              Desarrollado con React + Vite<br />
              Datos: OpenStreetMap (Overpass API)
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveView = () => {
    switch (activeView) {
      case 'inicio':
        return renderHomeView();
      case 'buscar':
        return renderSearchView();
      case 'mapa':
        return (
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex h-full min-w-0 flex-col bg-gray-50">
              <div className="min-h-0 flex-1 relative overflow-hidden">
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-gray-600">Cargando referencias geográficas...</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 overflow-hidden">
                    <AricaMap
                      segments={filteredSegments}
                      onSegmentClick={handleSegmentClick}
                      onSegmentAdd={handleAddSegment}
                      onSegmentDelete={handleDeleteSegment}
                      selectedSegmentId={selectedSegment?.id}
                      focusRequest={mapFocusRequest}
                      editMode={editMode}
                    />

                    {/* Map filters */}
                    <div className="absolute left-16 top-4 z-[1200] w-80 max-w-[calc(100%-5rem)] rounded-lg border border-gray-300 bg-white p-3 shadow-md">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">Mapa de Arica</h3>
                        <span className="text-[11px] text-gray-500">{filteredSegments.length} eventos</span>
                      </div>
                      <div className="mb-3">
                        <label className="mb-1 block text-[11px] font-medium text-gray-600">
                          Filtrar por calle
                        </label>
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={streetFilter}
                            onChange={(event) => setStreetFilter(event.target.value)}
                            placeholder="Ej: Diego Portales"
                            className="w-full rounded-md border border-gray-300 py-1.5 pl-7 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {streetFilter && (
                            <button
                              type="button"
                              onClick={() => setStreetFilter('')}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title="Limpiar filtro de calle"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {[
                          { value: 'all', label: 'Todos', color: 'bg-gray-700' },
                          { value: 'good', label: 'Bueno', color: 'bg-green-500' },
                          { value: 'warning', label: 'Alerta', color: 'bg-yellow-500' },
                          { value: 'critical', label: 'Crítico', color: 'bg-red-500' },
                          { value: 'repaired', label: 'Reparado', color: 'bg-gray-500' },
                        ].map((filter) => (
                          <button
                            key={filter.value}
                            type="button"
                            onClick={() => setStatusFilter(filter.value as 'all' | RoadSegment['status'])}
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 transition-colors ${
                              statusFilter === filter.value
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className={`h-2.5 w-2.5 rounded-sm ${filter.color}`} />
                            <span>{filter.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailsPanelOpen((open) => !open)}
                      className="absolute right-4 top-4 z-[1300] flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-md hover:bg-gray-50"
                    >
                      {detailsPanelOpen ? 'Ocultar detalles' : 'Mostrar detalles'}
                    </button>

                    {/* Edit Mode Toggle Button */}
                    <button
                      onClick={toggleEditMode}
                      className={`absolute bottom-4 px-4 py-2 rounded-md shadow-lg flex items-center gap-2 text-sm font-medium transition-colors z-[1000] ${
                        editMode 
                          ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                          : 'bg-gray-800 hover:bg-gray-900 text-white'
                      } ${detailsPanelOpen ? 'right-[23rem]' : 'right-4'}`}
                    >
                      {editMode ? 'Modo Edición ON' : 'Editar'}
                    </button>

                    {/* Add Report Button */}
                    <button
                      onClick={() => setShowReportForm(true)}
                      className={`absolute bottom-20 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-2 text-sm font-medium transition-colors z-[1000] ${detailsPanelOpen ? 'right-[23rem]' : 'right-4'}`}
                    >
                      <Plus className="w-4 h-4" />
                      REPORTE
                    </button>

                    {!detailsPanelOpen && selectedSegment && (
                      <div className="absolute right-4 top-16 z-[1200] rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
                        {getEventTitle(selectedSegment)}
                      </div>
                    )}

                    {editMode && (
                      <div className="absolute bottom-36 left-4 z-[1200] max-w-xs rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
                        <p className="font-semibold text-gray-900">Modo edición activo</p>
                        <p>Click para punto. Mantén y arrastra para dibujar un tramo.</p>
                      </div>
                    )}

                    {!loading && (
                      <aside
                        className={`absolute bottom-0 right-0 top-0 z-[1100] flex w-80 max-w-[88vw] flex-col border-l border-gray-300 bg-white shadow-2xl transition-transform duration-200 ${
                          detailsPanelOpen ? 'translate-x-0' : 'translate-x-full'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-gray-300 p-4">
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-gray-900">
                              {selectedSegment ? getEventTitle(selectedSegment) : 'Selecciona un evento'}
                            </h2>
                            <p className="mt-1 text-xs text-gray-600">
                              {selectedSegment ? getEventReference(selectedSegment) : 'Click en el mapa o en un registro inferior'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDetailsPanelOpen(false)}
                            className="rounded-md p-1 hover:bg-gray-100"
                            title="Ocultar panel"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>

                        <div className="border-b border-gray-300 p-4">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-md bg-red-50 p-2 text-center">
                              <div className="text-xl font-bold text-red-600">{criticalCount}</div>
                              <div className="text-[10px] text-gray-600">Críticos</div>
                            </div>
                            <div className="rounded-md bg-yellow-50 p-2 text-center">
                              <div className="text-xl font-bold text-yellow-600">{warningCount}</div>
                              <div className="text-[10px] text-gray-600">Alerta</div>
                            </div>
                            <div className="rounded-md bg-green-50 p-2 text-center">
                              <div className="text-xl font-bold text-green-600">{goodCount}</div>
                              <div className="text-[10px] text-gray-600">Buenos</div>
                            </div>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {selectedSegment && (
                            <div className="border-b border-gray-200 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <span
                                  className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
                                  style={{ backgroundColor: getStatusColor(selectedSegment.status) }}
                                >
                                  {getStatusLabel(selectedSegment.status)}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  {new Date(selectedSegment.date).toLocaleDateString('es-CL')}
                                </span>
                              </div>

                              <div className="space-y-2 text-xs text-gray-700">
                                <p><span className="font-semibold text-gray-900">Tipo:</span> {selectedSegment.damageType}</p>
                                <p><span className="font-semibold text-gray-900">Medidas:</span> {selectedSegment.length}m x {selectedSegment.width}m</p>
                                <p><span className="font-semibold text-gray-900">Prioridad:</span> {selectedSegment.priority.toFixed(1)}/10</p>
                                <p><span className="font-semibold text-gray-900">Adjuntos:</span> {selectedSegment.attachments?.length ?? selectedSegment.photos?.length ?? 0}</p>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <button
                                  onClick={handleEditSelectedSegment}
                                  className="flex items-center justify-center gap-1 rounded-md bg-gray-800 py-2 text-xs font-medium text-white hover:bg-gray-900"
                                >
                                  <Pencil className="h-3 w-3" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleMarkRepaired(selectedSegment.id)}
                                  className="flex items-center justify-center gap-1 rounded-md bg-green-600 py-2 text-xs font-medium text-white hover:bg-green-700"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Reparado
                                </button>
                                <button
                                  onClick={() => handleDeleteSegment(selectedSegment.id)}
                                  className="flex items-center justify-center gap-1 rounded-md bg-red-600 py-2 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Eliminar
                                </button>
                                <button
                                  onClick={() => setActiveView('detalles')}
                                  className="rounded-md bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  Detalles
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="p-3">
                            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-700">
                              <Calendar className="h-4 w-4" />
                              Últimos reportes
                            </h3>

                            <div className="space-y-2">
                              {filteredSegments.map((segment) => (
                                <button
                                  key={segment.id}
                                  type="button"
                                  onClick={() => handleSegmentFocus(segment)}
                                  className={`w-full rounded border p-2 text-left transition-colors ${
                                    selectedSegment?.id === segment.id
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 bg-gray-50 hover:border-blue-400'
                                  }`}
                                >
                                  <div className="mb-1 flex items-start justify-between gap-2">
                                    <h4 className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">
                                      {getEventTitle(segment)}
                                    </h4>
                                    <ChevronRight className="h-3 w-3 text-gray-400" />
                                  </div>

                                  <div className="mb-1 flex items-center gap-1">
                                    <div
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: getStatusColor(segment.status) }}
                                    />
                                    <span className="truncate text-[10px] text-gray-600">{segment.damageType}</span>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                                    <span>{new Date(segment.date).toLocaleDateString('es-CL')}</span>
                                    <span>Prioridad: {segment.priority.toFixed(1)}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-300 bg-gray-50 p-4">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <div>
                              <p className="font-medium text-gray-900">Estado general</p>
                              <p className="text-[10px]">{criticalCount} eventos requieren atención</p>
                            </div>
                          </div>
                        </div>
                      </aside>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Cards Grid */}
              {!loading && bottomBannerVisible && (
                <div
                  className="bg-white border-t border-gray-300 px-3 py-2 overflow-x-auto"
                  style={{ height: bottomBannerHeight }}
                >
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="text-[11px] font-medium text-gray-600">
                      Eventos visibles: <span className="text-gray-900">{filteredSegments.length}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span>Altura</span>
                      <input
                        type="range"
                        min="104"
                        max="190"
                        value={bottomBannerHeight}
                        onChange={(event) => setBottomBannerHeight(Number(event.target.value))}
                        className="h-1 w-28 accent-blue-600"
                        title="Ajustar altura del banner inferior"
                      />
                      <button
                        type="button"
                        onClick={() => setBottomBannerVisible(false)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                        title="Ocultar banner inferior"
                      >
                        Ocultar
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2" style={{ height: bottomBannerHeight - 42 }}>
                    {filteredSegments.map((segment) => (
                      <div
                        key={segment.id}
                        onClick={() => handleSegmentFocus(segment)}
                        title="Ver información y ubicación en el mapa"
                        className={`flex-shrink-0 w-40 overflow-hidden rounded-md border bg-gray-100 transition-shadow hover:shadow-md ${
                          selectedSegment?.id === segment.id
                            ? 'border-blue-600 ring-2 ring-blue-200'
                            : 'border-gray-300'
                        } cursor-pointer`}
                      >
                        <div
                          className="h-1.5"
                          style={{ backgroundColor: getStatusColor(segment.status) }}
                        />

                        <div className="flex h-full flex-col p-2">
                          <div
                            className="mb-1 w-fit rounded px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: getStatusColor(segment.status) }}
                          >
                            {getStatusLabel(segment.status)}
                          </div>

                          <h4 className="text-xs font-semibold text-gray-900 truncate">{getEventCode(segment)}</h4>
                          <p className="text-[10px] text-gray-600 truncate">{segment.damageType}</p>
                          <p className="text-[10px] text-gray-500 truncate">{getEventReference(segment)}</p>
                          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                            <p className="text-[10px] text-gray-500">
                              {new Date(segment.date).toLocaleDateString('es-CL')}
                            </p>
                            <p className="text-[10px] font-medium text-blue-600">Ver</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !bottomBannerVisible && (
                <div className="border-t border-gray-300 bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setBottomBannerVisible(true)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Mostrar eventos inferiores ({filteredSegments.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'reportes':
        return renderReportsView();
      case 'detalles':
        return renderDetailsView();
      case 'perfil':
        return renderProfileView();
      case 'config':
        return renderConfigView();
      default:
        return renderHomeView();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white border border-gray-300 rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">ATLAS Arica</h1>
              <p className="text-xs text-gray-600">Acceso administrador</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin@atlas.cl"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="atlas2026"
                required
              />
            </div>
          </div>

          {loginError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loginAttempts >= 3}
            className="mt-6 w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Iniciar sesión
          </button>

          <p className="mt-4 text-[11px] text-gray-500">
            Demo local: admin@atlas.cl / atlas2026. Supabase queda preparado como backend real pendiente de credenciales.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {showReportForm && (
        <ReportForm
          onClose={handleCloseReportForm}
          onSubmit={handleNewReport}
        />
      )}

      {editingSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Editar evento vial</h2>
                <p className="text-xs text-gray-600">
                  Calle referencial: {editingSegment.street}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditSegment}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditSegment} className="space-y-5 p-6">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                El nombre de la calle no se edita manualmente: debe venir de la cartografía o del punto GPS del reporte. Aquí se corrigen los datos técnicos del deterioro.
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Sector</label>
                  <select
                    value={editForm.sector}
                    onChange={(event) => setEditForm({ ...editForm, sector: event.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="SECTOR CENTRO">Sector Centro</option>
                    <option value="SECTOR NORTE">Sector Norte</option>
                    <option value="SECTOR SUR">Sector Sur</option>
                    <option value="SECTOR ESTE">Sector Este</option>
                    <option value="SECTOR OESTE">Sector Oeste</option>
                    <option value="SECTOR COSTANERA">Sector Costanera</option>
                    <option value="SECTOR CENTRO HISTÓRICO">Sector Centro Histórico</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Gravedad</label>
                  <select
                    value={editForm.status}
                    onChange={(event) => setEditForm({ ...editForm, status: event.target.value as RoadSegment['status'] })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="good">Bueno / leve</option>
                    <option value="warning">Alerta / medio</option>
                    <option value="critical">Crítico</option>
                    <option value="repaired">Reparado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Referencia puntual del evento</label>
                <input
                  type="text"
                  value={editForm.locationReference}
                  onChange={(event) => setEditForm({ ...editForm, locationReference: event.target.value })}
                  placeholder="Ej: frente al N° 123, poste AP-45, esquina norte"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Tipo de deterioro</label>
                <select
                  value={editForm.damageType}
                  onChange={(event) => setEditForm({ ...editForm, damageType: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  <option value="Bache profundo">Bache profundo</option>
                  <option value="Bache superficial">Bache superficial</option>
                  <option value="Grietas longitudinales">Grietas longitudinales</option>
                  <option value="Grietas transversales">Grietas transversales</option>
                  <option value="Grietas tipo piel de cocodrilo">Grietas tipo piel de cocodrilo</option>
                  <option value="Hundimiento">Hundimiento</option>
                  <option value="Deformación">Deformación</option>
                  <option value="Desprendimiento de carpeta">Desprendimiento de carpeta</option>
                  <option value="Pérdida de material">Pérdida de material</option>
                  <option value="Reparado">Reparado</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Largo / tamaño (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editForm.length}
                    onChange={(event) => setEditForm({ ...editForm, length: event.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Ancho (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editForm.width}
                    onChange={(event) => setEditForm({ ...editForm, width: event.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Prioridad 0-10</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={editForm.priority}
                    onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Fecha del registro</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(event) => setEditForm({ ...editForm, date: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 md:w-56"
                />
              </div>

              <div className="flex gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleCloseEditSegment}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <div className="w-16 bg-white border-r border-gray-300 flex flex-col items-center py-4 gap-2">
        <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mb-4">
          <MapPin className="w-6 h-6 text-white" />
        </div>

        <button
          onClick={() => setActiveView('inicio')}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            activeView === 'inicio' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Inicio"
        >
          <Home className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveView('buscar')}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            activeView === 'buscar' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Buscar"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveView('mapa')}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            activeView === 'mapa' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Mapa"
        >
          <MapPin className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveView('reportes')}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            activeView === 'reportes' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Administrar"
        >
          <FileText className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setActiveView('config')}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            activeView === 'config' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Configuración"
        >
          <Settings className="w-5 h-5" />
        </button>

        <button
          onClick={handleProfileClick}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
            activeView === 'perfil' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Usuario"
        >
          <User className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="h-14 bg-white border-b border-gray-300 flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">ATLAS Arica</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar evento, daño o referencia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button 
              onClick={handleProfileClick}
              className={`p-2 rounded-lg transition-colors ${
                activeView === 'perfil' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
              title="Perfil"
            >
              <User className="w-5 h-5 text-gray-600" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {renderActiveView()}
      </div>
    </div>
  );
}
