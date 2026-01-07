
import { Article } from '../types';
import { STORAGE_KEY } from '../constants';

export const db = {
  getArticles: (): Article[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveArticles: (articles: Article[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
  },

  addArticle: (article: Article) => {
    const articles = db.getArticles();
    articles.unshift(article);
    db.saveArticles(articles);
  },

  updateArticle: (id: string, updates: Partial<Article>) => {
    const articles = db.getArticles();
    const index = articles.findIndex(a => a.id === id);
    if (index !== -1) {
      articles[index] = { ...articles[index], ...updates };
      db.saveArticles(articles);
    }
  },

  deleteArticle: (id: string) => {
    const articles = db.getArticles().filter(a => a.id !== id);
    db.saveArticles(articles);
  }
};
