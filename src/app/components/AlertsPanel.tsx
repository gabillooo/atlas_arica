import { Bell, X, AlertTriangle, Clock, MapPin } from 'lucide-react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  street: string;
  time: string;
  read: boolean;
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'Alerta Crítica',
    message: 'Bache profundo detectado - Requiere intervención inmediata',
    street: 'Av. 21 de Mayo',
    time: '2026-05-06 09:30',
    read: false
  },
  {
    id: '2',
    type: 'warning',
    title: 'Deterioro Progresivo',
    message: 'La calle muestra signos de deterioro acelerado en los últimos 30 días',
    street: 'Calle Diego Portales',
    time: '2026-05-05 14:15',
    read: false
  },
  {
    id: '3',
    type: 'warning',
    title: 'Zona en Alerta',
    message: 'Múltiples reportes en la misma ubicación',
    street: 'Calle Lynch',
    time: '2026-05-04 11:20',
    read: true
  },
  {
    id: '4',
    type: 'info',
    title: 'Mantenimiento Programado',
    message: 'Intervención completada exitosamente',
    street: 'Av. Capitán Ávalos',
    time: '2026-05-03 16:45',
    read: true
  }
];

interface AlertsPanelProps {
  onClose: () => void;
}

export function AlertsPanel({ onClose }: AlertsPanelProps) {
  const getAlertColor = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  const unreadCount = mockAlerts.filter(a => !a.read).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sistema de Alertas</h2>
              <p className="text-sm text-gray-600">
                {unreadCount} alerta{unreadCount !== 1 ? 's' : ''} sin leer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mockAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-2 rounded-lg transition-all ${getAlertColor(alert.type)} ${
                !alert.read ? 'shadow-md' : 'opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getAlertIcon(alert.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                      {!alert.read && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          Nueva
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-3">{alert.message}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{alert.street}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(alert.time).toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onClose}
            >
              Cerrar
            </button>
            <button
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Marcar todas como leídas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
