interface StreetData {
  id: string;
  eventCode?: string;
  street: string;
  sector: string;
  status: 'good' | 'warning' | 'critical' | 'repaired';
  date: string;
  priority: number;
  coordinates: [number, number][];
  damageType: string;
  length: number;
  width: number;
  image?: string;
  photos?: string[];
  history?: Array<string | {
    date: string;
    action: string;
    label: string;
    status: 'good' | 'warning' | 'critical' | 'repaired';
    priority: number;
  }>;
  attachments?: string[];
  locationReference?: string;
}

let streetCache: StreetData[] | null = null;

const STORAGE_KEY = 'atlas-arica-events-v1';
const OSM_REQUEST_TIMEOUT_MS = 7000;
const ARICA_BBOX = {
  south: -18.515,
  west: -70.335,
  north: -18.445,
  east: -70.255,
};

const isAricaUrbanCoordinate = ([lat, lng]: [number, number]): boolean => {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= ARICA_BBOX.south &&
    lat <= ARICA_BBOX.north &&
    lng >= ARICA_BBOX.west &&
    lng <= ARICA_BBOX.east;
};

const distanceBetween = (a: [number, number], b: [number, number]) => {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
};

const removeLongJumps = (coordinates: [number, number][]) => {
  return coordinates.filter((coord, index) => {
    if (index === 0) return true;
    return distanceBetween(coordinates[index - 1], coord) < 0.01;
  });
};

export function loadSegmentsFromStorage(): StreetData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((segment) =>
      segment &&
      typeof segment.id === 'string' &&
      Array.isArray(segment.coordinates) &&
      segment.coordinates.every(isAricaUrbanCoordinate)
    );
  } catch (error) {
    console.error('Error loading segments from storage:', error);
    return [];
  }
}

export function saveSegmentsToStorage(segments: StreetData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
  } catch (error) {
    console.error('Error saving segments to storage:', error);
  }
}

export function addSegmentToStorage(segment: StreetData): void {
  saveSegmentsToStorage([...loadSegmentsFromStorage(), segment]);
}

export function deleteSegmentFromStorage(segmentId: string): void {
  saveSegmentsToStorage(loadSegmentsFromStorage().filter(segment => segment.id !== segmentId));
}

export async function fetchStreetsFromOSM(forceOSM: boolean = false): Promise<StreetData[]> {
  if (streetCache && !forceOSM) return streetCache;

  try {
    const query = `
      [out:json][timeout:25];
      (
        way["highway"~"^(primary|secondary|tertiary|residential|unclassified)$"]["name"](${ARICA_BBOX.south},${ARICA_BBOX.west},${ARICA_BBOX.north},${ARICA_BBOX.east});
      );
      out body 120;
      >;
      out skel qt;
    `;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), OSM_REQUEST_TIMEOUT_MS);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Overpass error: ${response.status}`);
    }

    const data = await response.json();
    streetCache = processOSMData(data);
    return streetCache;
  } catch (error) {
    console.error('Error fetching streets from OSM:', error);
    streetCache = [];
    return [];
  }
}

function processOSMData(data: any): StreetData[] {
  const nodesMap = new Map<number, [number, number]>();
  const ways = data.elements?.filter((element: any) => element.type === 'way' && element.tags?.name) ?? [];

  data.elements
    ?.filter((element: any) => element.type === 'node')
    .forEach((element: any) => {
      nodesMap.set(element.id, [element.lat, element.lon]);
    });

  return ways
    .map((way: any) => {
      const coordinates = removeLongJumps(
        way.nodes
          .map((nodeId: number) => nodesMap.get(nodeId))
          .filter(Boolean)
          .filter(isAricaUrbanCoordinate) as [number, number][]
      );

      if (coordinates.length < 2) return null;

      const status = getDeterministicStatus(way.id);

      return {
        id: `osm-${way.id}`,
        street: way.tags.name,
        sector: determineSector(coordinates[0]),
        status,
        date: new Date().toISOString().split('T')[0],
        priority: getDeterministicPriority(way.id, status),
        coordinates,
        damageType: getDamageType(status, way.id),
        length: Math.max(20, Math.round(coordinates.length * 18)),
        width: 8 + (way.id % 6),
      };
    })
    .filter(Boolean) as StreetData[];
}

function determineSector([lat, lng]: [number, number]): string {
  if (lat > -18.475) {
    return lng < -70.31 ? 'SECTOR COSTANERA' : 'SECTOR NORTE';
  }

  if (lat < -18.49) return 'SECTOR SUR';
  return 'SECTOR CENTRO';
}

function getDeterministicStatus(id: number): 'good' | 'warning' | 'critical' {
  const bucket = id % 10;
  if (bucket < 3) return 'critical';
  if (bucket < 6) return 'warning';
  return 'good';
}

function getDeterministicPriority(id: number, status: 'good' | 'warning' | 'critical'): number {
  const fraction = (id % 10) / 10;
  if (status === 'critical') return 8 + fraction;
  if (status === 'warning') return 5 + fraction;
  return 2 + fraction;
}

function getDamageType(status: 'good' | 'warning' | 'critical' | 'repaired', seed: number = 0): string {
  if (status === 'repaired') return 'Reparado';

  const damages = {
    good: ['Estado optimo', 'Recien pavimentado', 'Mantenimiento preventivo'],
    warning: ['Grietas leves', 'Desgaste superficial', 'Baches pequenos'],
    critical: ['Bache profundo', 'Hundimiento', 'Grietas profundas', 'Desprendimiento'],
  };

  const types = damages[status];
  return types[seed % types.length];
}

export function clearStreetCache(): void {
  streetCache = null;
}
