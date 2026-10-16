import fs from 'fs';

// Estado do modo de manutenção, partilhado pela rota pública
// (/api/system-status — só lê) e pela rota de admin (/api/admin/system-status).
const MAINTENANCE_FILE = '/tmp/vd_maintenance_mode.json';

export type MaintenanceState = {
  active: boolean;
  message: string;
  updatedAt?: string;
  updatedBy?: string;
};

export function getMaintenanceState(): MaintenanceState {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const data = fs.readFileSync(MAINTENANCE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Erro ao ler estado de manutenção:', err);
  }
  return { active: false, message: 'Servidor em manutenção temporária para otimização de desempenho.', updatedAt: new Date().toISOString() };
}

export function setMaintenanceState(state: MaintenanceState): void {
  try {
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao gravar estado de manutenção:', err);
  }
}
