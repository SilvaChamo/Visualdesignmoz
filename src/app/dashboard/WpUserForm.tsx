'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import './admin-wp.css';

interface WpUserRow {
  ID: string;
  user_login: string;
  user_email: string;
  roles: string;
  user_registered: string;
  user_url?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  telefone?: string;
  profissao?: string;
  cargo?: string;
  description?: string;
}

export interface WpUserFormProps {
  domain: string;
  user: WpUserRow | null; // null for create mode, object for edit mode
  onSave: () => void;
  onCancel: () => void;
}

export function WpUserForm({ domain, user, onSave, onCancel }: WpUserFormProps) {
  const isEditing = !!user;
  
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    alcunha: '',
    displayNameType: 'full_name',
    email: '',
    website: '',
    bio: '',
    telefone: '',
    profissao: '',
    cargo: '',
    role: 'administrator',
  });

  const [password, setPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPasswordText, setShowConfirmPasswordText] = useState(false);

  useEffect(() => {
    if (isEditing && user?.user_login) {
      setLoading(true);
      fetch(`/api/admin/wp-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', domain, username: user.user_login })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          const u = data.user;
          // In WP, nickname is often saved as nickname meta. For display_name, it varies. 
          // We map what we have.
          setForm({
            username: u.user_login || '',
            firstName: u.first_name || '',
            lastName: u.last_name || '',
            alcunha: u.display_name !== `${u.first_name} ${u.last_name}` ? u.display_name : '',
            displayNameType: 'full_name',
            email: u.user_email || '',
            website: u.user_url || '',
            bio: u.description || '',
            telefone: u.telefone || '',
            profissao: u.profissao || '',
            cargo: u.cargo || '',
            role: (u.roles && u.roles.split(',')[0]) || 'administrator',
          });
        }
      })
      .catch(err => {
        console.error(err);
        setError('Erro ao carregar dados do utilizador');
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isEditing, user, domain]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setSaving(true);
    
    // Determine the actual display_name string to pass
    let finalDisplayName = '';
    if (form.displayNameType === 'first_name') finalDisplayName = form.firstName;
    else if (form.displayNameType === 'last_name') finalDisplayName = form.lastName;
    else if (form.displayNameType === 'alcunha') finalDisplayName = form.alcunha;
    else finalDisplayName = `${form.firstName} ${form.lastName}`.trim();

    try {
      const res = await fetch('/api/admin/wp-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'update' : 'create',
          domain,
          username: form.username, // WP requires username even in update
          email: form.email,
          role: form.role,
          password: password || undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          website: form.website,
          displayName: finalDisplayName,
          bio: form.bio,
          telefone: form.telefone,
          profissao: form.profissao,
          cargo: form.cargo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao guardar');
      
      onSave(); // Refresh list and hide form
    } catch (err: any) {
      setError(err.message || 'Erro ao guardar utilizador');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="wp-admin-page text-center py-12">
        <Loader2 className="animate-spin h-8 w-8 mx-auto text-zinc-400" />
        <p className="mt-2 text-zinc-500">A carregar dados do utilizador...</p>
      </div>
    );
  }

  return (
    <div className="wp-admin-page wp-form-wrap dark:!text-zinc-200">
      {error && <div className="wp-notice-error dark:!bg-red-900/20 dark:!border-red-500/50 dark:!text-red-400">{error}</div>}

      <form onSubmit={handleSave}>
        <table className="wp-form-table dark:!bg-zinc-900 dark:!border-zinc-800">
          <tbody className="dark:!divide-zinc-800">
            <tr className="section-row section-row--plain dark:!bg-zinc-900">
              <th colSpan={2}>
                <h2 className="dark:!text-zinc-200">Nome</h2>
              </th>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Nome de utilizador (obrigatório)</th>
              <td>
                <input
                  type="text"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  disabled={isEditing}
                />
                {isEditing && <p className="description dark:!text-zinc-500">Os nomes de utilizador não podem ser alterados.</p>}
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">E-mail (obrigatório)</th>
              <td>
                <input
                  type="email"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">
                Nome próprio
              </th>
              <td>
                <input
                  type="text"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">
                Apelido
              </th>
              <td>
                <input
                  type="text"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Alcunha</th>
              <td>
                <input
                  type="text"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.alcunha}
                  onChange={(e) => setForm({ ...form, alcunha: e.target.value })}
                />
                <p className="description dark:!text-zinc-500">Opcional. Se preenchida, aparecerá como o nome do autor.</p>
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Exibir o nome publicamente como</th>
              <td>
                <select
                  className="wp-select dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.displayNameType}
                  onChange={(e) => setForm({ ...form, displayNameType: e.target.value })}
                >
                  <option value="first_name">{form.firstName || 'Nome próprio'}</option>
                  <option value="last_name">{form.lastName || 'Apelido'}</option>
                  <option value="full_name">
                    {`${form.firstName} ${form.lastName}`.trim() || 'Nome e Apelido'}
                  </option>
                  <option value="alcunha">{form.alcunha || 'Alcunha'}</option>
                </select>
              </td>
            </tr>
            
            <tr className="section-row section-row--plain dark:!bg-zinc-900 mt-4">
              <th colSpan={2}>
                <h2 className="dark:!text-zinc-200">Informação de Contacto e Biografia</h2>
              </th>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Website</th>
              <td>
                <input
                  type="url"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Telefone</th>
              <td>
                <input
                  type="tel"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="+258 84 123 4567"
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Profissão</th>
              <td>
                <input
                  type="text"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.profissao}
                  onChange={(e) => setForm({ ...form, profissao: e.target.value })}
                  placeholder="Ex: Jornalista, Engenheiro"
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Cargo</th>
              <td>
                <input
                  type="text"
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  placeholder="Ex: Editor Chefe"
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Informação biográfica</th>
              <td>
                <textarea
                  className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  rows={4}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                ></textarea>
              </td>
            </tr>

            <tr className="section-row dark:!bg-zinc-900/50">
              <th colSpan={2} className="dark:!border-zinc-800">
                <h2 className="dark:!text-zinc-200">Palavra-passe</h2>
              </th>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">
                Palavra-passe {isEditing ? '(deixar em branco para manter)' : '(obrigatório)'}
              </th>
              <td>
                <div className="wp-password-field">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isEditing}
                  />
                  <button
                    type="button"
                    className="wp-password-toggle dark:!text-zinc-400 hover:dark:!text-zinc-200"
                    onClick={() => setShowPasswordText((v) => !v)}
                  >
                    {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">
                Confirmar palavra-passe {!isEditing && <span style={{ color: '#d63638' }}>*</span>}
              </th>
              <td>
                <div className="wp-password-field">
                  <input
                    type={showConfirmPasswordText ? 'text' : 'password'}
                    className="wp-input dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!isEditing && !!password}
                  />
                  <button
                    type="button"
                    className="wp-password-toggle dark:!text-zinc-400 hover:dark:!text-zinc-200"
                    onClick={() => setShowConfirmPasswordText((v) => !v)}
                  >
                    {showConfirmPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </td>
            </tr>

            <tr className="section-row dark:!bg-zinc-900/50">
              <th colSpan={2} className="dark:!border-zinc-800">
                <h2 className="dark:!text-zinc-200">Papel</h2>
              </th>
            </tr>
            <tr>
              <th scope="row" className="dark:!text-zinc-300">Papel</th>
              <td>
                <select
                  className="wp-select dark:!bg-zinc-950 dark:!border-zinc-700 dark:!text-zinc-200"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="administrator">Administrador</option>
                  <option value="editor">Editor</option>
                  <option value="author">Autor</option>
                  <option value="contributor">Colaborador</option>
                  <option value="subscriber">Subscritor</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="wp-form-actions pt-6">
          <button type="submit" className="wp-btn wp-btn-primary !bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700 hover:!border-emerald-700" disabled={saving}>
            {saving && <Loader2 size={16} className="spin mr-2 animate-spin" />}
            {isEditing ? 'Actualizar utilizador' : 'Adicionar novo utilizador'}
          </button>
          <button type="button" onClick={onCancel} className="wp-btn dark:!bg-zinc-800 dark:!border-zinc-700 dark:!text-zinc-300 hover:dark:!bg-zinc-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
