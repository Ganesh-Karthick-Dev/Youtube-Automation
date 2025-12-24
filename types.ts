
export interface NewsItem {
  id: string;
  title: string;
  snippet: string;
  url: string;
}

export interface IdeationItem {
  id: string;
  title: string;
  description: string;
}

export interface ScriptSegment {
  id: string;
  timestamp: string;
  text: string;
  imagePrompt: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  isGenerating?: boolean;
  isVideoGenerating?: boolean;
}

export interface ScriptPackage {
  title: string;
  description: string;
  tags: string[];
  cta: string;
  thumbnailPrompt: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  isAudioGenerating?: boolean;
  mainRefPrompt: string;
  fullScriptPara: string;
  segments: ScriptSegment[];
}

export interface WorkflowState {
  step: 'NEWS' | 'IDEATION' | 'SCRIPT' | 'REF_IMAGE' | 'PRODUCTION';
  selectedNews?: NewsItem;
  ideationOptions: IdeationItem[];
  selectedIdea?: IdeationItem;
  scriptPackage?: ScriptPackage;
  refImages: { id: string; url: string }[];
  selectedRefImageUrl?: string;
  needsApiKey?: boolean;
}

export interface UploadedFile {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

// Added GeneratedImage interface to fix import error in GeneratedGallery.tsx
export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl?: string;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
}
