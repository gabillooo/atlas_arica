import { AlertTriangle, ChevronRight, Calendar, MapPin } from 'lucide-react';

interface PriorityReport {
  id: string;
  street: string;
  sector: string;
  priority: number;
  status: 'critical' | 'warning' | 'good';
  date: string;
  damageType: string;
}

const mockPriorityReports: PriorityReport[] = [
  {
    id: '1',
    street: 'Av. Diego Portales',
    sector: 'Centro',
    priority: 9.2,
    status: 'critical',
    date: '2026-05-03',
    damageType: 'Bache profundo'
  },
  {
    id: '2',
    street: 'Calle 21 de Mayo',
    sector: 'Sur',
    priority: 7.5,
    status: 'warning',
    date: '2026-05-01',
    damageType: 'Grietas múltiples'
  },
  {
    id: '3',
    street: 'Av. Capitán Ávalos',
    sector: 'Norte',
    priority: 6.8,
    status: 'warning',
    date: '2026-04-30',
    damageType: 'Hundimiento'
  },
  {
    id: '4',
    street: 'Calle Lynch',
    sector: 'Centro',
    priority: 5.3,
    status: 'warning',
    date: '2026-04-28',
    damageType: 'Deformación'
  },
  {
    id: '5',
    street: 'Av. Santa María',
    sector: 'Este',
    priority: 4.1,
    status: 'good',
    date: '2026-04-25',
    damageType: 'Grieta menor'
  }
];

export function PriorityList() {
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600 bg-red-50';
    if (priority >= 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'Urgente';
    if (priority >= 5) return 'Media';
    return 'Baja';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Priorización de Intervenciones</h2>
            <p className="text-sm text-gray-600 mt-1">
              Ordenadas por nivel de urgencia según algoritmo
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            Exportar Lista
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {mockPriorityReports.map((report, index) => (
          <div
            key={report.id}
            className="p-6 hover:bg-gray-50 transition-colors cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              {/* Priority Number */}
              <div className="flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  index === 0 ? 'bg-red-500 text-white' :
                  index === 1 ? 'bg-orange-500 text-white' :
                  index === 2 ? 'bg-yellow-500 text-white' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {index + 1}
                </div>
              </div>

              {/* Report Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {report.street}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{report.damageType}</p>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(report.priority)}`}>
                    {getPriorityLabel(report.priority)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{report.sector}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(report.date).toLocaleDateString('es-CL')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Prioridad: <strong>{report.priority.toFixed(1)}</strong>/10</span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Mostrando 5 de 12 reportes</span>
          <button className="text-blue-600 font-medium hover:text-blue-700">
            Ver todos los reportes →
          </button>
        </div>
      </div>
    </div>
  );
}
