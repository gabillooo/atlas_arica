import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, MapPin, X, Ruler, ArrowRight } from 'lucide-react';
import { GeoLocationHelper } from './GeoLocationHelper';

interface ReportFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function ReportForm({ onClose, onSubmit }: ReportFormProps) {
  const [formData, setFormData] = useState({
    street: '',
    sector: '',
    damageType: '',
    severity: 'leve',
    description: '',
    photos: [] as string[],
    segmentLength: '',
    segmentWidth: '',
    startReference: '',
    endReference: '',
    startLat: '',
    startLng: '',
    endLat: '',
    endLng: ''
  });

  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isCompressingPhotos, setIsCompressingPhotos] = useState(false);
  const [useGPS, setUseGPS] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{
    start: { lat: number; lng: number } | null;
    end: { lat: number; lng: number } | null;
  }>({
    start: null,
    end: null
  });
  const [captureMode, setCaptureMode] = useState<'start' | 'end' | null>(null);
  const [useSimulatedGPS, setUseSimulatedGPS] = useState(false);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const compressImage = async (file: File): Promise<{ file: File; preview: string }> => {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.78,
    });
    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^.]+$/, '.jpg'),
      { type: 'image/jpeg', lastModified: Date.now() }
    );

    return {
      file: compressedFile,
      preview: await fileToDataUrl(compressedFile),
    };
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setIsCompressingPhotos(true);
      try {
        const compressedPhotos = await Promise.all(files.map(compressImage));
        const nextPreviews = [...photoPreviews, ...compressedPhotos.map(photo => photo.preview)];
        const nextFiles = [...photoFiles, ...compressedPhotos.map(photo => photo.file)];
        setPhotoPreviews(nextPreviews);
        setPhotoFiles(nextFiles);
        setFormData({ ...formData, photos: nextPreviews });
      } catch (error) {
        console.error('Error compressing photos:', error);
        alert('No se pudieron comprimir las imágenes. Intenta con otro archivo.');
      } finally {
        setIsCompressingPhotos(false);
      }
    }
    e.target.value = '';
  };

  const handleCaptureLocation = (type: 'start' | 'end') => {
    setCaptureMode(type);
    setUseGPS(true);

    // Simulated GPS for development/testing (Real Arica street coordinates)
    if (useSimulatedGPS) {
      // Generate realistic coordinates for a street segment in Arica Centro
      const baseCoords = {
        start: {
          lat: -18.4755,
          lng: -70.3120
        },
        end: {
          lat: -18.4755,  // Tramo horizontal típico
          lng: -70.3100
        }
      };

      const coords = baseCoords[type];
      setGpsCoords(prev => ({
        ...prev,
        [type]: coords
      }));
      setCaptureMode(null);
      return;
    }

    if (!navigator.geolocation) {
      const useSimulated = window.confirm(
        'Tu navegador no soporta geolocalización.\n\n¿Deseas usar coordenadas simuladas para pruebas?\n\n(Ubicadas en Arica, Chile)'
      );

      if (useSimulated) {
        setUseSimulatedGPS(true);
        handleCaptureLocation(type);
      } else {
        setCaptureMode(null);
        setUseGPS(false);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        setGpsCoords(prev => ({
          ...prev,
          [type]: coords
        }));
        setCaptureMode(null);
      },
      (error) => {
        let errorMessage = 'No se pudo obtener la ubicación. ';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Permisos de ubicación denegados. Por favor, habilita los permisos de ubicación en tu navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Información de ubicación no disponible. Verifica tu conexión GPS.';
            break;
          case error.TIMEOUT:
            errorMessage += 'La solicitud de ubicación tardó demasiado tiempo. Intenta nuevamente.';
            break;
          default:
            errorMessage += 'Error desconocido al obtener ubicación.';
        }

        console.error('Error getting location:', error);

        const useSimulated = window.confirm(
          errorMessage + '\n\n¿Deseas usar coordenadas simuladas para pruebas?\n\n(Ubicadas en Arica, Chile)'
        );

        if (useSimulated) {
          setUseSimulatedGPS(true);
          handleCaptureLocation(type);
        } else {
          setCaptureMode(null);
          setUseGPS(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const manualStart = formData.startLat && formData.startLng
      ? { lat: Number(formData.startLat), lng: Number(formData.startLng) }
      : null;
    const manualEnd = formData.endLat && formData.endLng
      ? { lat: Number(formData.endLat), lng: Number(formData.endLng) }
      : null;

    onSubmit({
      ...formData,
      photoFiles,
      gpsCoords: {
        start: gpsCoords.start ?? manualStart,
        end: gpsCoords.end ?? manualEnd,
      },
      timestamp: new Date().toISOString(),
      segmentType: 'road_section'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo Reporte de Evento Vial</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Ubicación exacta del evento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Calle referencial
                </label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Opcional: Av. 21 de Mayo"
                  list="arica-streets"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <datalist id="arica-streets">
                  <option value="Av. Comandante San Martín" />
                  <option value="Av. 21 de Mayo" />
                  <option value="Av. General Velásquez" />
                  <option value="Calle Sotomayor" />
                  <option value="Calle Patricio Lynch" />
                  <option value="Av. Diego Portales" />
                  <option value="Av. Santa María" />
                  <option value="Calle Baquedano" />
                  <option value="Calle Colón" />
                  <option value="Av. Capitán Ávalos" />
                  <option value="Calle 18 de Septiembre" />
                  <option value="Av. Máximo Lira" />
                  <option value="Calle Yungay" />
                  <option value="Av. España" />
                  <option value="Calle Maipú" />
                  <option value="Av. Arturo Prat" />
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sector *
                </label>
                <select
                  required
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  <option value="SECTOR CENTRO">Sector Centro</option>
                  <option value="SECTOR NORTE">Sector Norte</option>
                  <option value="SECTOR SUR">Sector Sur</option>
                  <option value="SECTOR ESTE">Sector Este</option>
                  <option value="SECTOR OESTE">Sector Oeste</option>
                  <option value="SECTOR CENTRO HISTÓRICO">Sector Centro Histórico</option>
                </select>
              </div>
            </div>

            {/* Segment Definition */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Definir evento y coordenada GPS
                </h4>
                <button
                  type="button"
                  onClick={() => setUseSimulatedGPS(!useSimulatedGPS)}
                  className={`px-2 py-1 text-xs rounded-full font-medium transition-colors ${
                    useSimulatedGPS
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Alternar modo de prueba con coordenadas simuladas"
                >
                  {useSimulatedGPS ? '📍 Modo Prueba' : '🌐 GPS Real'}
                </button>
              </div>

              {/* GPS Status Helper */}
              {!useSimulatedGPS && (
                <div className="mb-4">
                  <GeoLocationHelper />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Largo / diámetro del daño (metros) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.segmentLength}
                    onChange={(e) => setFormData({ ...formData, segmentLength: e.target.value })}
                    placeholder="Ej: 120"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ancho del daño (metros) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.segmentWidth}
                    onChange={(e) => setFormData({ ...formData, segmentWidth: e.target.value })}
                    placeholder="Ej: 12"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Referencia puntual del evento *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.startReference}
                      onChange={(e) => setFormData({ ...formData, startReference: e.target.value })}
                      placeholder="Ej: frente al Nro. 123, poste AP-45"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleCaptureLocation('start')}
                      disabled={captureMode === 'start'}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs border border-blue-300 rounded-md text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <MapPin className="w-3 h-3" />
                      {gpsCoords.start ? 'GPS Capturado' : captureMode === 'start' ? 'Capturando...' : 'Capturar GPS exacto'}
                    </button>
                    {gpsCoords.start && (
                      <div className={`mt-1 text-[10px] px-2 py-1 rounded ${
                        useSimulatedGPS
                          ? 'text-purple-700 bg-purple-50'
                          : 'text-green-700 bg-green-50'
                      }`}>
                        {gpsCoords.start.lat.toFixed(6)}, {gpsCoords.start.lng.toFixed(6)}
                        {useSimulatedGPS && ' (simulado)'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Referencia secundaria opcional
                    </label>
                    <input
                      type="text"
                      value={formData.endReference}
                      onChange={(e) => setFormData({ ...formData, endReference: e.target.value })}
                      placeholder="Ej: Frente a Plaza Principal"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleCaptureLocation('end')}
                      disabled={captureMode === 'end'}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs border border-blue-300 rounded-md text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <MapPin className="w-3 h-3" />
                      {gpsCoords.end ? 'Referencia capturada' : captureMode === 'end' ? 'Capturando...' : 'Capturar referencia'}
                    </button>
                    {gpsCoords.end && (
                      <div className={`mt-1 text-[10px] px-2 py-1 rounded ${
                        useSimulatedGPS
                          ? 'text-purple-700 bg-purple-50'
                          : 'text-green-700 bg-green-50'
                      }`}>
                        {gpsCoords.end.lat.toFixed(6)}, {gpsCoords.end.lng.toFixed(6)}
                        {useSimulatedGPS && ' (simulado)'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Latitud inicio
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.startLat}
                      onChange={(e) => setFormData({ ...formData, startLat: e.target.value })}
                      placeholder="-18.475500"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Longitud inicio
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.startLng}
                      onChange={(e) => setFormData({ ...formData, startLng: e.target.value })}
                      placeholder="-70.312000"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Latitud referencia
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.endLat}
                      onChange={(e) => setFormData({ ...formData, endLat: e.target.value })}
                      placeholder="-18.475500"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Longitud referencia
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.endLng}
                      onChange={(e) => setFormData({ ...formData, endLng: e.target.value })}
                      placeholder="-70.310000"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {gpsCoords.start && (
                  <div className={`flex items-center justify-center gap-2 text-xs px-3 py-2 rounded ${
                    useSimulatedGPS
                      ? 'text-purple-700 bg-purple-50'
                      : 'text-green-700 bg-green-50'
                  }`}>
                    <ArrowRight className="w-4 h-4" />
                    <span>
                      Evento georreferenciado correctamente
                      {useSimulatedGPS && ' (coordenadas de prueba)'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Damage Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Tipo de Deterioro</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Daño *
              </label>
              <select
                required
                value={formData.damageType}
                onChange={(e) => setFormData({ ...formData, damageType: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nivel de Severidad *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'leve', label: 'Leve', color: 'border-green-400 bg-green-50 text-green-800' },
                  { value: 'moderado', label: 'Moderado', color: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
                  { value: 'grave', label: 'Grave', color: 'border-red-400 bg-red-50 text-red-800' }
                ].map((severity) => (
                  <button
                    key={severity.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, severity: severity.value })}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                      formData.severity === severity.value
                        ? severity.color
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {severity.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción del evento
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el estado del tramo, características del deterioro, condiciones del tráfico, etc."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Photo Capture */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Evidencia Fotográfica</h3>

            {photoPreviews.length === 0 ? (
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Tomar fotografía del evento</p>
                  <p className="text-xs text-gray-500">o seleccionar de galería</p>
                </div>
              </label>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photoPreviews.map((photo, index) => (
                    <div key={photo} className="relative">
                      <img
                        src={photo}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-28 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextPhotos = photoPreviews.filter((_, photoIndex) => photoIndex !== index);
                          const nextFiles = photoFiles.filter((_, photoIndex) => photoIndex !== index);
                          setPhotoPreviews(nextPhotos);
                          setPhotoFiles(nextFiles);
                          setFormData({ ...formData, photos: nextPhotos });
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <p className="text-xs text-gray-600">Agregar más fotografías</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCompressingPhotos}
              className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              {isCompressingPhotos ? 'Preparando imágenes...' : 'Enviar reporte de evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
