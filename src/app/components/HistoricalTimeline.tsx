import { Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface HistoricalEvent {
  id: string;
  date: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
  severity: number;
}

const mockHistory: HistoricalEvent[] = [
  {
    id: '1',
    date: '2026-05-03',
    status: 'critical',
    description: 'Estado crítico detectado - Requiere intervención inmediata',
    severity: 9.2
  },
  {
    id: '2',
    date: '2026-04-15',
    status: 'warning',
    description: 'Deterioro inicial detectado - Grietas superficiales',
    severity: 5.5
  },
  {
    id: '3',
    date: '2026-03-20',
    status: 'good',
    description: 'Inspección rutinaria - Estado bueno',
    severity: 2.1
  },
  {
    id: '4',
    date: '2026-02-10',
    status: 'good',
    description: 'Mantenimiento preventivo realizado',
    severity: 1.5
  },
  {
    id: '5',
    date: '2026-01-05',
    status: 'warning',
    description: 'Signos tempranos de desgaste detectados',
    severity: 4.2
  }
];

interface HistoricalTimelineProps {
  streetName: string;
}

export function HistoricalTimeline({ streetName }: HistoricalTimelineProps) {
  const getStatusColor = (status: HistoricalEvent['status']) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'good': return 'bg-green-500';
    }
  };

  const getStatusText = (status: HistoricalEvent['status']) => {
    switch (status) {
      case 'critical': return 'Crítico';
      case 'warning': return 'Alerta';
      case 'good': return 'Bueno';
    }
  };

  const getTrendIcon = (index: number) => {
    if (index === mockHistory.length - 1) return null;

    const current = mockHistory[index].severity;
    const previous = mockHistory[index + 1].severity;

    if (current > previous) {
      return <TrendingUp className="w-4 h-4 text-red-500" />;
    } else if (current < previous) {
      return <TrendingDown className="w-4 h-4 text-green-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historial Evolutivo</h2>
          <p className="text-sm text-gray-600">{streetName}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-8">
          {mockHistory.map((event, index) => (
            <div key={event.id} className="relative flex gap-6">
              {/* Status Indicator */}
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-full ${getStatusColor(event.status)} flex items-center justify-center shadow-lg`}>
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>

              {/* Event Card */}
              <div className="flex-1 pb-8">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getStatusColor(event.status)}`}>
                          {getStatusText(event.status)}
                        </span>
                        {getTrendIcon(index)}
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{event.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                    <span>{new Date(event.date).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                    <span className="font-semibold">
                      Severidad: {event.severity.toFixed(1)}/10
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Resumen de Tendencias</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">+82%</p>
            <p className="text-xs text-gray-600 mt-1">Deterioro último trimestre</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">4</p>
            <p className="text-xs text-gray-600 mt-1">Inspecciones realizadas</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">45d</p>
            <p className="text-xs text-gray-600 mt-1">Desde último mantenimiento</p>
          </div>
        </div>
      </div>
    </div>
  );
}
