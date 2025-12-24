
import { GoogleGenAI, Type } from "@google/genai";
import { NewsItem, IdeationItem, ScriptPackage, ScriptSegment } from "../types";

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Fetches trending tech news using Google Search grounding.
 */
export const fetchTrendingNews = async (): Promise<NewsItem[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Find the top 5 most trending and interesting tech news stories from the last 24 hours. Focus on things that would make good viral videos.",
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            snippet: { type: Type.STRING },
            url: { type: Type.STRING }
          },
          required: ["title", "snippet", "url"]
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, idx: number) => ({ ...item, id: `news-${idx}` }));
  } catch (e) {
    console.error("Failed to parse news", e);
    return [];
  }
};

/**
 * Generates viral ideation options for a news story.
 */
export const generateIdeation = async (newsTitle: string, newsSnippet: string): Promise<IdeationItem[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Based on this news: "${newsTitle}" - ${newsSnippet}, generate 3 distinct and highly viral YouTube Shorts content ideas. Make them punchy and attention-grabbing.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "description"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]").map((item: any, idx: number) => ({ ...item, id: `idea-${idx}` }));
};

/**
 * Generates a full 30s script package with segments, tags, and paragraph script.
 */
export const generateScriptPackage = async (ideaTitle: string, ideaDescription: string): Promise<ScriptPackage> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Create a complete 30-second YouTube Shorts script for the idea: "${ideaTitle}".
    Break it down into exactly 10 segments of 3 seconds each.
    Provide a viral title, description, and a list of 15 viral tags.
    Create a "fullScriptPara" which is the entire script as a single continuous paragraph.
    Provide a "mainRefPrompt" for visual consistency.
    Provide a "thumbnailPrompt" for a high-impact YouTube thumbnail (16:9).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          cta: { type: Type.STRING },
          thumbnailPrompt: { type: Type.STRING },
          fullScriptPara: { type: Type.STRING },
          mainRefPrompt: { type: Type.STRING },
          segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING },
                text: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["timestamp", "text", "imagePrompt"]
            }
          }
        },
        required: ["title", "description", "tags", "cta", "thumbnailPrompt", "fullScriptPara", "mainRefPrompt", "segments"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return {
    ...data,
    segments: data.segments.map((s: any, idx: number) => ({ ...s, id: `seg-${idx}` }))
  };
};

/**
 * Generates multiple reference images.
 */
export const generateRefImages = async (prompt: string): Promise<string[]> => {
  const ai = getAI();
  const results: string[] = [];
  
  for (let i = 0; i < 4; i++) {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `Generate a high-quality cinematic reference image for a YouTube Short: ${prompt}. Variation ${i}. Style: Cinematic, 4K, professional photography.`,
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        results.push(`data:image/png;base64,${part.inlineData.data}`);
        break;
      }
    }
  }
  return results;
};

/**
 * Generates a high-quality thumbnail image.
 */
export const generateThumbnail = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: `High impact YouTube thumbnail: ${prompt}. Style: Vibrant, high-contrast, attention-grabbing, 4K resolution. Including bold text elements if appropriate.`,
    config: { imageConfig: { aspectRatio: "16:9" } }
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Thumbnail generation failed");
};

/**
 * Generates an image based on a reference image and a scene prompt.
 */
export const generateSceneImage = async (
  refBase64: string,
  prompt: string
): Promise<string> => {
  const ai = getAI();
  const cleanBase64 = refBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: cleanBase64, mimeType: 'image/png' } },
        { text: `Based on the reference image provided, generate a new image for this scene: ${prompt}. Maintain character/style consistency.` }
      ],
    },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image in response");
};
