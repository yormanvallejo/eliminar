
import React, { useState } from 'react';
import { Button } from './Button';
import { CATEGORIES, DEFAULT_IMAGE } from '../constants';
import { generateArticleContent, analyzeArticleMarket } from '../services/gemini';
import { Article, Category, AIAnalysis } from '../types';

interface ArticleFormProps {
  onSave: (article: Article) => void;
  onCancel: () => void;
}

export const ArticleForm: React.FC<ArticleFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    category: CATEGORIES[0] as Category,
    price: 19.99,
    content: '',
    author: ''
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  const handleGenerate = async () => {
    if (!formData.title) return alert("Please enter a title first.");
    setIsGenerating(true);
    try {
      const content = await generateArticleContent(formData.title, formData.category);
      setFormData(prev => ({ ...prev, content }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!formData.content) return alert("Please add content to analyze.");
    setIsAnalyzing(true);
    try {
      const res = await analyzeArticleMarket(formData.title, formData.content, formData.price);
      setAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newArticle: Article = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      imageUrl: `${DEFAULT_IMAGE}?v=${Math.random()}`,
      createdAt: Date.now(),
      isPublished: true
    };
    onSave(newArticle);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Publish New Article</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input 
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. The Future of AI"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Author Name</label>
            <input 
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="Your Name"
              value={formData.author}
              onChange={e => setFormData(prev => ({ ...prev, author: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            {/* Fix: cast e.target.value to Category to ensure type compatibility with the state */}
            <select 
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as Category }))}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
            <input 
              required
              type="number"
              step="0.01"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={formData.price}
              onChange={e => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-700">Article Content</label>
            <button 
              type="button" 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
            >
              {isGenerating ? 'Generating...' : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                  AI Generate
                </>
              )}
            </button>
          </div>
          <textarea 
            required
            rows={6}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
            placeholder="Write your article content here..."
            value={formData.content}
            onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
          ></textarea>
        </div>

        {analysis && (
          <div className="bg-slate-50 border border-indigo-100 rounded-xl p-4 animate-in fade-in duration-300">
            <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              AI Insights
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-2 rounded border border-slate-100">
                <span className="text-slate-500 block">Suggested Price:</span>
                <span className="font-semibold">{analysis.suggestedPriceRange}</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-100">
                <span className="text-slate-500 block">Market Fit:</span>
                <span className="font-semibold">{analysis.marketFit}</span>
              </div>
            </div>
            <div className="mt-3">
               <span className="text-slate-500 text-[10px] block mb-1">Suggested Tags:</span>
               <div className="flex flex-wrap gap-1">
                 {analysis.seoTags.map(tag => (
                   <span key={tag} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-medium">#{tag}</span>
                 ))}
               </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={handleAnalyze} isLoading={isAnalyzing} className="flex-1">
            Analyze Market
          </Button>
          <Button type="submit" className="flex-1">
            Publish Now
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};
