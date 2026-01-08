
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const BUCKET_ID = 'S2mP8N5Z6H7J9K1L3M4N'; 
const DB_NAME = 'articly_gh_stable_v8'; // Nueva clave para limpiar cache previa
const CLOUD_URL = `https://kvdb.io/${BUCKET_ID}/${DB_NAME}`;

const CATEGORIES = ['Tecnología', 'Negocios', 'Marketing', 'Ciencia', 'Arte', 'Diseño'];
const DEFAULT_IMG = 'https://picsum.photos/seed/article/800/600';

const cloudDb = {
  fetch: async () => {
    try {
      const response = await fetch(CLOUD_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.status === 404) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return JSON.parse(localStorage.getItem('articly_backup') || '[]');
    }
  },
  save: async (articles) => {
    try {
      localStorage.setItem('articly_backup', JSON.stringify(articles));
      const response = await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articles)
      });
      return response.ok;
    } catch (e) {
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
        contents: `Resume profesionalmente en 150 palabras: "${title}" (${cat}).`
      });
      return response.text;
    } catch (e) { return "Generando contenido..."; }
  }
};

const ArticleCard = ({ article, onRemove, onSelect }) => html`
  <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-indigo-200 transition-all group flex flex-col h-full cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500" onClick=${() => onSelect(article)}>
    <div className="relative aspect-[4/3] overflow-hidden">
      <img src=${article.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
      <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-2xl text-sm font-black text-indigo-600 shadow-xl">$${article.price.toFixed(2)}</div>
    </div>
    <div className="p-7 flex-1 flex flex-col">
      <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">${article.category}</div>
      <h3 className="text-xl font-bold text-slate-800 mb-3 line-clamp-2 leading-tight">${article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">${article.content}</p>
      <div className="flex items-center justify-between pt-5 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-400">Por ${article.author}</span>
        <button onClick=${(e) => { e.stopPropagation(); onRemove(article.id); }} className="text-slate-200 hover:text-red-500 p-2 transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  </div>
`;

const App = () => {
  const [articles, setArticles] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [syncStatus, setSyncStatus] = useState('sync');
  const [filter, setFilter] = useState({ search: '', cat: 'Todos' });
  
  const isUpdating = useRef(false);

  const syncData = async (force = false) => {
    // Si estamos guardando algo, NO permitimos que el servidor pise los datos locales
    if (isUpdating.current && !force) return;
    
    setSyncStatus('loading');
    const serverData = await cloudDb.fetch();
    
    if (serverData) {
      setArticles(prev => {
        // ESTRATEGIA DE FUSIÓN: 
        // 1. Empezamos con los datos del servidor
        // 2. Buscamos artículos en nuestro estado local que NO estén en el servidor (recién creados)
        // 3. Los mantenemos para evitar que "desaparezcan" durante el lag del servidor
        const merged = [...serverData];
        prev.forEach(local => {
          const existsOnServer = serverData.find(s => s.id === local.id);
          if (!existsOnServer) {
            // Solo rescatamos artículos creados en los últimos 2 minutos (evita zombies)
            const timestamp = parseInt(local.id.split('_')[1]);
            if (Date.now() - timestamp < 120000) {
              merged.unshift(local);
            }
          }
        });
        // Ordenar por ID (que contiene el timestamp)
        return merged.sort((a,b) => b.id.localeCompare(a.id));
      });
      setSyncStatus('sync');
    } else {
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    syncData(true);
    const interval = setInterval(() => syncData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePublish = async (newArticle) => {
    isUpdating.current = true; // BLOQUEO ACTIVADO
    setSyncStatus('loading');
    
    const updated = [newArticle, ...articles];
    setArticles(updated);
    setIsAdding(false);

    const success = await cloudDb.save(updated);
    setSyncStatus(success ? 'sync' : 'error');
    
    // Mantenemos el bloqueo 20 segundos para dar tiempo a la base de datos a indexar
    setTimeout(() => { isUpdating.current = false; }, 20000);
  };

  const handleRemove = async (id) => {
    if (!confirm("¿Eliminar permanentemente?")) return;
    isUpdating.current = true;
    setSyncStatus('loading');
    const updated = articles.filter(a => a.id !== id);
    setArticles(updated);
    await cloudDb.save(updated);
    setTimeout(() => { isUpdating.current = false; }, 10000);
  };

  const filtered = useMemo(() => {
    return articles.filter(a => 
      (filter.cat === 'Todos' || a.category === filter.cat) &&
      (a.title.toLowerCase().includes(filter.search.toLowerCase()))
    );
  }, [articles, filter]);

  return html`
    <div className="min-h-screen bg-slate-50/50">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
             <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-slate-900 tracking-tighter">ARTICLY CLOUD</span>
            <div className="flex items-center gap-1.5">
              <div className=${`w-1.5 h-1.5 rounded-full ${syncStatus === 'sync' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                ${syncStatus === 'loading' ? 'Actualizando...' : 'Conectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-sm mx-10">
          <input className="w-full bg-slate-100 border-none rounded-2xl px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10" placeholder="Buscar..." value=${filter.search} onChange=${e => setFilter({...filter, search: e.target.value})} />
        </div>

        <button onClick=${() => setIsAdding(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest">
          Publicar
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-8">
          <button onClick=${() => setFilter({...filter, cat: 'Todos'})} className=${`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter.cat === 'Todos' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}>Todos</button>
          ${CATEGORIES.map(c => html`
            <button key=${c} onClick=${() => setFilter({...filter, cat: c})} className=${`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter.cat === c ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}>${c}</button>
          `)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          ${filtered.map(a => html`<${ArticleCard} key=${a.id} article=${a} onRemove=${handleRemove} onSelect=${setSelected} />`)}
        </div>

        ${filtered.length === 0 && html`
          <div className="py-40 text-center text-slate-300 font-bold italic animate-pulse">
            Buscando artículos en la red...
          </div>
        `}
      </main>

      ${isAdding && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6" onClick=${() => setIsAdding(false)}>
          <div onClick=${e => e.stopPropagation()} className="w-full max-w-xl">
             <${ArticleForm} onCancel=${() => setIsAdding(false)} onSave=${handlePublish} />
          </div>
        </div>
      `}

      ${selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex items-center justify-center p-6 overflow-y-auto" onClick=${() => setSelected(null)}>
          <div className="w-full max-w-4xl bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick=${e => e.stopPropagation()}>
            <img src=${selected.image} className="w-full h-80 object-cover" />
            <div className="p-10 sm:p-16">
              <h1 className="text-4xl font-black text-slate-900 mb-6 leading-tight">${selected.title}</h1>
              <p className="text-slate-600 text-xl leading-relaxed whitespace-pre-wrap font-serif italic mb-10">${selected.content}</p>
              <div className="flex justify-between items-center bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Inversión</p>
                  <p className="text-4xl font-black text-slate-900">$${selected.price.toFixed(2)}</p>
                </div>
                <button className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl">COMPRAR ACCESO</button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

const ArticleForm = ({ onSave, onCancel }) => {
  const [data, setData] = useState({ title: '', author: '', category: CATEGORIES[0], price: 15.00, content: '' });
  const [loadingAI, setLoadingAI] = useState(false);

  const handleGen = async () => {
    if (!data.title) return alert("Título necesario");
    setLoadingAI(true);
    const text = await aiService.generate(data.title, data.category);
    setData({...data, content: text});
    setLoadingAI(false);
  };

  return html`
    <div className="bg-white p-10 rounded-[3rem] shadow-2xl">
      <h2 className="text-2xl font-black mb-8 tracking-tighter">Publicación Segura en Nube</h2>
      <div className="space-y-4">
        <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" placeholder="Título" value=${data.title} onChange=${e => setData({...data, title: e.target.value})} />
        <input className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" placeholder="Autor" value=${data.author} onChange=${e => setData({...data, author: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <select className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" value=${data.category} onChange=${e => setData({...data, category: e.target.value})}>
            ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
          </select>
          <input type="number" step="0.01" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black text-indigo-600" value=${data.price} onChange=${e => setData({...data, price: parseFloat(e.target.value)})} />
        </div>
        <div className="relative">
          <textarea rows="5" className="w-full p-5 bg-slate-50 border-none rounded-[2rem] outline-none resize-none leading-relaxed" placeholder="Contenido..." value=${data.content} onChange=${e => setData({...data, content: e.target.value})} />
          <button onClick=${handleGen} className="absolute bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-black shadow-lg">
            ${loadingAI ? 'ESCRIBIENDO...' : '✨ USAR IA'}
          </button>
        </div>
        <div className="flex gap-4 pt-4">
          <button onClick=${onCancel} className="flex-1 font-bold text-slate-400">Cancelar</button>
          <button onClick=${() => onSave({...data, id: 'art_' + Date.now(), image: `${DEFAULT_IMG}?${Date.now()}`})} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase tracking-widest text-[10px]">
            Sincronizar con la Red
          </button>
        </div>
      </div>
    </div>
  `;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
