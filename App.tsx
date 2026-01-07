
import React, { useState, useEffect, useMemo } from 'react';
import { db } from './services/db';
import { Article } from './types';
import { CATEGORIES } from './constants';
import { ArticleCard } from './components/ArticleCard';
import { ArticleForm } from './components/ArticleForm';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  useEffect(() => {
    setArticles(db.getArticles());
  }, []);

  const handleSaveArticle = (article: Article) => {
    db.addArticle(article);
    setArticles(db.getArticles());
    setIsAdding(false);
  };

  const handleDeleteArticle = (id: string) => {
    if (confirm('Are you sure you want to delete this article?')) {
      db.deleteArticle(id);
      setArticles(db.getArticles());
    }
  };

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           a.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || a.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchTerm, filterCategory]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">ARTICLY</span>
            </div>
            
            <div className="hidden md:flex items-center gap-4 flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Search articles or authors..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-3 top-2.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
            </div>

            <div>
              <Button onClick={() => setIsAdding(true)}>
                <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Post Article
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Mobile Search */}
        <div className="md:hidden mb-6">
           <input 
              type="text" 
              placeholder="Search articles..."
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Categories Scroller */}
        <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide no-scrollbar">
          <button 
            onClick={() => setFilterCategory('All')}
            className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-medium transition-colors ${filterCategory === 'All' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
          >
            All Topics
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-medium transition-colors ${filterCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredArticles.map(article => (
              <ArticleCard 
                key={article.id} 
                article={article} 
                onDelete={handleDeleteArticle} 
                onView={setSelectedArticle}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-slate-100 p-6 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">No articles found</h3>
            <p className="text-slate-500 max-w-xs mx-auto">Try adjusting your search or category filters, or publish the first article yourself!</p>
            <Button className="mt-6" onClick={() => setIsAdding(true)}>Create Your First Post</Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">© 2024 Articly Content Marketplace. Powered by Gemini AI.</p>
        </div>
      </footer>

      {/* Modals */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-200 my-8">
            <ArticleForm 
              onSave={handleSaveArticle} 
              onCancel={() => setIsAdding(false)} 
            />
          </div>
        </div>
      )}

      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto" onClick={() => setSelectedArticle(null)}>
          <div 
            className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 my-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative h-64 sm:h-96">
              <img src={selectedArticle.imageUrl} className="w-full h-full object-cover" alt="" />
              <button 
                onClick={() => setSelectedArticle(null)}
                className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2">
                    {selectedArticle.category}
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
                    {selectedArticle.title}
                  </h2>
                </div>
                <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-indigo-100 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-tighter opacity-80">Full Access</span>
                  <span className="text-2xl font-black">${selectedArticle.price.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-100">
                <img src={`https://picsum.photos/seed/${selectedArticle.author}/100`} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="" />
                <div>
                  <p className="text-slate-900 font-bold leading-none">{selectedArticle.author}</p>
                  <p className="text-slate-400 text-sm">Published on {new Date(selectedArticle.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <p className="text-lg leading-relaxed text-slate-600 whitespace-pre-wrap">
                  {selectedArticle.content}
                </p>
              </div>

              <div className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h4 className="font-bold text-slate-900">Support the Author</h4>
                  <p className="text-slate-500 text-sm">Unlock the full research notes and high-res assets for this piece.</p>
                </div>
                <Button className="w-full sm:w-auto px-8 py-3">Purchase Access</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
