
export interface Article {
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

export type Category = 'Technology' | 'Business' | 'Lifestyle' | 'Science' | 'Arts' | 'Education';

export interface AIAnalysis {
  suggestedPriceRange: string;
  marketFit: string;
  contentQuality: string;
  seoTags: string[];
}
