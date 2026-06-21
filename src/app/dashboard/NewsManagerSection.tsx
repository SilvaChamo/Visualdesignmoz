'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Edit2, Globe, Image as ImageIcon, Languages, Loader2, Newspaper, Plus, Save, Trash2, X } from 'lucide-react'
import { MultiFileUpload } from '@/components/admin/MultiFileUpload'

type NewsItem = {
  id: string
  title_pt: string
  content_pt: string
  title_en?: string
  content_en?: string
  title_fr?: string
  content_fr?: string
  image_url?: string
  gallery_urls?: string[]
  published: boolean
  created_at: string
  published_at?: string
}

type NewsForm = {
  id?: string
  title_pt: string
  content_pt: string
  image_url: string
  gallery_urls: string[]
  published: boolean
}

const emptyForm: NewsForm = {
  title_pt: '',
  content_pt: '',
  image_url: '',
  gallery_urls: [],
  published: true,
}

export function NewsManagerSection() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingItem, setEditingItem] = useState<NewsForm | null>(null)

  const loadNews = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/news?site_slug=aamihe')
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao carregar notícias')
      setNews(data.news || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar notícias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadNews()
  }, [])

  const startCreate = () => {
    setSuccess('')
    setError('')
    setEditingItem(emptyForm)
  }

  const startEdit = (item: NewsItem) => {
    setSuccess('')
    setError('')
    setEditingItem({
      id: item.id,
      title_pt: item.title_pt || '',
      content_pt: item.content_pt || '',
      image_url: item.image_url || '',
      gallery_urls: item.gallery_urls || [],
      published: item.published !== false,
    })
  }

  const handleSave = async () => {
    if (!editingItem?.title_pt.trim() || !editingItem?.content_pt.trim()) {
      setError('Preencha o título e o conteúdo da notícia.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingItem,
          site_slug: 'aamihe',
          auto_translate: true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao salvar notícia')

      setSuccess('Notícia salva, traduzida e disponível para o site AAMIHE.')
      setEditingItem(null)
      await loadNews()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar notícia')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta notícia do AAMIHE?')) return

    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/admin/news?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao eliminar notícia')
      setSuccess('Notícia eliminada.')
      await loadNews()
    } catch (err: any) {
      setError(err.message || 'Erro ao eliminar notícia')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-blue-600" />
            Gestor de Notícias AAMIHE
          </h2>
          <p className="text-sm text-gray-500">Publica notícias, galeria e traduções para PT, EN e FR no site estático da Vercel.</p>
        </div>
        <button
          onClick={startCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Nova Notícia
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      {editingItem ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              {editingItem.id ? 'Editar Notícia' : 'Criar Notícia em Português'}
            </h3>
            <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Título (PT)</label>
                <input
                  value={editingItem.title_pt}
                  onChange={e => setEditingItem({ ...editingItem, title_pt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Novo investimento na área..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Conteúdo (PT)</label>
                <textarea
                  value={editingItem.content_pt}
                  onChange={e => setEditingItem({ ...editingItem, content_pt: e.target.value })}
                  className="w-full h-56 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Escreva aqui o corpo da notícia..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={editingItem.published}
                  onChange={e => setEditingItem({ ...editingItem, published: e.target.checked })}
                />
                Publicar no site AAMIHE
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Imagem Principal</label>
                <input
                  value={editingItem.image_url}
                  onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
                {editingItem.image_url && (
                  <img src={editingItem.image_url} alt="" className="mt-3 h-36 w-full object-cover rounded-xl border border-gray-100" />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Galeria</label>
                <MultiFileUpload
                  value={editingItem.gallery_urls}
                  onChange={urls => setEditingItem({ ...editingItem, gallery_urls: urls })}
                  bucket="site-media"
                  folder="aamihe/news"
                  description="Carregue imagens da galeria da notícia."
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-sm">
                  <Languages className="w-4 h-4" />
                  Tradução Inteligente
                </div>
                <p className="text-[11px] text-blue-600">
                  Ao salvar, o painel tenta traduzir para Inglês e Francês. Se a chave OpenAI não estiver configurada, publica PT como fallback para não bloquear o site.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar e Publicar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {loading && <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />A carregar notícias...</div>}
          {!loading && news.length === 0 && (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-500">
              Nenhuma notícia criada ainda para AAMIHE.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map(item => (
              <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                <div className="aspect-video bg-gray-100 rounded-xl mb-4 overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <div className="px-2 py-1 bg-white/90 backdrop-blur rounded text-[9px] font-bold">PT</div>
                    <div className="px-2 py-1 bg-white/90 backdrop-blur rounded text-[9px] font-bold">EN</div>
                    <div className="px-2 py-1 bg-white/90 backdrop-blur rounded text-[9px] font-bold">FR</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.published ? 'Publicado' : 'Rascunho'}
                  </span>
                  {!!item.gallery_urls?.length && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700">Galeria {item.gallery_urls.length}</span>}
                </div>
                <h4 className="font-bold text-gray-900 mb-2 line-clamp-2">{item.title_pt}</h4>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[10px] text-gray-400 font-bold">{new Date(item.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <a href="/api/public/site-news?site_slug=aamihe&lang=pt&limit=6" target="_blank" className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                      <Globe className="w-4 h-4" />
                    </a>
                    <button onClick={() => startEdit(item)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => void handleDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
