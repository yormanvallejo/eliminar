
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONFIGURACIÓN DE NUBE COMPARTIDA ---
// Utilizamos un bucket único para esta aplicación que permite persistencia global
const CLOUD_DB_URL = 'https://kvdb.io/A9S6B8C7D4E5F1G2H3J4/articly_global_articles';
const CATEGORIES = ['Tecnología', 'Negocios', 'Marketing', 'Ciencia', 'Arte', 'Diseño'];
const DEFAULT_IMG = 'https://picsum.photos/seed/article/800/600';

// --- SERVICIO DE DATOS GLOBAL ---
const cloudDb = {
  // Obtener artículos de la base de datos global
  fetch: async () => {
    try {
      const response = await fetch(CLOUD_DB_URL);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Error conectando a la base de datos global:", e);
      // Fallback a localStorage si la nube falla
      return JSON.parse(localStorage.getItem('articly_cache') || '[]');
    }
  },
  // Guardar nuevo artículo en la base de datos global
  push: async (newArticle) => {
    try {
      // 1. Obtener lista actual
      const current = await cloudDb.fetch();
      // 2. Añadir el nuevo al principio
      const updated = [newArticle, ...current];
      // 3. Guardar en la nube (PUT)
      await fetch(CLOUD_DB_URL, {
        method: 'POST',
        body: JSON.stringify(updated)
      });
      // Guardar copia local para velocidad
      localStorage.setItem('articly_cache', JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error("Error al sincronizar con la nube:", e);
      throw e;
    }
  },
  // Eliminar artículo (Global)
  remove: async (id) => {
    const current = await cloudDb.fetch();
    const updated = current.filter(a => a.id !== id);
    await fetch(CLOUD_DB_URL, {
      method: 'POST',
      body: JSON.stringify(updated)
    });
    localStorage.setItem('articly_cache', JSON.stringify(updated));
    return updated;
  }
};

// --- IA SERVICES ---
const aiService = {
  generate: async (title, cat) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escribe un resumen premium de 150 palabras para un artículo de marketplace. Título: "${title}", Categoría: "${cat}".`
    });
    return response.text;
  }
};

// --- COMPONENTES ---

const Nav = ({ onAdd, isSyncing }) => html`
  <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 h-20 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
      </div>
      <div>
        <span className="text-xl font-black tracking-tighter text-slate-900 block leading-none">ARTICLY</span>
        <div className="flex items-center gap-1.5 mt-1">
          <div className=${`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${isSyncing ? 'Sincronizando...' : 'Base de Datos Global'}</span>
        </div>
      </div>
    </div>
    <div className="flex gap-4">
      <button onClick=${onAdd} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
        <span className="hidden sm:inline">Vender Artículo</span>
      </button>
    </div>
  </nav>
`;

const Card = ({ article, onRemove, onSelect }) => html`
  <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] transition-all group flex flex-col h-full cursor-pointer" onClick=${() => onSelect(article)}>
    <div className="relative aspect-[4/3] overflow-hidden">
      <img src=${article.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute top-5 right-5 bg-white/95 backdrop-blur px-4 py-1.5 rounded-full text-sm font-black text-indigo-600 shadow-xl border border-white/20">
        $${article.price.toFixed(2)}
      </div>
      <div className="absolute bottom-5 left-5 bg-indigo-600/90 backdrop-blur-md text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
        ${article.category}
      </div>
    </div>
    <div className="p-7 flex-1 flex flex-col">
      <h3 className="text-xl font-bold text-slate-800 mb-4 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">${article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-3 mb-8 flex-1 leading-relaxed">${article.content}</p>
      <div className="flex items-center justify-between pt-5 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-[10px]">${article.author.charAt(0)}</div>
          <span className="text-xs font-bold text-slate-700">${article.author}</span>
        </div>
        <button onClick=${(e) => { e.stopPropagation(); onRemove(article.id); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors hover:bg-red-50 rounded-xl">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  </div>
`;

const Form = ({ onSave, onCancel, isSaving }) => {
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
    <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-300 overflow-y-auto no-scrollbar max-h-[90vh]">
      <h2 className="text-3xl font-black mb-8 tracking-tighter">Nueva Publicación Global</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título del Artículo</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium" value=${data.title} onChange=${e => setData({...data, title: e.target.value})} placeholder="Ej. El Futuro de la IA" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tu Nombre</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium" value=${data.author} onChange=${e => setData({...data, author: e.target.value})} placeholder="Ej. Juan Pérez" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
            <select className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none cursor-pointer font-medium" value=${data.category} onChange=${e => setData({...data, category: e.target.value})}>
              ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio ($)</label>
            <input type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" value=${data.price} onChange=${e => setData({...data, price: parseFloat(e.target.value)})} />
          </div>
        </div>
        <div className="space-y-1.5 relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contenido</label>
          <textarea rows="6" className="w-full p-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none leading-relaxed" value=${data.content} onChange=${e => setData({...data, content: e.target.value})} placeholder="Describe tu artículo..." />
          <button onClick=${handleGen} disabled=${loadingAI} className="absolute bottom-5 right-5 bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
            ${loadingAI ? 'CREANDO...' : '✨ GENERAR CON IA'}
          </button>
        </div>
        <div className="flex gap-4 pt-6">
          <button onClick=${onCancel} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
          <button onClick=${() => onSave({...data, id: Date.now(), image: `${DEFAULT_IMG}?${Date.now()}`})} disabled=${isSaving} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all">
            ${isSaving ? 'SINCRONIZANDO...' : 'PUBLICAR EN LA NUBE'}
          </button>
        </div>
      </div>
    </div>
  `;
};

// --- APP ---
const App = () => {
  const [articles, setArticles] = useState([]);
  const [view, setView] = useState({ modal: false, selected: null });
  const [filter, setFilter] = useState({ search: '', cat: 'Todos' });
  const [isSyncing, setIsSyncing] = useState(false);

  // Carga inicial de base de datos compartida
  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      const data = await cloudDb.fetch();
      setArticles(data);
      setIsSyncing(false);
    };
    loadData();
    
    // Auto-refresco cada 30 segundos para ver nuevos artículos de otros usuarios
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const handleSave = async (art) => {
    setIsSyncing(true);
    try {
      const updated = await cloudDb.push(art);
      setArticles(updated);
      setView({ modal: false, selected: null });
    } catch (e) {
      alert("Error al sincronizar. Revisa tu conexión.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemove = async (id) => {
    if (!confirm("¿Eliminar este artículo globalmente?")) return;
    setIsSyncing(true);
    const updated = await cloudDb.remove(id);
    setArticles(updated);
    setIsSyncing(false);
  };

  const filtered = useMemo(() => {
    return articles.filter(a => 
      (filter.cat === 'Todos' || a.category === filter.cat) &&
      (a.title.toLowerCase().includes(filter.search.toLowerCase()) || a.author.toLowerCase().includes(filter.search.toLowerCase()))
    );
  }, [articles, filter]);

  return html`
    <div className="min-h-screen bg-slate-50/30">
      <${Nav} onAdd=${() => setView({modal: true, selected: null})} isSyncing=${isSyncing} />
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-8 mb-16 items-center justify-between">
          <div className="flex gap-3 overflow-x-auto no-scrollbar w-full lg:w-auto py-2">
            <button onClick=${() => setFilter({...filter, cat: 'Todos'})} className=${`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all ${filter.cat === 'Todos' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border text-slate-400 hover:border-indigo-200 shadow-sm'}`}>Todos</button>
            ${CATEGORIES.map(c => html`
              <button key=${c} onClick=${() => setFilter({...filter, cat: c})} className=${`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${filter.cat === c ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border text-slate-400 hover:border-indigo-200 shadow-sm'}`}>${c}</button>
            `)}
          </div>
          <div className="relative w-full lg:w-96">
            <input className="w-full bg-white border border-slate-200 rounded-[1.5rem] px-14 py-4 text-sm focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all shadow-sm" placeholder="Buscar por título o autor..." value=${filter.search} onChange=${e => setFilter({...filter, search: e.target.value})} />
            <svg className="absolute left-6 top-4.5 text-slate-300" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        ${filtered.length > 0 ? html`
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-10">
            ${filtered.map(a => html`<${Card} key=${a.id} article=${a} onRemove=${handleRemove} onSelect=${(art) => setView({modal: false, selected: art})} />`)}
          </div>
        ` : html`
          <div className="py-40 text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="text-slate-300" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            </div>
            <p className="text-2xl font-black text-slate-300 italic">No se encontraron artículos globales</p>
            <button onClick=${() => setView({modal: true, selected: null})} className="mt-6 text-indigo-600 font-bold hover:underline">Publica el primero para que todos lo vean</button>
          </div>
        `}
      </main>

      ${view.modal && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6" onClick=${() => setView({...view, modal: false})}>
          <div onClick=${e => e.stopPropagation()} className="w-full flex justify-center"><${Form} onCancel=${() => setView({...view, modal: false})} onSave=${handleSave} isSaving=${isSyncing} /></div>
        </div>
      `}

      ${view.selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-10 overflow-y-auto" onClick=${() => setView({...view, selected: null})}>
          <div className="w-full max-w-5xl bg-white rounded-[3.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick=${e => e.stopPropagation()}>
            <div className="relative aspect-[21/9]">
              <img src=${view.selected.image} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
              <button onClick=${() => setView({...view, selected: null})} className="absolute top-10 right-10 bg-white/20 p-4 rounded-full hover:bg-white/40 text-white backdrop-blur transition-all">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
              <div className="absolute bottom-10 left-10 right-10">
                <span className="bg-indigo-600 text-white px-4 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-4 inline-block">${view.selected.category}</span>
                <h1 className="text-5xl font-black text-white leading-tight drop-shadow-2xl">${view.selected.title}</h1>
              </div>
            </div>
            <div className="p-12 sm:p-20">
              <div className="flex items-center gap-6 mb-16 pb-12 border-b border-slate-50">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-2xl">${view.selected.author.charAt(0)}</div>
                <div>
                  <p className="text-slate-900 font-black text-xl leading-none mb-2">${view.selected.author}</p>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Publicado en la Nube Global</p>
                </div>
              </div>
              <div className="max-w-3xl">
                <p className="text-slate-600 text-2xl leading-relaxed whitespace-pre-wrap font-serif italic">${view.selected.content}</p>
              </div>
              <div className="mt-20 flex flex-col sm:flex-row justify-between items-center bg-indigo-50/50 p-10 rounded-[3rem] border border-indigo-100/50 gap-8">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Precio de Licencia Global</p>
                  <p className="text-5xl font-black text-slate-900">$${view.selected.price.toFixed(2)}</p>
                </div>
                <button className="bg-indigo-600 text-white px-14 py-5 rounded-[2rem] font-black shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-700 active:scale-95 transition-all text-lg">ACCEDER AL ARTÍCULO</button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
