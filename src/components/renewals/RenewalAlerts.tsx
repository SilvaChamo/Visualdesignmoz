// Componente React para Alertas de Renovação
import React, { useState, useEffect } from 'react';

interface RenewalAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
  user_id: string;
  renewal_date: string;
  price: number;
}

const RenewalAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<RenewalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRenewalAlerts();
  }, []);

  const fetchRenewalAlerts = async () => {
    try {
      // Buscar alertas do arquivo gerado pelo script Python
      const response = await fetch('/api/renewal-alerts');
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return '⚠️';
      case 'warning':
        return '⏰';
      default:
        return '📋';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'danger':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-4xl mb-2">✅</div>
        <p>Nenhuma renovação pendente no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          📅 Alertas de Renovação
        </h3>
        <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </span>
      </div>

      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border rounded-lg p-4 ${getAlertColor(alert.type)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{getAlertIcon(alert.type)}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-1">
                  {alert.title}
                </h4>
                <p className="text-sm mb-2">
                  {alert.message}
                </p>
                <div className="flex items-center space-x-4 text-xs">
                  <span>
                    📅 Vencimento: {new Date(alert.renewal_date).toLocaleDateString('pt-PT')}
                  </span>
                  <span>
                    💰 Valor: €{alert.price.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => window.open('https://109.199.104.22:8090', '_blank')}
                className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors"
              >
                🔄 Renovar Agora
              </button>
              <button
                onClick={() => window.alert(`Detalhes para ${alert.user_id}`)}
                className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                📋 Detalhes
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RenewalAlerts;
