'use client';

import { Calendar, DollarSign, Globe } from 'lucide-react';

interface ClientDashboardProps {
    data: {
        sites: any[];
        servicos: {
            dominios: any[];
            hospedagem: any[];
            proximas_renovacoes: any[];
        };
        userEmail: string;
    };
}

export function ClientDashboard({ data }: ClientDashboardProps) {
    const { sites, servicos } = data;

    return (
        <div className="p-6 space-y-6">
            {/* Cards principais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Sites Ativos</p>
                            <p className="text-2xl font-bold">{sites.length}</p>
                        </div>
                        <Globe className="h-8 w-8 text-blue-600" />
                    </div>
                </div>

                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Domínios</p>
                            <p className="text-2xl font-bold">{servicos.dominios.length}</p>
                        </div>
                        <Globe className="h-8 w-8 text-green-600" />
                    </div>
                </div>

                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Próximas Renovações</p>
                            <p className="text-2xl font-bold">{servicos.proximas_renovacoes.length}</p>
                        </div>
                        <Calendar className="h-8 w-8 text-orange-600" />
                    </div>
                </div>

                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total a Pagar</p>
                            <p className="text-2xl font-bold">
                                ${servicos.proximas_renovacoes.reduce((sum, item) => sum + item.valor, 0)}
                            </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-red-600" />
                    </div>
                </div>
            </div>

            {/* Lista de serviços */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Meus Domínios</h3>
                    <div className="space-y-3">
                        {servicos.dominios.map((dominio, index) => (
                            <div key={index} className="flex justify-between items-center p-3 border rounded">
                                <div>
                                    <p className="font-medium">{dominio.nome}</p>
                                    <p className="text-sm text-gray-600">Renova: {dominio.renovacao}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">${dominio.preco}</p>
                                    <span className={`px-2 py-1 text-xs rounded ${dominio.status === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        {dominio.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Alertas de Renovação</h3>
                    <div className="space-y-3">
                        {servicos.proximas_renovacoes.map((alerta, index) => (
                            <div key={index} className="flex justify-between items-center p-3 border rounded bg-orange-50">
                                <div>
                                    <p className="font-medium">{alerta.servico}</p>
                                    <p className="text-sm text-gray-600">{alerta.dias} dias</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-orange-600">${alerta.valor}</p>
                                    <button className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700">
                                        Renovar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
