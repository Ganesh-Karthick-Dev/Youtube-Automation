
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
  isGenerating?: boolean;
}

export interface ScriptPackage {
  title: string;
  description: string;
  tags: string[];
  cta: string;
  thumbnailPrompt: string;
  thumbnailUrl?: string;
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
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string | null;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
}

export interface UploadedFile {
  base64: string;
  mimeType: string;
  previewUrl: string;
}
