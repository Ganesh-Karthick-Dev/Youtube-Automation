
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NewsItem, IdeationItem, ScriptPackage, ScriptSegment } from "../types";

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to decode base64 to Uint8Array as per guidelines
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to wrap raw PCM in a WAV header
function pcmToWav(pcmData: Uint8Array, sampleRate: number): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmData.length, true);
  const wavBuffer = new Uint8Array(header.byteLength + pcmData.byteLength);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(pcmData, header.byteLength);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

export const fetchTrendingNews = async (): Promise<NewsItem[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Find the top 5 most trending tech news stories from the last 24 hours for viral video scripts.",
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
    return [];
  }
};

export const generateIdeation = async (newsTitle: string, newsSnippet: string): Promise<IdeationItem[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Based on: "${newsTitle}" - ${newsSnippet}, generate 3 viral YouTube Shorts ideas.`,
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

export const generateScriptPackage = async (ideaTitle: string, ideaDescription: string): Promise<ScriptPackage> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Create a 30s YouTube Shorts script for: "${ideaTitle}". 10 segments of 3s.`,
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
  return { ...data, segments: data.segments.map((s: any, idx: number) => ({ ...s, id: `seg-${idx}` })) };
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say with energy: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");
  const pcmBytes = decodeBase64(base64Audio);
  const wavBlob = pcmToWav(pcmBytes, 24000);
  return URL.createObjectURL(wavBlob);
};

export const generateRefImages = async (prompt: string): Promise<string[]> => {
  const ai = getAI();
  const results: string[] = [];
  for (let i = 0; i < 4; i++) {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `Cinematic reference image: ${prompt}. Variation ${i}. Style: 4K, realistic.`,
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData?.data) results.push(`data:image/png;base64,${part.inlineData.data}`);
  }
  return results;
};

export const generateThumbnail = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: `High impact YouTube thumbnail: ${prompt}.`,
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
  throw new Error("Thumbnail failed");
};

export const generateSceneImage = async (refBase64: string, prompt: string): Promise<string> => {
  const ai = getAI();
  const cleanBase64 = refBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: cleanBase64, mimeType: 'image/png' } },
        { text: `Based on the reference, generate this scene: ${prompt}. Maintain style.` }
      ],
    },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
  throw new Error("Scene image failed");
};

/**
 * Animates a scene using Veo model.
 */
export const generateSceneVideo = async (imageBase64: string, prompt: string): Promise<string> => {
  const ai = getAI(); // Fresh instance to pick up latest key
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Animate this scene with realistic motion: ${prompt}. Cinematic movement, high quality.`,
    image: {
      imageBytes: cleanBase64,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video URI not found");
  
  return `${downloadLink}&key=${process.env.API_KEY}`;
};
