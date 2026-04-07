#!/usr/bin/env python3
"""
API Wrapper para CyberPanel - Solução para erro 500
Usa CLI em vez de REST API para evitar problemas
"""

import subprocess
import json
import sys
from pathlib import Path

class CyberPanelAPIWrapper:
    def __init__(self):
        self.timeout = 30
    
    def run_command(self, command, timeout=None):
        """Executa comando CLI com timeout"""
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout or self.timeout,
                shell=True
            )
            
            if result.returncode == 0:
                return {
                    'success': True,
                    'data': result.stdout.strip(),
                    'error': None
                }
            else:
                return {
                    'success': False,
                    'data': None,
                    'error': result.stderr.strip()
                }
                
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'data': None,
                'error': f'Command timeout after {timeout or self.timeout}s'
            }
        except Exception as e:
            return {
                'success': False,
                'data': None,
                'error': str(e)
            }
    
    def list_users(self):
        """Lista usuários via CLI"""
        result = self.run_command("cyberpanel listUsers")
        
        if result['success']:
            try:
                # Parse do output JSON
                data = json.loads(result['data'])
                return {
                    'success': True,
                    'users': data.get('data', [])
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'error': 'Invalid JSON response',
                    'raw_output': result['data']
                }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def list_websites(self):
        """Lista websites via CLI"""
        result = self.run_command("cyberpanel listWebsites")
        
        if result['success']:
            try:
                data = json.loads(result['data'])
                return {
                    'success': True,
                    'websites': data.get('data', [])
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'error': 'Invalid JSON response',
                    'raw_output': result['data']
                }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def create_user(self, username, email, password, first_name="", last_name=""):
        """Cria usuário via CLI"""
        command = f"cyberpanel createUser --userName {username} --email {email} --password '{password}' --firstName '{first_name}' --lastName '{last_name}'"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': 'User created successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def delete_user(self, username):
        """Deleta usuário via CLI"""
        command = f"cyberpanel deleteUser --userName {username}"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': 'User deleted successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def suspend_user(self, username, state="Suspend"):
        """Suspende/Ativa usuário via CLI"""
        command = f"cyberpanel suspendUser --userName {username} --state {state}"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': f'User {state.lower()}ed successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def modify_user(self, username, **kwargs):
        """Modifica usuário via CLI"""
        commands = []
        
        if 'password' in kwargs:
            commands.append(f"--password '{kwargs['password']}'")
        if 'websites_limit' in kwargs:
            commands.append(f"--websitesLimit {kwargs['websites_limit']}")
        if 'acl' in kwargs:
            commands.append(f"--selectedACL {kwargs['acl']}")
        
        if commands:
            command = f"cyberpanel modifyUser --userName {username} {' '.join(commands)}"
            result = self.run_command(command)
            
            if result['success']:
                return {
                    'success': True,
                    'message': 'User modified successfully'
                }
            else:
                return {
                    'success': False,
                    'error': result['error']
                }
        else:
            return {
                'success': False,
                'error': 'No parameters to modify'
            }
    
    def create_website(self, domain, owner, email, php="8.2", package="Default"):
        """Cria website via CLI"""
        command = f"cyberpanel createWebsite --domainName {domain} --owner {owner} --email {email} --php {php} --package {package}"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Website created successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def delete_website(self, domain):
        """Deleta website via CLI"""
        command = f"cyberpanel deleteWebsite --domainName {domain}"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Website deleted successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def create_email(self, domain, username, password):
        """Cria email via CLI"""
        command = f"cyberpanel createEmail --domainName {domain} --userName {username} --password '{password}'"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Email created successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def delete_email(self, email):
        """Deleta email via CLI"""
        command = f"cyberpanel deleteEmail --email {email}"
        result = self.run_command(command)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Email deleted successfully'
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }
    
    def issue_ssl(self, domain):
        """Emite SSL via CLI"""
        command = f"cyberpanel issueSSL --domainName {domain}"
        result = self.run_command(command, timeout=120)  # SSL pode demorar
        
        if result['success']:
            return {
                'success': True,
                'message': 'SSL issued successfully',
                'output': result['data']
            }
        else:
            return {
                'success': False,
                'error': result['error']
            }

def main():
    """Função principal para testes"""
    api = CyberPanelAPIWrapper()
    
    print("🔧 CyberPanel API Wrapper - Test")
    print("=" * 50)
    
    # Testar listUsers
    print("\n1. Testando listUsers...")
    users = api.list_users()
    if users['success']:
        print(f"✅ {len(users['users'])} usuários encontrados")
        for user in users['users'][:3]:
            print(f"   - {user.get('name', 'N/A')} ({user.get('email', 'N/A')})")
    else:
        print(f"❌ Erro: {users['error']}")
    
    # Testar listWebsites
    print("\n2. Testando listWebsites...")
    websites = api.list_websites()
    if websites['success']:
        print(f"✅ {len(websites['websites'])} websites encontrados")
        for site in websites['websites'][:3]:
            print(f"   - {site.get('domain', 'N/A')}")
    else:
        print(f"❌ Erro: {websites['error']}")
    
    print("\n✅ Testes concluídos!")

if __name__ == "__main__":
    main()
