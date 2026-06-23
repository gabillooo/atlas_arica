import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';

export function GeoLocationHelper() {
  const [status, setStatus] = useState<'checking' | 'granted' | 'denied' | 'unavailable' | 'prompt'>('checking');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    checkGeolocationPermission();
  }, []);

  const checkGeolocationPermission = async () => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    try {
      // Check permission state if available
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setStatus(result.state as any);

        result.addEventListener('change', () => {
          setStatus(result.state as any);
        });
      } else {
        // Fallback: try to get position
        navigator.geolocation.getCurrentPosition(
          () => setStatus('granted'),
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setStatus('denied');
            } else {
              setStatus('prompt');
            }
          }
        );
      }
    } catch (error) {
      console.error('Error checking geolocation permission:', error);
      setStatus('unavailable');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'unavailable':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      case 'prompt':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-400 animate-pulse" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'granted':
        return 'GPS habilitado';
      case 'denied':
        return 'GPS bloqueado';
      case 'unavailable':
        return 'GPS no disponible';
      case 'prompt':
        return 'Permiso pendiente';
      default:
        return 'Verificando GPS...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'granted':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'denied':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'unavailable':
        return 'bg-gray-50 border-gray-200 text-gray-700';
      case 'prompt':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="p-1 hover:bg-white/50 rounded transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {showHelp && (
        <div className="mt-3 pt-3 border-t border-current/20 text-xs space-y-2">
          {status === 'denied' && (
            <>
              <p className="font-medium">Para habilitar la geolocalización:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Haz clic en el icono de candado 🔒 en la barra de direcciones</li>
                <li>Busca la opción "Ubicación" o "Location"</li>
                <li>Selecciona "Permitir" o "Allow"</li>
                <li>Recarga la página</li>
              </ol>
            </>
          )}

          {status === 'unavailable' && (
            <p>Tu navegador o dispositivo no soporta geolocalización. Puedes usar el <strong>Modo Prueba</strong> con coordenadas simuladas.</p>
          )}

          {status === 'prompt' && (
            <p>Cuando hagas clic en "Capturar GPS", tu navegador te pedirá permiso. Asegúrate de hacer clic en <strong>"Permitir"</strong>.</p>
          )}

          {status === 'granted' && (
            <p>¡Perfecto! Puedes capturar las coordenadas GPS de los tramos sin problemas.</p>
          )}
        </div>
      )}
    </div>
  );
}
