
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONFIGURACIÓN DE BASE DE DATOS GLOBAL ---
// Usamos un identificador único para que tu base de datos no se mezcle con otras
const BUCKET_ID = 'S2mP8N5Z6H7J9K1L3M4N'; 
const DB_NAME = 'articly_github_prod_v7';
const CLOUD_URL = `https://kvdb.io/${BUCKET_ID}/${DB_NAME}`;

const CATEGORIES = ['Tecnología', 'Negocios', 'Marketing', 'Ciencia', 'Arte', 'Diseño'];
const DEFAULT_IMG = 'https://picsum.photos/seed/article/800/600';

// --- MOTOR DE DATOS (SYNC ENGINE) ---
const cloudDb = {
  // Obtener datos de la nube
  fetch: async () => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000); // Timeout de 5 seg
      
      const response = await fetch(CLOUD_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(id);

      if (response.status === 404) return [];
      if (!response.ok) throw new Error("Server down");
      
      const data = await response.json();
      const validData = Array.isArray(data) ? data : [];
      
      // Guardar copia de seguridad local
      localStorage.setItem('articly_backup', JSON.stringify(validData));
      return validData;
    } catch (e) {
      console.warn("Usando base de datos local (Offline):", e.message);
      return JSON.parse(localStorage.getItem('articly_backup') || '[]');
    }
  },

  // Guardar datos en la nube (Sobrescribir con PUT)
  save: async (articles) => {
    try {
      // Primero guardamos local para no perder nada si el PC se apaga
      localStorage.setItem('articly_backup', JSON.stringify(articles));
      
      const response = await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articles)
      });
      
      return response.ok;
    } catch (e) {
      console.error("Error al sincronizar con la nube:", e);
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
        contents: `Escribe un resumen premium de 150 palabras para un artículo titulado "${title}" de la categoría "${cat}". Usa un tono profesional.`
      });
      return response.text;
    } catch (e) {
      return "El sistema de IA está procesando tu solicitud...";
    }
  }
};

// --- COMPONENTES ---

const CloudStatus = ({ status }) => {
  const configs = {
    sync: { color: 'bg-emerald-500', text: 'Sincronizado', pulse: '' },
    loading: { color: 'bg-amber-400', text: 'Conectando...', pulse: 'animate-pulse' },
    error: { color: 'bg-red-500', text: 'Modo Local (Offline)', pulse: '' }
  };
  const config = configs[status] || configs.loading;

  return html`
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200 transition-all duration-500">
      <div className=${`w-2 h-2 rounded-full ${config.color} ${config.pulse}`}></div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">${config.text}</span>
    </div>
  `;
};

const ArticleCard = ({ article, onRemove, onSelect }) => html`
  <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-indigo-200 transition-all group flex flex-col h-full cursor-pointer animate-in fade-in zoom-in duration-500" onClick=${() => onSelect(article)}>
    <div className="relative aspect-[4/3] overflow-hidden">
      <img src=${article.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
      <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-2xl text-sm font-black text-indigo-600 shadow-xl border border-white/20">
        $${article.price.toFixed(2)}
      </div>
      <div className="absolute bottom-5 left-5 bg-indigo-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">
        ${article.category}
      </div>
    </div>
    <div className="p-7 flex-1 flex flex-col">
      <h3 className="text-xl font-bold text-slate-800 mb-3 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">${article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-3 mb-8 flex-1 leading-relaxed">${article.content}</p>
      <div className="flex items-center justify-between pt-5 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center font-black text-white text-[11px] shadow-sm">${article.author.charAt(0).toUpperCase()}</div>
          <span className="text-xs font-bold text-slate-400">Por ${article.author}</span>
        </div>
        <button onClick=${(e) => { e.stopPropagation(); onRemove(article.id); }} className="text-slate-200 hover:text-red-500 p-2 transition-colors hover:bg-red-50 rounded-2xl">
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
  const [syncStatus, setSyncStatus] = useState('loading'); // 'sync', 'loading', 'error'
  const [filter, setFilter] = useState({ search: '', cat: 'Todos' });
  
  const isUpdating = useRef(false);

  const syncData = async (force = false) => {
    if (isUpdating.current && !force) return;
    
    if (force) setSyncStatus('loading');
    const data = await cloudDb.fetch();
    
    if (data) {
      setArticles(data);
      setSyncStatus('sync');
    } else {
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    syncData(true);
    const interval = setInterval(() => syncData(false), 20000); // Refresco cada 20 seg
    return () => clearInterval(interval);
  }, []);

  const handlePublish = async (newArticle) => {
    isUpdating.current = true;
    setSyncStatus('loading');
    
    const updated = [newArticle, ...articles];
    setArticles(updated);
    setIsAdding(false);

    const success = await cloudDb.save(updated);
    setSyncStatus(success ? 'sync' : 'error');
    
    // Mantener bloqueo de refresco por 5 segundos para evitar parpadeos
    setTimeout(() => { isUpdating.current = false; }, 5000);
  };

  const handleRemove = async (id) => {
    if (!confirm("¿Deseas eliminar este artículo permanentemente?")) return;
    isUpdating.current = true;
    setSyncStatus('loading');
    
    const updated = articles.filter(a => a.id !== id);
    setArticles(updated);
    
    const success = await cloudDb.save(updated);
    setSyncStatus(success ? 'sync' : 'error');
    
    setTimeout(() => { isUpdating.current = false; }, 3000);
  };

  const filtered = useMemo(() => {
    return articles.filter(a => 
      (filter.cat === 'Todos' || a.category === filter.cat) &&
      (a.title.toLowerCase().includes(filter.search.toLowerCase()) || a.author.toLowerCase().includes(filter.search.toLowerCase()))
    );
  }, [articles, filter]);

  return html`
    <div className="min-h-screen bg-slate-50/30">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-slate-200 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-11 h-11 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 rotate-3">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 block leading-none tracking-tighter">ARTICLY</span>
            <${CloudStatus} status=${syncStatus} />
          </div>
        </div>
        
        <div className="hidden lg:flex flex-1 max-w-lg mx-12">
          <div className="relative w-full">
            <input className="w-full bg-slate-100/80 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl px-12 py-3 text-sm outline-none transition-all font-medium" placeholder="Buscar en el marketplace global..." value=${filter.search} onChange=${e => setFilter({...filter, search: e.target.value})} />
            <svg className="absolute left-4 top-3.5 text-slate-400" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        <button onClick=${() => setIsAdding(true)} className="bg-slate-900 text-white px-7 py-3.5 rounded-2xl font-black shadow-2xl shadow-slate-200 hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-2 text-sm uppercase tracking-widest">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
          Publicar
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-10 scroll-smooth">
          <button onClick=${() => setFilter({...filter, cat: 'Todos'})} className=${`px-7 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${filter.cat === 'Todos' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200'}`}>Todos</button>
          ${CATEGORIES.map(c => html`
            <button key=${c} onClick=${() => setFilter({...filter, cat: c})} className=${`px-7 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${filter.cat === c ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200'}`}>${c}</button>
          `)}
        </div>

        ${filtered.length > 0 ? html`
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            ${filtered.map(a => html`<${ArticleCard} key=${a.id} article=${a} onRemove=${handleRemove} onSelect=${setSelected} />`)}
          </div>
        ` : html`
          <div className="py-40 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
               <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-400 italic">No hay artículos que coincidan</h3>
            <p className="text-slate-300 text-sm mt-2">Prueba con otra categoría o publica el primero.</p>
          </div>
        `}
      </main>

      ${isAdding && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500" onClick=${() => setIsAdding(false)}>
          <div onClick=${e => e.stopPropagation()} className="w-full max-w-xl">
            <${ArticleForm} onCancel=${() => setIsAdding(false)} onSave=${handlePublish} isSyncing=${syncStatus === 'loading'} />
          </div>
        </div>
      `}

      ${selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-12 overflow-y-auto animate-in fade-in duration-500" onClick=${() => setSelected(null)}>
          <div className="w-full max-w-4xl bg-white rounded-[3.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500" onClick=${e => e.stopPropagation()}>
            <div className="relative h-80 sm:h-[28rem]">
              <img src=${selected.image} className="w-full h-full object-cover" />
              <button onClick=${() => setSelected(null)} className="absolute top-8 right-8 bg-white/10 hover:bg-white/30 text-white w-14 h-14 rounded-full backdrop-blur-md transition-all flex items-center justify-center font-bold text-2xl border border-white/20 shadow-2xl">✕</button>
            </div>
            <div className="p-10 sm:p-20">
              <span className="inline-block bg-indigo-50 text-indigo-600 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-6">${selected.category}</span>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-8 leading-[1.1] tracking-tight">${selected.title}</h1>
              <div className="flex items-center gap-4 mb-12 pb-10 border-b border-slate-100">
                <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-indigo-100">${selected.author.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-slate-900 font-black text-lg">${selected.author}</p>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Colaborador Verificado</p>
                </div>
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 text-xl leading-relaxed whitespace-pre-wrap font-serif italic">${selected.content}</p>
              </div>
              <div className="mt-16 flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-10 rounded-[2.5rem] gap-8 shadow-2xl">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Precio de Licencia</p>
                  <p className="text-5xl font-black text-white">$${selected.price.toFixed(2)}</p>
                </div>
                <button className="w-full sm:w-auto bg-indigo-600 text-white px-12 py-5 rounded-[1.5rem] font-black shadow-xl hover:bg-indigo-500 active:scale-95 transition-all text-sm uppercase tracking-widest">Adquirir Lectura Completa</button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

const ArticleForm = ({ onSave, onCancel, isSyncing }) => {
  const [data, setData] = useState({ title: '', author: '', category: CATEGORIES[0], price: 25.00, content: '' });
  const [loadingAI, setLoadingAI] = useState(false);

  const handleGen = async () => {
    if (!data.title) return alert("Ingresa un título cautivador primero");
    setLoadingAI(true);
    const text = await aiService.generate(data.title, data.category);
    setData({...data, content: text});
    setLoadingAI(false);
  };

  return html`
    <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-white/20">
      <h2 className="text-3xl font-black mb-10 tracking-tighter text-slate-900">Nueva Publicación Global</h2>
      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Datos del Autor</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Título impactante" value=${data.title} onChange=${e => setData({...data, title: e.target.value})} />
            <input className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Tu nombre artístico" value=${data.author} onChange=${e => setData({...data, author: e.target.value})} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Categoría</label>
            <select className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700" value=${data.category} onChange=${e => setData({...data, category: e.target.value})}>
              ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Precio (USD)</label>
            <input type="number" step="0.01" className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-black text-indigo-600 text-xl" value=${data.price} onChange=${e => setData({...data, price: parseFloat(e.target.value)})} />
          </div>
        </div>

        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Contenido del Artículo</label>
          <textarea rows="6" className="w-full p-6 bg-slate-50 border-none rounded-[2rem] outline-none resize-none leading-relaxed font-medium text-slate-600 focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Escribe tu historia o deja que la IA te ayude..." value=${data.content} onChange=${e => setData({...data, content: e.target.value})} />
          <button onClick=${handleGen} disabled=${loadingAI} className="absolute bottom-6 right-6 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black hover:bg-indigo-600 shadow-xl disabled:opacity-50 transition-all flex items-center gap-2">
            ${loadingAI ? 'ESCRIBIENDO...' : html`✨ <span className="tracking-widest">USAR IA</span>`}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 pt-6">
          <button onClick=${onCancel} className="flex-1 font-black text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs tracking-widest">Descartar</button>
          <button onClick=${() => onSave({...data, id: 'art_' + Date.now(), image: `${DEFAULT_IMG}?${Date.now()}`})} disabled=${isSyncing} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-2xl shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all uppercase tracking-[0.2em] text-xs">
            ${isSyncing ? 'Sincronizando...' : 'Publicar Globalmente'}
          </button>
        </div>
      </div>
    </div>
  `;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
