
import React from 'react';
import { Article } from '../types';

interface ArticleCardProps {
  article: Article;
  onDelete: (id: string) => void;
  onView: (article: Article) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onDelete, onView }) => {
  const date = new Date(article.createdAt).toLocaleDateString();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group flex flex-col h-full">
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={article.imageUrl} 
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur shadow-sm px-2.5 py-1 rounded-full text-xs font-bold text-indigo-600">
          ${article.price.toFixed(2)}
        </div>
        <div className="absolute bottom-3 left-3 bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
          {article.category}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-slate-800 line-clamp-2">{article.title}</h3>
        </div>
        
        <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">
          {article.content}
        </p>
        
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">By {article.author}</span>
            <span className="text-xs text-slate-400">{date}</span>
          </div>
          
          <div className="flex gap-2">
             <button 
              onClick={() => onView(article)}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              title="View Article"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button 
              onClick={() => onDelete(article.id)}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Delete Article"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
