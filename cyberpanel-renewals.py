#!/usr/bin/env python3
"""
Sistema de Notificações de Renovação para CyberPanel
Implementação urgente para alertas de vencimento
"""

import os
import sys
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

class RenewalNotificationSystem:
    def __init__(self):
        self.log_file = "/var/log/cyberpanel-renewals.log"
        self.ensure_log_directory()
    
    def ensure_log_directory(self):
        """Garante que o diretório de log existe"""
        log_dir = Path(self.log_file).parent
        log_dir.mkdir(parents=True, exist_ok=True)
    
    def log_message(self, message):
        """Registra mensagem no log"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}\n"
        
        with open(self.log_file, "a") as f:
            f.write(log_entry)
        
        print(log_entry.strip())
    
    def get_websites_from_cyberpanel(self):
        """Obtém websites do CyberPanel via CLI"""
        try:
            result = subprocess.run(
                ["cyberpanel", "listWebsites"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                self.log_message("✅ Websites obtidos com sucesso via CLI")
                return True
            else:
                self.log_message(f"❌ Erro ao obter websites: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_message(f"❌ Exceção ao obter websites: {str(e)}")
            return False
    
    def get_users_from_cyberpanel(self):
        """Obtém usuários do CyberPanel via CLI"""
        try:
            result = subprocess.run(
                ["cyberpanel", "listUsers"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                self.log_message("✅ Usuários obtidos com sucesso via CLI")
                return True
            else:
                self.log_message(f"❌ Erro ao obter usuários: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_message(f"❌ Exceção ao obter usuários: {str(e)}")
            return False
    
    def calculate_renewal_dates(self):
        """Calcula datas de renovação baseadas na criação"""
        # Simulação: websites criados há 30 dias vencem em 30 dias
        today = datetime.now()
        
        # Dados de exemplo (substituir com dados reais)
        sample_renewals = [
            {
                "service_type": "hosting",
                "service_name": "oshercollective.com",
                "user_id": "osher4712",
                "renewal_date": today + timedelta(days=15),  # 15 dias para vencer
                "renewal_price": 29.99,
                "status": "active"
            },
            {
                "service_type": "hosting", 
                "service_name": "aamihe.com",
                "user_id": "aamihe",
                "renewal_date": today + timedelta(days=5),   # 5 dias para vencer
                "renewal_price": 19.99,
                "status": "active"
            },
            {
                "service_type": "hosting",
                "service_name": "mltmark.com", 
                "user_id": "mltmark",
                "renewal_date": today - timedelta(days=2),  # Já venceu
                "renewal_price": 24.99,
                "status": "expired"
            }
        ]
        
        return sample_renewals
    
    def check_notification_timing(self, renewal_date, days_threshold=[30, 7, 1]):
        """Verifica se está na hora de notificar"""
        today = datetime.now()
        days_until = (renewal_date - today).days
        
        return days_until in days_threshold
    
    def send_email_notification(self, renewal_data):
        """Envia notificação por email"""
        try:
            # Template de email
            subject = f"⚠️ Aviso de Renovação - {renewal_data['service_name']}"
            
            body = f"""
Prezado(a) cliente,

Informamos que seu serviço está próximo do vencimento:

📋 Detalhes do Serviço:
• Serviço: {renewal_data['service_name']}
• Tipo: {renewal_data['service_type']}
• Data de Vencimento: {renewal_data['renewal_date'].strftime('%d/%m/%Y')}
• Valor de Renovação: €{renewal_data['renewal_price']}

🔗 Para renovar:
1. Acesse: https://109.199.104.22:8090
2. Faça login com suas credenciais
3. Vá em Pacotes → Renovar

⏰ Importante:
• Renove até {renewal_data['renewal_date'].strftime('%d/%m/%Y')} para evitar interrupção
• Após vencimento, o serviço será suspenso
• Dados podem ser perdidos após 7 dias da suspensão

Dúvidas? Contate-nos:
📧 Email: suporte@visualdesigne.com
📞 Telefone: +351 XXX XXX XXX

Atenciosamente,
Equipe VisualDesign
            """.strip()
            
            # Comando para enviar email
            cmd = f'echo "{body}" | mail -s "{subject}" cliente@exemplo.com'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.log_message(f"✅ Email enviado para {renewal_data['service_name']}")
                return True
            else:
                self.log_message(f"❌ Erro ao enviar email: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_message(f"❌ Exceção ao enviar email: {str(e)}")
            return False
    
    def generate_dashboard_alerts(self, renewals):
        """Gera alertas para o dashboard"""
        alerts = []
        
        for renewal in renewals:
            days_until = (renewal['renewal_date'] - datetime.now()).days
            
            if days_until <= 30:
                alert_type = "danger" if days_until <= 7 else "warning"
                alerts.append({
                    "type": alert_type,
                    "title": f"Renovação {renewal['service_name']}",
                    "message": f"Vence em {days_until} dias ({renewal['renewal_date'].strftime('%d/%m/%Y')})",
                    "action": f"Renovar por €{renewal['renewal_price']}",
                    "user_id": renewal['user_id']
                })
        
        return alerts
    
    def run_daily_check(self):
        """Execução diária do sistema de notificações"""
        self.log_message("🚀 Iniciando verificação diária de renovações")
        
        # 1. Obter dados do CyberPanel
        if not self.get_websites_from_cyberpanel():
            self.log_message("❌ Falha ao obter websites do CyberPanel")
            return False
        
        if not self.get_users_from_cyberpanel():
            self.log_message("❌ Falha ao obter usuários do CyberPanel")
            return False
        
        # 2. Calcular renovações
        renewals = self.calculate_renewal_dates()
        self.log_message(f"📊 Encontradas {len(renewals)} renovações para verificar")
        
        # 3. Verificar e enviar notificações
        notifications_sent = 0
        
        for renewal in renewals:
            if self.check_notification_timing(renewal['renewal_date']):
                if self.send_email_notification(renewal):
                    notifications_sent += 1
        
        # 4. Gerar alertas do dashboard
        dashboard_alerts = self.generate_dashboard_alerts(renewals)
        
        # 5. Salvar alertas em arquivo JSON para dashboard
        alerts_file = "/tmp/cyberpanel_renewal_alerts.json"
        import json
        
        with open(alerts_file, "w") as f:
            json.dump(dashboard_alerts, f, indent=2, default=str)
        
        self.log_message(f"📧 {notifications_sent} notificações enviadas")
        self.log_message(f"🔔 {len(dashboard_alerts)} alertas gerados para dashboard")
        self.log_message(f"💾 Alertas salvos em {alerts_file}")
        
        return True
    
    def install_cron_job(self):
        """Instala tarefa cron para execução diária"""
        cron_entry = "0 8 * * * /usr/local/bin/cyberpanel-renewals.py >> /var/log/cyberpanel-renewals.log 2>&1"
        
        try:
            # Adicionar ao crontab
            result = subprocess.run(
                f'(crontab -l 2>/dev/null; echo "{cron_entry}") | crontab -',
                shell=True,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log_message("✅ Tarefa cron instalada com sucesso")
                return True
            else:
                self.log_message(f"❌ Erro ao instalar cron: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_message(f"❌ Exceção ao instalar cron: {str(e)}")
            return False

def main():
    """Função principal"""
    system = RenewalNotificationSystem()
    
    print("🔧 Sistema de Notificações de Renovação - CyberPanel")
    print("=" * 60)
    
    # Menu de opções
    print("1. Executar verificação imediata")
    print("2. Instalar tarefa cron diária")
    print("3. Ver status atual")
    print("4. Sair")
    
    try:
        choice = input("\nEscolha uma opção (1-4): ").strip()
        
        if choice == "1":
            print("\n🔄 Executando verificação imediata...")
            system.run_daily_check()
            
        elif choice == "2":
            print("\n⏰ Instalando tarefa cron diária...")
            system.install_cron_job()
            
        elif choice == "3":
            print("\n📊 Verificando status...")
            if os.path.exists(system.log_file):
                with open(system.log_file, "r") as f:
                    print(f.read()[-1000:])  # Últimas 1000 linhas
            else:
                print("Nenhum log encontrado ainda.")
                
        elif choice == "4":
            print("\n👋 Saindo...")
            sys.exit(0)
            
        else:
            print("\n❌ Opção inválida!")
            
    except KeyboardInterrupt:
        print("\n\n👋 Operação cancelada pelo usuário.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
