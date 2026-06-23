import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasSupabasePlaceholders = !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes('TU-PROYECTO') ||
  supabaseAnonKey.includes('PEGA_AQUI');

export const isSupabaseConfigured = !hasSupabasePlaceholders;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

const PHOTO_BUCKET = import.meta.env.VITE_SUPABASE_PHOTO_BUCKET || 'event-photos';

export type UserRole = 'admin' | 'supervisor' | 'operador' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export async function signInWithSupabase(email: string, password: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOutFromSupabase(): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSupabaseSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (error) {
    return {
      id: user.id,
      email: user.email ?? '',
      full_name: null,
      role: 'viewer',
    };
  }

  return data as UserProfile;
}

export async function uploadEventPhotos(files: File[], eventId: string): Promise<string[]> {
  if (!supabase || files.length === 0) return [];

  const uploadedUrls = await Promise.all(files.map(async (file, index) => {
    const extension = file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${eventId}/${Date.now()}-${index}.${extension}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }));

  return uploadedUrls;
}

const mapSupabaseRowToSegment = (row: any) => ({
  id: row.id,
  eventCode: row.event_code,
  street: row.street_name || 'Calle por asociar',
  sector: row.sector || 'SECTOR SIN CLASIFICAR',
  status: row.severity || 'warning',
  date: String(row.captured_at || row.created_at || new Date().toISOString()).split('T')[0],
  repairedAt: row.repaired_at ? String(row.repaired_at).split('T')[0] : undefined,
  priority: Number(row.priority_score) || 0,
  coordinates: row.end_lat && row.end_lng
    ? [[Number(row.point_lat), Number(row.point_lng)], [Number(row.end_lat), Number(row.end_lng)]]
    : [[Number(row.point_lat), Number(row.point_lng)]],
  damageType: row.damage_type || 'Evento vial',
  length: Number(row.length_m) || 0,
  width: Number(row.width_m) || 0,
  image: row.photos?.[0],
  photos: row.photos ?? [],
  attachments: row.photos ?? [],
  locationReference: row.notes || row.street_name,
  history: row.history ?? [],
});

export async function loadRoadEventsFromSupabase(): Promise<any[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('road_events')
    .select('*')
    .order('captured_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapSupabaseRowToSegment);
}

export async function saveRoadEventToSupabase(segment: any): Promise<void> {
  if (!supabase) return;

  const firstPoint = segment.coordinates?.[0];
  const lastPoint = segment.coordinates?.[segment.coordinates.length - 1];
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('road_events').upsert({
    id: segment.id,
    event_code: segment.eventCode,
    created_by: segment.createdBy ?? userData.user?.id ?? null,
    severity: segment.status,
    damage_type: segment.damageType,
    length_m: segment.length,
    width_m: segment.width,
    priority_score: segment.priority,
    status: segment.status === 'repaired' ? 'repaired' : 'open',
    notes: segment.locationReference,
    captured_at: `${segment.date}T12:00:00`,
    repaired_at: segment.repairedAt ? `${segment.repairedAt}T12:00:00` : null,
    point_lat: firstPoint?.[0] ?? null,
    point_lng: firstPoint?.[1] ?? null,
    end_lat: lastPoint && lastPoint !== firstPoint ? lastPoint[0] : null,
    end_lng: lastPoint && lastPoint !== firstPoint ? lastPoint[1] : null,
    street_name: segment.street,
    sector: segment.sector,
    photos: segment.photos ?? [],
    history: segment.history ?? [],
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function deleteRoadEventFromSupabase(segmentId: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('road_events')
    .delete()
    .eq('id', segmentId);

  if (error) throw error;
}
