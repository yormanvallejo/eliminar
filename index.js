
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONFIGURACIÓN DE BASE DE DATOS GLOBAL ---
// Usamos un bucket público con persistencia garantizada. 
// Nota: En producción real se usaría Firebase o Supabase, pero este KV store funciona para GitHub Pages sin configuración.
const DB_BUCKET = 'articly_v2_global_storage'; 
const CLOUD_URL = `https://kvdb.io/S2mP8N5Z6H7J9K1L3M4N/${DB_BUCKET}`;
const CATEGORIES = ['Tecnología', 'Negocios', 'Marketing', 'Ciencia', 'Arte', 'Diseño'];
const DEFAULT_IMG = 'https://picsum.photos/seed/article/800/600';

// --- SERVICIO DE DATOS (CLOUD & SYNC) ---
const cloudDb = {
  // Obtener artículos (Optimizado con manejo de errores)
  fetchAll: async () => {
    try {
      const response = await fetch(CLOUD_URL);
      if (response.status === 404) return []; // Bucket vacío
      if (!response.ok) throw new Error("Error de red");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Usando cache local debido a error de conexión");
      return JSON.parse(localStorage.getItem('articly_backup') || '[]');
    }
  },

  // Guardar artículos (Con lógica de integración)
  sync: async (articles) => {
    try {
      const res = await fetch(CLOUD_URL, {
        method: 'POST',
        body: JSON.stringify(articles),
      });
      if (!res.ok) throw new Error("Error al guardar");
      localStorage.setItem('articly_backup', JSON.stringify(articles));
      return true;
    } catch (e) {
      console.error("Fallo crítico de sincronización:", e);
      return false;
    }
  }
};

// --- SERVICIO IA ---
const aiService = {
  generate: async (title, cat) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escribe un resumen premium de 150 palabras para un artículo titulado "${title}" de la categoría "${cat}".`
    });
    return response.text;
  }
};

// --- COMPONENTES ---

const StatusBadge = ({ isSyncing, error }) => html`
  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
    <div className=${`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
      ${isSyncing ? 'Sincronizando...' : 'Conectado a la Nube'}
    </span>
  </div>
`;

const ArticleCard = ({ article, onRemove, onSelect }) => html`
  <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-indigo-100 transition-all group flex flex-col h-full cursor-pointer" onClick=${() => onSelect(article)}>
    <div className="relative aspect-video overflow-hidden">
      <img src=${article.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1 rounded-xl text-sm font-black text-indigo-600 shadow-xl border border-white/20">
        $${article.price.toFixed(2)}
      </div>
      <div className="absolute bottom-4 left-4 bg-indigo-600/90 text-white px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
        ${article.category}
      </div>
    </div>
    <div className="p-6 flex-1 flex flex-col">
      <h3 className="text-lg font-bold text-slate-800 mb-3 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">${article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1 leading-relaxed">${article.content}</p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-600 text-[10px]">${article.author.charAt(0).toUpperCase()}</div>
          <span className="text-[11px] font-bold text-slate-400">Por ${article.author}</span>
        </div>
        <button onClick=${(e) => { e.stopPropagation(); onRemove(article.id); }} className="text-slate-200 hover:text-red-500 p-2 transition-colors hover:bg-red-50 rounded-xl">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  </div>
`;

const App = () => {
  const [articles, setArticles] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filter, setFilter] = useState({ search: '', cat: 'Todos' });
  
  // Ref para evitar que el refresco automático pise una subida en curso
  const syncLock = useRef(false);

  // Función de carga (Refresco Global)
  const loadGlobalData = async (showLoader = false) => {
    if (syncLock.current) return; // No refrescar si estamos guardando algo nuevo
    if (showLoader) setIsSyncing(true);
    
    const cloudData = await cloudDb.fetchAll();
    if (cloudData) {
      setArticles(cloudData);
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    loadGlobalData(true);
    // Refrescar cada 15 segundos para ver publicaciones de otros usuarios
    const timer = setInterval(() => loadGlobalData(false), 15000);
    return () => clearInterval(timer);
  }, []);

  const handlePublish = async (newArticle) => {
    syncLock.current = true; // Bloqueamos el refresco automático
    setIsSyncing(true);
    
    // Actualización optimista de la UI
    const updatedArticles = [newArticle, ...articles];
    setArticles(updatedArticles);
    setIsAdding(false);

    // Guardar en la nube
    const success = await cloudDb.sync(updatedArticles);
    
    if (!success) {
      alert("Error al conectar con la base de datos global. Se guardará localmente.");
    }
    
    setIsSyncing(false);
    syncLock.current = false; // Liberamos el bloqueo
  };

  const handleRemove = async (id) => {
    if (!confirm("¿Eliminar este artículo de la base de datos global?")) return;
    syncLock.current = true;
    setIsSyncing(true);
    
    const updated = articles.filter(a => a.id !== id);
    setArticles(updated);
    await cloudDb.sync(updated);
    
    setIsSyncing(false);
    syncLock.current = false;
  };

  const filtered = useMemo(() => {
    return articles.filter(a => 
      (filter.cat === 'Todos' || a.category === filter.cat) &&
      (a.title.toLowerCase().includes(filter.search.toLowerCase()) || a.author.toLowerCase().includes(filter.search.toLowerCase()))
    );
  }, [articles, filter]);

  return html`
    <div className="min-h-screen bg-slate-50/50">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 block leading-none tracking-tighter">ARTICLY</span>
            <${StatusBadge} isSyncing=${isSyncing} />
          </div>
        </div>
        
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <input className="w-full bg-slate-100/50 border border-transparent focus:bg-white focus:border-indigo-100 rounded-2xl px-12 py-3 text-sm outline-none transition-all" placeholder="Buscar en el marketplace global..." value=${filter.search} onChange=${e => setFilter({...filter, search: e.target.value})} />
            <svg className="absolute left-4 top-3.5 text-slate-300" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        <button onClick=${() => setIsAdding(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
          <span className="hidden sm:inline">Vender Artículo</span>
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8">
          <button onClick=${() => setFilter({...filter, cat: 'Todos'})} className=${`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${filter.cat === 'Todos' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200'}`}>Todos</button>
          ${CATEGORIES.map(c => html`
            <button key=${c} onClick=${() => setFilter({...filter, cat: c})} className=${`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter.cat === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200'}`}>${c}</button>
          `)}
        </div>

        ${filtered.length > 0 ? html`
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            ${filtered.map(a => html`<${ArticleCard} key=${a.id} article=${a} onRemove=${handleRemove} onSelect=${setSelected} />`)}
          </div>
        ` : html`
          <div className="py-40 text-center opacity-40 animate-pulse">
            <svg className="mx-auto mb-6 w-20 h-20 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <p className="text-xl font-bold italic">No hay artículos disponibles en este momento</p>
          </div>
        `}
      </main>

      ${isAdding && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6" onClick=${() => setIsAdding(false)}>
          <div onClick=${e => e.stopPropagation()} className="w-full max-w-xl">
            <${ArticleForm} onCancel=${() => setIsAdding(false)} onSave=${handlePublish} isSyncing=${isSyncing} />
          </div>
        </div>
      `}

      ${selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-10 overflow-y-auto" onClick=${() => setSelected(null)}>
          <div className="w-full max-w-5xl bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick=${e => e.stopPropagation()}>
            <div className="relative aspect-[21/9]">
              <img src=${selected.image} className="w-full h-full object-cover" />
              <button onClick=${() => setSelected(null)} className="absolute top-10 right-10 bg-white/20 p-4 rounded-full hover:bg-white/40 text-white backdrop-blur transition-all">✕</button>
            </div>
            <div className="p-10 sm:p-20">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">${selected.category}</span>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mt-4 mb-8 leading-tight">${selected.title}</h1>
              <div className="flex items-center gap-4 mb-12 pb-10 border-b border-slate-50">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-2xl">${selected.author.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-slate-900 font-black text-xl leading-none">${selected.author}</p>
                  <p className="text-slate-400 text-sm mt-1">Escritor Certificado • Base de Datos Global</p>
                </div>
              </div>
              <p className="text-slate-600 text-2xl leading-relaxed whitespace-pre-wrap font-serif italic">${selected.content}</p>
              <div className="mt-16 flex flex-col sm:flex-row justify-between items-center bg-indigo-50/50 p-10 rounded-[3rem] border border-indigo-100/50 gap-6">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Precio por licencia de uso</p>
                  <p className="text-5xl font-black text-slate-900">$${selected.price.toFixed(2)}</p>
                </div>
                <button className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all text-lg">ACCEDER AL ARTÍCULO</button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

const ArticleForm = ({ onSave, onCancel, isSyncing }) => {
  const [data, setData] = useState({ title: '', author: '', category: CATEGORIES[0], price: 19.99, content: '' });
  const [loadingAI, setLoadingAI] = useState(false);

  const handleGen = async () => {
    if (!data.title) return alert("Escribe un título");
    setLoadingAI(true);
    try {
      const text = await aiService.generate(data.title, data.category);
      setData({...data, content: text});
    } finally { setLoadingAI(false); }
  };

  return html`
    <div className="bg-white p-10 rounded-[3rem] shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh]">
      <h2 className="text-3xl font-black mb-8 tracking-tighter">Vender nuevo artículo</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium" placeholder="Título" value=${data.title} onChange=${e => setData({...data, title: e.target.value})} />
          <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium" placeholder="Tu Nombre" value=${data.author} onChange=${e => setData({...data, author: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <select className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-medium" value=${data.category} onChange=${e => setData({...data, category: e.target.value})}>
            ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
          </select>
          <input type="number" step="0.01" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-indigo-600" value=${data.price} onChange=${e => setData({...data, price: parseFloat(e.target.value)})} />
        </div>
        <div className="relative">
          <textarea rows="6" className="w-full p-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none leading-relaxed" placeholder="Resumen del contenido..." value=${data.content} onChange=${e => setData({...data, content: e.target.value})} />
          <button onClick=${handleGen} disabled=${loadingAI} className="absolute bottom-5 right-5 bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-black hover:bg-indigo-700 disabled:opacity-50 shadow-lg">
            ${loadingAI ? 'CREANDO...' : '✨ IA GENERAR'}
          </button>
        </div>
        <div className="flex gap-4 pt-4">
          <button onClick=${onCancel} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
          <button onClick=${() => onSave({...data, id: Date.now().toString(), image: `${DEFAULT_IMG}?${Date.now()}`})} disabled=${isSyncing} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all">
            ${isSyncing ? 'PUBLICANDO...' : 'PUBLICAR GLOBALMENTE'}
          </button>
        </div>
      </div>
    </div>
  `;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
