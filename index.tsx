
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
interface Article {
  id: string;
  title: string;
  content: string;
  price: number;
  category: string;
  imageUrl: string;
  author: string;
  createdAt: number;
  isPublished: boolean;
}

type Category = 'Technology' | 'Business' | 'Lifestyle' | 'Science' | 'Arts' | 'Education';

interface AIAnalysis {
  suggestedPriceRange: string;
  marketFit: string;
  contentQuality: string;
  seoTags: string[];
}

// --- CONSTANTS ---
const CATEGORIES: Category[] = ['Technology', 'Business', 'Lifestyle', 'Science', 'Arts', 'Education'];
const STORAGE_KEY = 'articly_db_v1';
const DEFAULT_IMAGE = 'https://picsum.photos/seed/article/800/600';

// --- DATABASE SERVICE ---
const db = {
  getArticles: (): Article[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to load articles", e);
      return [];
    }
  },
  saveArticles: (articles: Article[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
  },
  addArticle: (article: Article) => {
    const articles = db.getArticles();
    articles.unshift(article);
    db.saveArticles(articles);
  },
  deleteArticle: (id: string) => {
    const articles = db.getArticles().filter(a => a.id !== id);
    db.saveArticles(articles);
  }
};

// --- GEMINI SERVICE ---
// Always create a new instance before making an API call and use process.env.API_KEY directly.
const generateArticleContent = async (title: string, category: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a professional article summary (approx 250 words) for: "${title}" in category "${category}".`
  });
  // Use the .text property to access content.
  return response.text || "Failed to generate content.";
};

const analyzeArticleMarket = async (title: string, content: string, price: number): Promise<AIAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this marketplace article:\nTitle: ${title}\nPrice: $${price}\nContent: ${content.substring(0, 500)}...`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedPriceRange: { type: Type.STRING },
          marketFit: { type: Type.STRING },
          contentQuality: { type: Type.STRING },
          seoTags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["suggestedPriceRange", "marketFit", "contentQuality", "seoTags"]
      }
    }
  });
  // Use the .text property to access content.
  return JSON.parse(response.text || '{}');
};

// --- COMPONENTS ---

const Button = ({ children, variant = 'primary', isLoading, className = '', ...props }: any) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300",
    outline: "border border-slate-300 text-slate-600 hover:bg-slate-50",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };
  return (
    <button 
      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center disabled:opacity-50 ${variants[variant as keyof typeof variants]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

// Fix for line 248: Use React.FC to properly handle React internal props like 'key' in TypeScript
const ArticleCard: React.FC<{ article: Article, onDelete: any, onView: any }> = ({ article, onDelete, onView }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
    <div className="relative aspect-video">
      <img src={article.imageUrl} alt="" className="w-full h-full object-cover" />
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">
        ${article.price.toFixed(2)}
      </div>
    </div>
    <div className="p-4 flex-1 flex flex-col">
      <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 mb-1">{article.category}</span>
      <h3 className="font-bold text-slate-800 mb-2 line-clamp-2">{article.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">{article.content}</p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
        <span className="text-xs text-slate-400">By {article.author}</span>
        <div className="flex gap-1">
          <button onClick={() => onView(article)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button onClick={() => onDelete(article.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ArticleForm = ({ onSave, onCancel }: { onSave: any, onCancel: any }) => {
  const [formData, setFormData] = useState({ title: '', category: CATEGORIES[0], price: 19.99, content: '', author: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  const handleGenerate = async () => {
    if (!formData.title) return alert("Enter a title first.");
    setIsGenerating(true);
    try {
      const content = await generateArticleContent(formData.title, formData.category);
      setFormData(prev => ({ ...prev, content }));
    } finally { setIsGenerating(false); }
  };

  const handleAnalyze = async () => {
    if (!formData.content) return alert("Add content first.");
    setIsAnalyzing(true);
    try {
      const res = await analyzeArticleMarket(formData.title, formData.content, formData.price);
      setAnalysis(res);
    } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6">Publish Article</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="Title" className="col-span-2 md:col-span-1 p-2 border rounded" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          <input placeholder="Author" className="col-span-2 md:col-span-1 p-2 border rounded" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Fix: cast e.target.value to Category to satisfy type check */}
          <select className="p-2 border rounded" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" step="0.01" className="p-2 border rounded" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} />
        </div>
        <div className="relative">
          <textarea rows={6} className="w-full p-2 border rounded" placeholder="Content..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
          <button onClick={handleGenerate} disabled={isGenerating} className="absolute bottom-4 right-4 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100">
            {isGenerating ? "..." : "AI Generate"}
          </button>
        </div>
        {analysis && (
          <div className="p-4 bg-indigo-50 rounded-xl text-xs space-y-2">
            <p><strong>Value Insight:</strong> {analysis.suggestedPriceRange}</p>
            <p><strong>Market Fit:</strong> {analysis.marketFit}</p>
            <div className="flex gap-1 flex-wrap">
              {analysis.seoTags.map(t => <span key={t} className="bg-white px-2 py-0.5 rounded shadow-sm border border-indigo-100">#{t}</span>)}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleAnalyze} isLoading={isAnalyzing} variant="outline" className="flex-1">Analyze</Button>
          <Button onClick={() => onSave({ ...formData, id: Date.now().toString(), createdAt: Date.now(), imageUrl: `${DEFAULT_IMAGE}?${Date.now()}` })} className="flex-1">Publish</Button>
          <Button onClick={onCancel} variant="secondary">Cancel</Button>
        </div>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---
const App = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  useEffect(() => { setArticles(db.getArticles()); }, []);

  const filtered = useMemo(() => {
    return articles.filter(a => (catFilter === 'All' || a.category === catFilter) && 
      (a.title.toLowerCase().includes(search.toLowerCase()) || a.author.toLowerCase().includes(search.toLowerCase()))
    );
  }, [articles, search, catFilter]);

  return (
    <div className="min-h-screen pb-20">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-xl text-indigo-600">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg"></div> ARTICLY
        </div>
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <input className="w-full bg-slate-100 border-none rounded-full px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setIsAdding(true)}>Post Article</Button>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-6">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${catFilter === c ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600 hover:border-indigo-400'}`}>
              {c}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map(a => (
              <ArticleCard key={a.id} article={a} onDelete={(id: string) => { db.deleteArticle(id); setArticles(db.getArticles()); }} onView={setSelectedArticle} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400">No articles found. Be the first to publish!</div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <ArticleForm onCancel={() => setIsAdding(false)} onSave={(a: Article) => { db.addArticle(a); setArticles(db.getArticles()); setIsAdding(false); }} />
          </div>
        </div>
      )}

      {selectedArticle && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedArticle(null)}>
          <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="aspect-[21/9] w-full relative">
              <img src={selectedArticle.imageUrl} className="w-full h-full object-cover" />
              <button onClick={() => setSelectedArticle(null)} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/40 text-white">✕</button>
            </div>
            <div className="p-8">
              <span className="text-indigo-600 font-bold text-xs uppercase">{selectedArticle.category}</span>
              <h2 className="text-3xl font-black mt-2 mb-4">{selectedArticle.title}</h2>
              <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
                <span className="font-bold text-slate-900">{selectedArticle.author}</span> • {new Date(selectedArticle.createdAt).toLocaleDateString()}
              </div>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedArticle.content}</p>
              <div className="mt-8 pt-8 border-t flex justify-between items-center">
                <span className="text-2xl font-black">${selectedArticle.price.toFixed(2)}</span>
                <Button className="px-8">Purchase Full Access</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- RENDER ---
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
