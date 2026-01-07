
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(React.createElement);

// --- CONFIGURACIÓN Y CONSTANTES ---
const CATEGORIES = ['Tecnología', 'Negocios', 'Estilo de Vida', 'Ciencia', 'Artes', 'Educación'];
const STORAGE_KEY = 'articly_master_db';
const DEFAULT_IMAGE = 'https://picsum.photos/seed/article/800/600';

// --- SERVICIO DE BASE DE DATOS (LocalStorage) ---
const db = {
  getArticles: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  save: (articles) => localStorage.setItem(STORAGE_KEY, JSON.stringify(articles)),
  add: (article) => {
    const articles = db.getArticles();
    articles.unshift(article);
    db.save(articles);
  },
  delete: (id) => {
    const articles = db.getArticles().filter(a => a.id !== id);
    db.save(articles);
  }
};

// --- SERVICIOS DE IA (Gemini) ---
const generateContent = async (title, category) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Escribe un resumen profesional de unas 200 palabras para un artículo titulado "${title}" en la categoría "${category}". El tono debe ser premium y atractivo.`
  });
  return response.text || "Error al generar contenido.";
};

const analyzeMarket = async (title, content, price) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analiza este artículo:\nTítulo: ${title}\nPrecio: $${price}\nContenido: ${content.substring(0, 400)}...`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedPrice: { type: Type.STRING },
          marketFit: { type: Type.STRING },
          quality: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["suggestedPrice", "marketFit", "quality", "tags"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

// --- COMPONENTES DE INTERFAZ ---

const Button = ({ children, variant = 'primary', isLoading, className = '', ...props }) => {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300",
    outline: "border border-slate-300 text-slate-600 hover:bg-white",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };
  return html`
    <button 
      className=${`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${styles[variant]} ${className}`}
      disabled=${isLoading || props.disabled}
      ...${props}
    >
      ${isLoading && html`<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`}
      ${children}
    </button>
  `;
};

const ArticleCard = ({ article, onDelete, onView }) => html`
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full">
    <div className="relative aspect-[4/3] overflow-hidden">
      <img src=${article.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-sm font-black text-indigo-600 shadow-lg">
        $${article.price.toFixed(2)}
      </div>
      <div className="absolute bottom-3 left-3 bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
        ${article.category}
      </div>
    </div>
    <div className="p-5 flex-1 flex flex-col">
      <h3 className="font-bold text-slate-800 mb-3 line-clamp-2 text-lg leading-tight group-hover:text-indigo-600 transition-colors">${article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1 leading-relaxed">${article.content}</p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Autor</span>
          <span className="text-xs text-slate-700 font-medium">${article.author}</span>
        </div>
        <div className="flex gap-1">
          <button onClick=${() => onView(article)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button onClick=${() => onDelete(article.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
`;

const ArticleForm = ({ onSave, onCancel }) => {
  const [form, setForm] = useState({ title: '', category: CATEGORIES[0], price: 19.99, content: '', author: '' });
  const [loading, setLoading] = useState({ gen: false, anal: false });
  const [analysis, setAnalysis] = useState(null);

  const handleAIAction = async (type) => {
    if (type === 'gen') {
      if (!form.title) return alert("Escribe un título primero");
      setLoading(p => ({ ...p, gen: true }));
      try {
        const text = await generateContent(form.title, form.category);
        setForm(p => ({ ...p, content: text }));
      } finally { setLoading(p => ({ ...p, gen: false })); }
    } else {
      if (!form.content) return alert("Escribe contenido primero");
      setLoading(p => ({ ...p, anal: true }));
      try {
        const res = await analyzeMarket(form.title, form.content, form.price);
        setAnalysis(res);
      } finally { setLoading(p => ({ ...p, anal: false })); }
    }
  };

  return html`
    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto no-scrollbar w-full max-w-2xl animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Publicar Artículo</h2>
        <button onClick=${onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Título del Artículo</label>
            <input placeholder="Ej: El futuro de la IA" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value=${form.title} onChange=${e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tu Nombre de Autor</label>
            <input placeholder="Nombre completo" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value=${form.author} onChange=${e => setForm({...form, author: e.target.value})} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Categoría</label>
            <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value=${form.category} onChange=${e => setForm({...form, category: e.target.value})}>
              ${CATEGORIES.map(c => html`<option key=${c} value=${c}>${c}</option>`)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Precio sugerido ($)</label>
            <input type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold" value=${form.price} onChange=${e => setForm({...form, price: parseFloat(e.target.value)})} />
          </div>
        </div>
        <div className="space-y-1 relative">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contenido</label>
          <textarea rows="6" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none" placeholder="Escribe tu obra maestra..." value=${form.content} onChange=${e => setForm({...form, content: e.target.value})} />
          <button onClick=${() => handleAIAction('gen')} disabled=${loading.gen} className="absolute bottom-4 right-4 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
             ${loading.gen ? 'Generando...' : html`✨ Generar con IA`}
          </button>
        </div>
        
        ${analysis && html`
          <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 animate-in slide-in-from-top-4">
            <h4 className="text-xs font-black text-indigo-900 uppercase mb-3 flex items-center gap-2">
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V7h2v2z"/></svg> Análisis de Mercado
            </h4>
            <div className="grid grid-cols-2 gap-4 text-[11px]">
              <div><span className="text-indigo-400 block font-bold uppercase">Precio IA:</span> <span className="text-indigo-900 font-bold">${analysis.suggestedPrice}</span></div>
              <div><span className="text-indigo-400 block font-bold uppercase">Fit:</span> <span className="text-indigo-900 font-bold">${analysis.marketFit}</span></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              ${analysis.tags.map(t => html`<span key=${t} className="bg-white text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 font-bold">#${t}</span>`)}
            </div>
          </div>
        `}

        <div className="flex gap-3 pt-4">
          <${Button} onClick=${() => handleAIAction('anal')} isLoading=${loading.anal} variant="outline" className="flex-1">Analizar Valor</${Button}>
          <${Button} onClick=${() => onSave({ ...form, id: Date.now().toString(), createdAt: Date.now(), imageUrl: `${DEFAULT_IMAGE}?${Date.now()}` })} className="flex-1">Publicar Ahora</${Button}>
        </div>
      </div>
    </div>
  `;
};

// --- COMPONENTE PRINCIPAL (APP) ---
const App = () => {
  const [articles, setArticles] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => { setArticles(db.getArticles()); }, []);

  const filtered = useMemo(() => {
    return articles.filter(a => (filter === 'All' || a.category === filter) && 
      (a.title.toLowerCase().includes(search.toLowerCase()) || a.author.toLowerCase().includes(search.toLowerCase()))
    );
  }, [articles, search, filter]);

  return html`
    <div className="min-h-screen pb-20 bg-slate-50/50">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/><path d="M8 15h6"/></svg>
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tighter">ARTICLY</span>
        </div>
        <div className="hidden md:flex flex-1 max-w-xl mx-12">
          <div className="relative w-full">
            <input className="w-full bg-slate-100 border-none rounded-2xl px-12 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Buscar por título o autor..." value=${search} onChange=${e => setSearch(e.target.value)} />
            <svg className="absolute left-4 top-3.5 text-slate-400" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>
        <${Button} onClick=${() => setIsAdding(true)}>Vender Artículo</${Button}>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8 items-center">
          <button onClick=${() => setFilter('All')} className=${`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${filter === 'All' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 border hover:border-indigo-200'}`}>Todos</button>
          ${CATEGORIES.map(c => html`
            <button key=${c} onClick=${() => setFilter(c)} className=${`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filter === c ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 border hover:border-indigo-200'}`}>
              ${c}
            </button>
          `)}
        </div>

        ${filtered.length > 0 ? html`
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            ${filtered.map(a => html`
              <${ArticleCard} key=${a.id} article=${a} onDelete=${(id) => { db.delete(id); setArticles(db.getArticles()); }} onView=${setSelected} />
            `)}
          </div>
        ` : html`
          <div className="py-32 text-center">
             <div className="mb-6 opacity-20"><svg className="mx-auto w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"></path></svg></div>
             <p className="text-2xl font-bold text-slate-300">No hay artículos disponibles</p>
             <p className="text-slate-400 mt-2">¡Sé el primero en publicar contenido de valor!</p>
          </div>
        `}
      </div>

      ${isAdding && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6" onClick=${() => setIsAdding(false)}>
          <div onClick=${e => e.stopPropagation()} className="w-full max-w-2xl"><${ArticleForm} onCancel=${() => setIsAdding(false)} onSave=${(a) => { db.add(a); setArticles(db.getArticles()); setIsAdding(false); }} /></div>
        </div>
      `}

      ${selected && html`
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-6 overflow-y-auto" onClick=${() => setSelected(null)}>
          <div className="w-full max-w-4xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500" onClick=${e => e.stopPropagation()}>
            <div className="aspect-[21/9] w-full relative">
              <img src=${selected.imageUrl} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <button onClick=${() => setSelected(null)} className="absolute top-6 right-6 bg-white/20 p-3 rounded-full hover:bg-white/40 text-white backdrop-blur transition-all">✕</button>
              <div className="absolute bottom-8 left-8">
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">${selected.category}</span>
                <h2 className="text-4xl font-black text-white mt-4 drop-shadow-md">${selected.title}</h2>
              </div>
            </div>
            <div className="p-12">
              <div className="flex items-center gap-4 mb-10 pb-10 border-b border-slate-100">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-xl">${selected.author.charAt(0)}</div>
                <div>
                  <p className="text-slate-900 font-black text-lg">${selected.author}</p>
                  <p className="text-slate-400 text-sm">Publicado el ${new Date(selected.createdAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}</p>
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed text-xl whitespace-pre-wrap font-serif">${selected.content}</p>
              <div className="mt-12 pt-10 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="text-center sm:text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1 tracking-tighter">Precio de Acceso Total</span>
                  <span className="text-4xl font-black text-slate-900">$${selected.price.toFixed(2)}</span>
                </div>
                <${Button} className="px-12 py-4 text-lg rounded-2xl w-full sm:w-auto shadow-2xl shadow-indigo-200">Comprar Artículo</${Button}>
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
