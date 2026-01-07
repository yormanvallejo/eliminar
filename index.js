
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONSTANTES ---
const CATEGORIES = ['Tecnología', 'Negocios', 'Marketing', 'Ciencia', 'Arte', 'Diseño'];
const DB_NAME = 'articly_github_storage_v1';
const DEFAULT_IMG = 'https://picsum.photos/seed/article/800/600';

// --- SISTEMA DE DATOS ---
const storage = {
  get: () => JSON.parse(localStorage.getItem(DB_NAME) || '[]'),
  save: (data) => localStorage.setItem(DB_NAME, JSON.stringify(data)),
  export: () => {
    const data = localStorage.getItem(DB_NAME);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `articly_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
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
  },
  analyze: async (title, content, price) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza: Título: ${title}, Precio: $${price}, Contenido: ${content.substring(0, 300)}...`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.STRING },
            advice: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["score", "advice", "tags"]
        }
      }
    });
    return JSON.parse(response.text);
  }
};

// --- COMPONENTES ---

const Nav = ({ onAdd, onExport }) => html`
  <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 h-20 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
      </div>
      <span className="text-xl font-black tracking-tighter text-slate-900">ARTICLY</span>
    </div>
    <div className="flex gap-3">
      <button onClick=${onExport} className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        Exportar DB
      </button>
      <button onClick=${onAdd} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
        Nuevo Artículo
      </button>
    </div>
  </nav>
`;

const Card = ({ article, onRemove, onSelect }) => html`
  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-2xl transition-all group flex flex-col h-full cursor-pointer" onClick=${() => onSelect(article)}>
    <div className="relative aspect-video overflow-hidden">
      <img src=${article.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-sm font-black text-indigo-600 shadow-md">
        $${article.price.toFixed(2)}
      </div>
    </div>
    <div className="p-6 flex-1 flex flex-col">
      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">${article.category}</span>
      <h3 className="text-lg font-bold text-slate-800 mb-3 line-clamp-2">${article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1">${article.content}</p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-400">Por ${article.author}</span>
        <button onClick=${(e) => { e.stopPropagation(); onRemove(article.id); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  </div>
`;

const Form = ({ onSave, onCancel }) => {
  const [data, setData] = useState({ title: '', author: '', category: CATEGORIES[0], price: 19.99, content: '' });
  const [loading, setLoading] = useState(false);

  const handleGen = async () => {
    if (!data.title) return alert("Escribe un título");
    setLoading(true);
    try {
      const text = await aiService.generate(data.title, data.category);
      setData({...data, content: text});
    } finally { setLoading(false); }
  };

  return html`
    <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-300 overflow-y-auto no-scrollbar max-h-[90vh]">
      <h2 className="text-2xl font-black mb-6">Publicar Artículo</h2>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Título</label>
            <input className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" value=${data.title} onChange=${e => setData({...data, title: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Autor</label>
            <input className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" value=${data.author} onChange=${e => setData({...data, author: e.target.value})} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label>
            <select className="w-full p-3 bg-slate-50 border rounded-xl outline-none" value=${data.category} onChange=${e => setData({...data, category: e.target.value})}>
              ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Precio ($)</label>
            <input type="number" className="w-full p-3 bg-slate-50 border rounded-xl outline-none" value=${data.price} onChange=${e => setData({...data, price: parseFloat(e.target.value)})} />
          </div>
        </div>
        <div className="space-y-1 relative">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Contenido</label>
          <textarea rows="5" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" value=${data.content} onChange=${e => setData({...data, content: e.target.value})} />
          <button onClick=${handleGen} disabled=${loading} className="absolute bottom-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black hover:bg-indigo-700 disabled:opacity-50 transition-all">
            ${loading ? 'Generando...' : 'IA GENERAR'}
          </button>
        </div>
        <div className="flex gap-3 pt-4">
          <button onClick=${onCancel} className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
          <button onClick=${() => onSave({...data, id: Date.now(), image: `${DEFAULT_IMG}?${Date.now()}`})} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Publicar Artículo</button>
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

  useEffect(() => { setArticles(storage.get()); }, []);
  
  const handleSave = (art) => {
    const next = [art, ...articles];
    setArticles(next);
    storage.save(next);
    setView({ modal: false, selected: null });
  };

  const handleRemove = (id) => {
    const next = articles.filter(a => a.id !== id);
    setArticles(next);
    storage.save(next);
  };

  const filtered = useMemo(() => {
    return articles.filter(a => 
      (filter.cat === 'Todos' || a.category === filter.cat) &&
      (a.title.toLowerCase().includes(filter.search.toLowerCase()))
    );
  }, [articles, filter]);

  return html`
    <div className="min-h-screen">
      <${Nav} onAdd=${() => setView({modal: true, selected: null})} onExport=${storage.export} />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-6 mb-12 items-center justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
            <button onClick=${() => setFilter({...filter, cat: 'Todos'})} className=${`px-6 py-2 rounded-full text-xs font-black tracking-widest uppercase transition-all ${filter.cat === 'Todos' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border text-slate-400 hover:border-indigo-200'}`}>Todos</button>
            ${CATEGORIES.map(c => html`
              <button key=${c} onClick=${() => setFilter({...filter, cat: c})} className=${`px-6 py-2 rounded-full text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap ${filter.cat === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border text-slate-400 hover:border-indigo-200'}`}>${c}</button>
            `)}
          </div>
          <div className="relative w-full md:w-80">
            <input className="w-full bg-white border border-slate-200 rounded-2xl px-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Buscar artículo..." value=${filter.search} onChange=${e => setFilter({...filter, search: e.target.value})} />
            <svg className="absolute left-4 top-3.5 text-slate-300" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        ${filtered.length > 0 ? html`
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            ${filtered.map(a => html`<${Card} key=${a.id} article=${a} onRemove=${handleRemove} onSelect=${(art) => setView({modal: false, selected: art})} />`)}
          </div>
        ` : html`
          <div className="py-32 text-center opacity-30">
            <svg className="mx-auto mb-4 w-20 h-20" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <p className="text-xl font-black italic">No hay artículos que coincidan</p>
          </div>
        `}
      </main>

      ${view.modal && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6" onClick=${() => setView({...view, modal: false})}>
          <div onClick=${e => e.stopPropagation()} className="w-full flex justify-center"><${Form} onCancel=${() => setView({...view, modal: false})} onSave=${handleSave} /></div>
        </div>
      `}

      ${view.selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-10 overflow-y-auto" onClick=${() => setView({...view, selected: null})}>
          <div className="w-full max-w-4xl bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick=${e => e.stopPropagation()}>
            <div className="relative aspect-[21/9]">
              <img src=${view.selected.image} className="w-full h-full object-cover" />
              <button onClick=${() => setView({...view, selected: null})} className="absolute top-8 right-8 bg-white/20 p-3 rounded-full hover:bg-white/40 text-white backdrop-blur transition-all">✕</button>
            </div>
            <div className="p-8 sm:p-16">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">${view.selected.category}</span>
              <h1 className="text-4xl font-black text-slate-900 mt-4 mb-8 leading-tight">${view.selected.title}</h1>
              <div className="flex items-center gap-4 mb-12 pb-12 border-b">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-xl">${view.selected.author.charAt(0)}</div>
                <div>
                  <p className="text-slate-900 font-black">${view.selected.author}</p>
                  <p className="text-slate-400 text-sm">Escritor Senior</p>
                </div>
              </div>
              <p className="text-slate-600 text-xl leading-relaxed whitespace-pre-wrap italic font-serif">${view.selected.content}</p>
              <div className="mt-16 flex justify-between items-center bg-slate-50 p-8 rounded-[2rem]">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Acceso Exclusivo</p>
                  <p className="text-4xl font-black text-slate-900">$${view.selected.price.toFixed(2)}</p>
                </div>
                <button className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">COMPRAR AHORA</button>
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
