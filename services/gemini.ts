
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysis } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateArticleContent = async (title: string, category: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a high-quality, professional article summary or introduction (about 250 words) for an article titled "${title}" in the category of "${category}". The content should be engaging and worth paying for.`
  });
  return response.text || "Failed to generate content.";
};

export const analyzeArticleMarket = async (title: string, content: string, price: number): Promise<AIAnalysis> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this proposed article for a marketplace:
    Title: ${title}
    Price: $${price}
    Content: ${content.substring(0, 500)}...
    
    Evaluate the market fit, content quality, suggested price range, and provide SEO tags.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedPriceRange: { type: Type.STRING },
          marketFit: { type: Type.STRING },
          contentQuality: { type: Type.STRING },
          seoTags: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["suggestedPriceRange", "marketFit", "contentQuality", "seoTags"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}') as AIAnalysis;
  } catch (e) {
    return {
      suggestedPriceRange: "N/A",
      marketFit: "Unknown",
      contentQuality: "Average",
      seoTags: []
    };
  }
};
