
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONFIGURACIÓN DE ALMACENAMIENTO GLOBAL ---
// Usamos un endpoint público estable con una clave específica para este usuario
const BUCKET_ID = 'S2mP8N5Z6H7J9K1L3M4N';
const STORE_KEY = 'articly_v5_final_prod';
const CLOUD_URL = `https://kvdb.io/${BUCKET_ID}/${STORE_KEY}`;

const CATEGORIES = ['Tecnología', 'Negocios', 'Marketing', 'Ciencia', 'Arte', 'Diseño'];
const DEFAULT_IMG = 'https://picsum.photos/seed/article/800/600';

// --- SERVICIO DE BASE DE DATOS ---
const cloudDb = {
  // Carga inicial y refresco
  fetchAll: async () => {
    try {
      const response = await fetch(CLOUD_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error("Error de red");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Cargando backup local...");
      return JSON.parse(localStorage.getItem('articly_cache') || '[]');
    }
  },

  // Sincronización Global
  sync: async (articles) => {
    try {
      // Guardamos localmente primero por seguridad
      localStorage.setItem('articly_cache', JSON.stringify(articles));
      
      const res = await fetch(CLOUD_URL, {
        method: 'PUT', // PUT es más fiable para sobrescribir en kvdb.io
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articles),
      });
      
      return res.ok;
    } catch (e) {
      console.error("Fallo de sincronización:", e);
      return false;
    }
  }
};

const aiService = {
  generate: async (title, cat) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Escribe un resumen profesional de 150 palabras para un artículo titulado "${title}" de la categoría "${cat}".`
      });
      return response.text;
    } catch (e) {
      return "El contenido será generado pronto...";
    }
  }
};

// --- COMPONENTES ---

const StatusBadge = ({ isSyncing, lastError }) => html`
  <div className="flex flex-col items-start select-none">
    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
      <div className=${`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : (lastError ? 'bg-red-500' : 'bg-emerald-500')}`}></div>
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
        ${isSyncing ? 'Sincronizando' : (lastError ? 'Sin Conexión' : 'Base de Datos Global')}
      </span>
    </div>
  </div>
`;

const ArticleCard = ({ article, onRemove, onSelect }) => html`
  <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-indigo-200 transition-all group flex flex-col h-full cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500" onClick=${() => onSelect(article)}>
    <div className="relative aspect-video overflow-hidden">
      <img src=${article.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1 rounded-xl text-sm font-black text-indigo-600 shadow-xl border border-white/20">
        $${article.price.toFixed(2)}
      </div>
    </div>
    <div className="p-6 flex-1 flex flex-col">
      <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">${article.category}</div>
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
  const [lastError, setLastError] = useState(false);
  const [filter, setFilter] = useState({ search: '', cat: 'Todos' });
  
  // Bloqueo para evitar que el refresco automático pise cambios locales inmediatos
  const syncTimerRef = useRef(null);
  const isUpdatingRef = useRef(false);

  const loadGlobalData = async (force = false) => {
    // Si estamos en medio de una publicación o borrado, pausamos el refresco global
    if (isUpdatingRef.current && !force) return;
    
    if (force) setIsSyncing(true);
    const cloudData = await cloudDb.fetchAll();
    
    if (cloudData) {
      setArticles(cloudData);
      setLastError(false);
    } else {
      setLastError(true);
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    loadGlobalData(true);
    const interval = setInterval(() => loadGlobalData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePublish = async (newArticle) => {
    // 1. Bloqueamos refrescos externos
    isUpdatingRef.current = true;
    setIsSyncing(true);
    
    // 2. Actualización local inmediata (UI Reactiva)
    const updated = [newArticle, ...articles];
    setArticles(updated);
    setIsAdding(false);

    // 3. Intentamos guardar en la nube
    const success = await cloudDb.sync(updated);
    
    if (!success) {
      setLastError(true);
      // No mostramos alert para no interrumpir, el StatusBadge avisará
    }
    
    setIsSyncing(false);
    
    // 4. Mantenemos el bloqueo 10 seg para asegurar que la nube procesó el cambio
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      isUpdatingRef.current = false;
    }, 10000);
  };

  const handleRemove = async (id) => {
    if (!confirm("¿Eliminar este artículo globalmente?")) return;
    isUpdatingRef.current = true;
    setIsSyncing(true);
    
    const updated = articles.filter(a => a.id !== id);
    setArticles(updated);
    
    await cloudDb.sync(updated);
    setIsSyncing(false);
    
    setTimeout(() => { isUpdatingRef.current = false; }, 5000);
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
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          </div>
          <div className="hidden sm:block">
            <span className="text-xl font-black text-slate-900 block leading-none tracking-tighter">ARTICLY</span>
            <${StatusBadge} isSyncing=${isSyncing} lastError=${lastError} />
          </div>
        </div>
        
        <div className="flex-1 max-w-md mx-4 sm:mx-8">
          <div className="relative">
            <input className="w-full bg-slate-100/50 border border-transparent focus:bg-white focus:border-indigo-100 rounded-2xl px-12 py-3 text-sm outline-none transition-all" placeholder="Buscar en la base de datos global..." value=${filter.search} onChange=${e => setFilter({...filter, search: e.target.value})} />
            <svg className="absolute left-4 top-3.5 text-slate-300" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        <button onClick=${() => setIsAdding(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
          <span className="hidden md:inline">Publicar</span>
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-8">
          <button onClick=${() => setFilter({...filter, cat: 'Todos'})} className=${`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter.cat === 'Todos' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}>Todos</button>
          ${CATEGORIES.map(c => html`
            <button key=${c} onClick=${() => setFilter({...filter, cat: c})} className=${`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter.cat === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}>${c}</button>
          `)}
        </div>

        ${filtered.length > 0 ? html`
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            ${filtered.map(a => html`<${ArticleCard} key=${a.id} article=${a} onRemove=${handleRemove} onSelect=${setSelected} />`)}
          </div>
        ` : html`
          <div className="py-40 text-center text-slate-300">
            <p className="text-xl font-bold italic animate-pulse">Sincronizando con la nube...</p>
          </div>
        `}
      </main>

      ${isAdding && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300" onClick=${() => setIsAdding(false)}>
          <div onClick=${e => e.stopPropagation()} className="w-full max-w-xl">
            <${ArticleForm} onCancel=${() => setIsAdding(false)} onSave=${handlePublish} isSyncing=${isSyncing} />
          </div>
        </div>
      `}

      ${selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-10 overflow-y-auto" onClick=${() => setSelected(null)}>
          <div className="w-full max-w-4xl bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick=${e => e.stopPropagation()}>
            <div className="relative aspect-video">
              <img src=${selected.image} className="w-full h-full object-cover" />
              <button onClick=${() => setSelected(null)} className="absolute top-6 right-6 bg-black/20 hover:bg-black/40 text-white w-12 h-12 rounded-full backdrop-blur-sm transition-all flex items-center justify-center font-bold text-xl">✕</button>
            </div>
            <div className="p-10 sm:p-16">
              <h1 className="text-4xl font-black text-slate-900 mb-6 leading-tight">${selected.title}</h1>
              <div className="flex items-center gap-3 mb-10 pb-8 border-b border-slate-100">
                <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center font-black text-white text-xl">${selected.author.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-slate-900 font-bold leading-none">${selected.author}</p>
                  <p className="text-slate-400 text-xs mt-1 tracking-wide uppercase">Autor Verificado en Nube Global</p>
                </div>
              </div>
              <p className="text-slate-600 text-xl leading-relaxed whitespace-pre-wrap font-serif italic">${selected.content}</p>
              <div className="mt-12 flex justify-between items-center bg-indigo-50 p-8 rounded-3xl border border-indigo-100/50">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Inversión</p>
                  <p className="text-4xl font-black text-slate-900">$${selected.price.toFixed(2)}</p>
                </div>
                <button className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">ADQUIRIR ACCESO</button>
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
    if (!data.title) return alert("Escribe un título para que la IA trabaje");
    setLoadingAI(true);
    const text = await aiService.generate(data.title, data.category);
    setData({...data, content: text});
    setLoadingAI(false);
  };

  return html`
    <div className="bg-white p-10 rounded-[3rem] shadow-2xl">
      <h2 className="text-2xl font-black mb-8 tracking-tighter">Nueva Publicación Global</h2>
      <div className="space-y-5">
        <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-medium focus:ring-2 focus:ring-indigo-500/10" placeholder="Título del artículo" value=${data.title} onChange=${e => setData({...data, title: e.target.value})} />
        <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-medium focus:ring-2 focus:ring-indigo-500/10" placeholder="Nombre del autor" value=${data.author} onChange=${e => setData({...data, author: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <select className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-medium" value=${data.category} onChange=${e => setData({...data, category: e.target.value})}>
            ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
          </select>
          <input type="number" step="0.01" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-indigo-600" value=${data.price} onChange=${e => setData({...data, price: parseFloat(e.target.value)})} />
        </div>
        <div className="relative">
          <textarea rows="5" className="w-full p-5 bg-slate-50 border-none rounded-[2rem] outline-none resize-none leading-relaxed" placeholder="Resumen del contenido..." value=${data.content} onChange=${e => setData({...data, content: e.target.value})} />
          <button onClick=${handleGen} disabled=${loadingAI} className="absolute bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-black hover:bg-indigo-700 shadow-lg disabled:opacity-50 transition-all">
            ${loadingAI ? 'ESCRIBIENDO...' : '✨ USAR IA'}
          </button>
        </div>
        <div className="flex gap-4 pt-4">
          <button onClick=${onCancel} className="flex-1 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
          <button onClick=${() => onSave({...data, id: 'art_' + Date.now(), image: `${DEFAULT_IMG}?${Date.now()}`})} disabled=${isSyncing} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl active:scale-95 disabled:opacity-50 transition-all uppercase tracking-widest text-xs">
            ${isSyncing ? 'Conectando...' : 'Sincronizar Globalmente'}
          </button>
        </div>
      </div>
    </div>
  `;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
