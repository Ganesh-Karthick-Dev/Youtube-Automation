
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  fetchTrendingNews, 
  generateIdeation, 
  generateScriptPackage, 
  generateRefImages, 
  generateSceneImage,
  generateThumbnail,
  generateSpeech,
  generateSceneVideo
} from './services/geminiService';
import { 
  NewsItem, 
  IdeationItem, 
  ScriptPackage, 
  WorkflowState, 
  ScriptSegment,
  UploadedFile
} from './types';
import { MagicIcon, RefreshIcon, DownloadIcon, CopyIcon } from './components/Icons';
import ImageUploader from './components/ImageUploader';

// Use declare global to extend Window interface without causing duplicate declaration errors
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button 
      onClick={handleCopy}
      className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${copied ? 'text-green-400' : 'text-slate-400'}`}
    >
      {copied ? <span className="text-[10px] font-bold">COPIED</span> : <CopyIcon />}
    </button>
  );
}

function App() {
  const [state, setState] = useState<WorkflowState>({
    step: 'NEWS',
    ideationOptions: [],
    refImages: []
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [manualRef, setManualRef] = useState<UploadedFile | null>(null);

  useEffect(() => {
    if (state.step === 'NEWS') {
      loadNews();
    }
  }, [state.step]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const trending = await fetchTrendingNews();
      setNews(trending);
    } catch (e) {
      alert("Failed to fetch news.");
    } finally {
      setLoading(false);
    }
  };

  const selectNews = async (item: NewsItem) => {
    setLoading(true);
    setState(prev => ({ ...prev, selectedNews: item }));
    try {
      const ideas = await generateIdeation(item.title, item.snippet);
      setState(prev => ({ ...prev, step: 'IDEATION', ideationOptions: ideas }));
    } catch (e) {
      alert("Failed to generate ideas.");
    } finally {
      setLoading(false);
    }
  };

  const selectIdea = async (idea: IdeationItem) => {
    setLoading(true);
    setState(prev => ({ ...prev, selectedIdea: idea }));
    try {
      const pkg = await generateScriptPackage(idea.title, idea.description);
      setState(prev => ({ ...prev, step: 'SCRIPT', scriptPackage: pkg }));
    } catch (e) {
      alert("Failed to generate script.");
    } finally {
      setLoading(false);
    }
  };

  const generateReferenceImages = async () => {
    if (!state.scriptPackage) return;
    setLoading(true);
    try {
      const urls = await generateRefImages(state.scriptPackage.mainRefPrompt);
      setState(prev => ({ 
        ...prev, 
        step: 'REF_IMAGE', 
        refImages: urls.map((url, i) => ({ id: `ref-${i}`, url })) 
      }));
    } catch (e) {
      alert("Failed to generate style variations.");
    } finally {
      setLoading(false);
    }
  };

  const selectRefImage = async (url: string) => {
    setState(prev => ({ ...prev, step: 'PRODUCTION', selectedRefImageUrl: url }));
    generateProductionAssets(url);
  };

  const handleManualRefSelect = (file: UploadedFile) => {
    setManualRef(file);
    selectRefImage(file.base64);
  };

  const generateProductionAssets = async (refUrl: string) => {
    if (!state.scriptPackage) return;
    
    // 1. Generate Audio Narration
    setState(prev => prev.scriptPackage ? ({
      ...prev,
      scriptPackage: { ...prev.scriptPackage, isAudioGenerating: true }
    }) : prev);

    generateSpeech(state.scriptPackage.fullScriptPara).then(audioUrl => {
      setState(prev => prev.scriptPackage ? ({
        ...prev,
        scriptPackage: { ...prev.scriptPackage, audioUrl, isAudioGenerating: false }
      }) : prev);
    }).catch(err => {
      console.error("Audio failed", err);
      setState(prev => prev.scriptPackage ? ({
        ...prev,
        scriptPackage: { ...prev.scriptPackage, isAudioGenerating: false }
      }) : prev);
    });

    // 2. Generate Thumbnail
    try {
      const thumbUrl = await generateThumbnail(state.scriptPackage.thumbnailPrompt);
      setState(prev => prev.scriptPackage ? ({
        ...prev,
        scriptPackage: { ...prev.scriptPackage, thumbnailUrl: thumbUrl }
      }) : prev);
    } catch (e) { console.error("Thumbnail failed", e); }

    // 3. Generate All Scenes
    const segments = [...state.scriptPackage.segments];
    for (let i = 0; i < segments.length; i++) {
      updateSegment(segments[i].id, { isGenerating: true });
      try {
        const imageUrl = await generateSceneImage(refUrl, segments[i].imagePrompt);
        updateSegment(segments[i].id, { imageUrl, isGenerating: false });
      } catch (e) {
        updateSegment(segments[i].id, { isGenerating: false });
      }
    }
  };

  const animateScene = async (segment: ScriptSegment) => {
    if (!segment.imageUrl) return;
    const hasKey = await window.aistudio?.hasSelectedApiKey();
    if (!hasKey) {
      setState(prev => ({ ...prev, needsApiKey: true }));
      return;
    }

    updateSegment(segment.id, { isVideoGenerating: true });
    try {
      const videoUrl = await generateSceneVideo(segment.imageUrl, segment.imagePrompt);
      updateSegment(segment.id, { videoUrl, isVideoGenerating: false });
    } catch (e: any) {
      console.error("Animation failed", e);
      if (e.message?.includes("Requested entity was not found")) {
        setState(prev => ({ ...prev, needsApiKey: true }));
      } else {
        alert("Animation failed. Check API key billing.");
      }
      updateSegment(segment.id, { isVideoGenerating: false });
    }
  };

  const updateSegment = (id: string, updates: Partial<ScriptSegment>) => {
    setState(prev => {
      if (!prev.scriptPackage) return prev;
      return {
        ...prev,
        scriptPackage: {
          ...prev.scriptPackage,
          segments: prev.scriptPackage.segments.map(s => s.id === id ? { ...s, ...updates } : s)
        }
      };
    });
  };

  const regenerateScene = async (segment: ScriptSegment) => {
    if (!state.selectedRefImageUrl) return;
    updateSegment(segment.id, { isGenerating: true });
    try {
      const imageUrl = await generateSceneImage(state.selectedRefImageUrl, segment.imagePrompt);
      updateSegment(segment.id, { imageUrl, isGenerating: false, videoUrl: null });
    } catch (e) {
      updateSegment(segment.id, { isGenerating: false });
    }
  };

  const downloadProduction = async () => {
    if (!state.scriptPackage) return;
    setExporting(true);
    
    try {
      const zip = new JSZip();
      
      const fetchAsBlob = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        return await response.blob();
      };

      // 1. Add Audio
      if (state.scriptPackage.audioUrl) {
        const audioBlob = await fetchAsBlob(state.scriptPackage.audioUrl);
        zip.file("narration.wav", audioBlob);
      }

      // 2. Add Thumbnail
      if (state.scriptPackage.thumbnailUrl) {
        const thumbBlob = await fetchAsBlob(state.scriptPackage.thumbnailUrl);
        zip.file("thumbnail.png", thumbBlob);
      }

      // 3. Add Segments (Images or Videos)
      const segmentPromises = state.scriptPackage.segments.map(async (seg, i) => {
        const index = (i + 1).toString().padStart(2, '0');
        if (seg.videoUrl) {
          const videoBlob = await fetchAsBlob(seg.videoUrl);
          zip.file(`scenes/segment_${index}_motion.mp4`, videoBlob);
        } else if (seg.imageUrl) {
          const imageBlob = await fetchAsBlob(seg.imageUrl);
          zip.file(`scenes/segment_${index}_frame.png`, imageBlob);
        }
      });
      await Promise.all(segmentPromises);

      // 4. Add Metadata & Script text
      const meta = {
        title: state.scriptPackage.title,
        description: state.scriptPackage.description,
        tags: state.scriptPackage.tags,
        script: state.scriptPackage.fullScriptPara,
        cta: state.scriptPackage.cta,
        productionDate: new Date().toISOString()
      };
      zip.file("production_metadata.json", JSON.stringify(meta, null, 2));
      zip.file("full_script.txt", state.scriptPackage.fullScriptPara);

      // 5. Generate and download ZIP
      const zipContent = await zip.generateAsync({ type: "blob" });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipContent);
      downloadLink.download = `ShortsAI_Production_${state.scriptPackage.title.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
    } catch (err) {
      console.error("ZIP Generation error:", err);
      alert("Failed to bundle assets into a ZIP file. Try individual exports.");
    } finally {
      setExporting(false);
    }
  };

  const openApiKeyDialog = async () => {
    await window.aistudio?.openSelectKey();
    setState(prev => ({ ...prev, needsApiKey: false }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-white italic shadow-lg shadow-red-900/20">S</div>
            <h1 className="text-xl font-bold tracking-tight">ShortsAI <span className="text-slate-500 font-medium italic">Producer</span></h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] font-mono tracking-widest text-slate-500 bg-slate-800/50 border border-slate-700/50 px-3 py-1 rounded-full uppercase">
               Workflow: {state.step}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {state.needsApiKey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] max-w-md w-full text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-500">
                 <MagicIcon />
              </div>
              <h3 className="text-2xl font-black">Paid API Key Required</h3>
              <p className="text-slate-400 text-sm">Veo motion generation requires a paid Google Cloud project key with billing enabled.</p>
              <div className="space-y-4">
                <button onClick={openApiKeyDialog} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-transform">Select Paid Key</button>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-xs text-slate-500 underline">Learn about billing</a>
              </div>
            </div>
          </div>
        )}

        {state.step === 'NEWS' && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto text-center space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tight">What's Trending?</h2>
              <p className="text-slate-400 text-lg">Harness the latest tech breakthroughs for your next viral hit.</p>
            </div>
            {loading ? (
              <div className="flex flex-col items-center py-24 gap-6">
                <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="animate-pulse text-slate-400 font-medium tracking-wide">QUERYING TECH NEWS ARCHIVES...</p>
              </div>
            ) : (
              <div className="grid gap-4 max-w-3xl mx-auto">
                {news.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => selectNews(item)}
                    className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl hover:border-red-500/50 hover:bg-slate-800/40 transition-all text-left group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center"><MagicIcon /></div>
                    </div>
                    <h3 className="text-xl font-bold group-hover:text-red-400 transition-colors pr-10">{item.title}</h3>
                    <p className="text-sm text-slate-400 mt-2 line-clamp-2 leading-relaxed">{item.snippet}</p>
                    <div className="mt-4 text-[10px] text-slate-600 font-mono truncate">{item.url}</div>
                  </button>
                ))}
                <button onClick={loadNews} className="text-xs text-slate-500 hover:text-white underline mx-auto mt-6">Scan Again</button>
              </div>
            )}
          </section>
        )}

        {state.step === 'IDEATION' && (
          <section className="space-y-12 animate-in slide-in-from-right duration-500">
             <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  SOURCE: {state.selectedNews?.title}
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight">Viral Strategy</h2>
                <p className="text-slate-400 text-lg">Choose the narrative angle that will maximize audience retention.</p>
             </div>
             {loading ? (
               <div className="flex flex-col items-center py-20">
                  <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                  <p className="text-slate-500 italic font-mono uppercase tracking-widest text-xs">Simulating audience psychological responses...</p>
               </div>
             ) : (
               <div className="grid md:grid-cols-3 gap-8">
                 {state.ideationOptions.map(idea => (
                   <button 
                    key={idea.id}
                    onClick={() => selectIdea(idea)}
                    className="flex flex-col p-8 bg-slate-900 border border-slate-800 rounded-3xl hover:bg-slate-800 hover:border-blue-500/50 transition-all text-left h-full group"
                   >
                     <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform"><MagicIcon /></div>
                     <h3 className="font-bold text-xl mb-3 leading-tight group-hover:text-blue-400 transition-colors">{idea.title}</h3>
                     <p className="text-slate-400 leading-relaxed text-sm flex-grow">{idea.description}</p>
                   </button>
                 ))}
               </div>
             )}
          </section>
        )}

        {state.step === 'SCRIPT' && state.scriptPackage && (
          <section className="max-w-5xl mx-auto space-y-10 animate-in slide-in-from-right duration-500">
             <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="p-10 border-b border-slate-800 bg-slate-800/40 backdrop-blur-xl">
                  <h2 className="text-3xl font-black mb-6">Content Asset Package</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase text-[10px] font-black tracking-widest block">Video Title</span>
                      <p className="font-bold">{state.scriptPackage.title}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase text-[10px] font-black tracking-widest block">CTA Overlay</span>
                      <p className="font-bold text-red-500">{state.scriptPackage.cta}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase text-[10px] font-black tracking-widest block">Primary Visual Anchor</span>
                      <p className="text-xs text-slate-400 line-clamp-2 italic">"{state.scriptPackage.mainRefPrompt}"</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid lg:grid-cols-2">
                  <div className="p-10 space-y-6 border-r border-slate-800">
                     <h3 className="font-black uppercase text-xs text-slate-500 tracking-widest">Script Timeline</h3>
                     <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                        {state.scriptPackage.segments.map((seg, i) => (
                          <div key={seg.id} className="flex gap-4 p-5 bg-slate-950/40 rounded-2xl border border-slate-800/50 hover:bg-slate-950/60 transition-colors">
                            <span className="font-mono text-red-500 text-xs shrink-0 bg-red-500/10 px-2 py-1 rounded h-fit">00:{seg.timestamp}</span>
                            <div className="space-y-2">
                              <p className="text-sm italic text-slate-100 font-medium">"{seg.text}"</p>
                              <p className="text-[10px] text-slate-500 font-mono">Prompt: {seg.imagePrompt}</p>
                            </div>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="p-10 space-y-8 bg-slate-900/50">
                    <div>
                      <h3 className="font-black uppercase text-xs text-slate-500 tracking-widest mb-4">Tags & SEO</h3>
                      <div className="flex flex-wrap gap-2">
                        {state.scriptPackage.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-bold px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-300">#{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-3">
                         <h3 className="font-black uppercase text-[10px] text-slate-500 tracking-widest">Long-form Script</h3>
                         <CopyButton text={state.scriptPackage.fullScriptPara} />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-serif italic">{state.scriptPackage.fullScriptPara}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-800/20 flex justify-between items-center border-t border-slate-800">
                   <p className="text-xs text-slate-500 italic">Ready for visual orchestration.</p>
                   <button 
                    onClick={generateReferenceImages}
                    disabled={loading}
                    className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 transition-all disabled:opacity-50 shadow-xl shadow-red-900/20 active:scale-95"
                   >
                     {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <MagicIcon />}
                     Initiate Visual Engine
                   </button>
                </div>
             </div>
          </section>
        )}

        {state.step === 'REF_IMAGE' && (
          <section className="space-y-12 animate-in zoom-in duration-500">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <h2 className="text-4xl font-black tracking-tight">Reference Architecture</h2>
              <p className="text-slate-400 text-lg">Select a generated style or upload your own vision.</p>
            </div>
            
            <div className="max-w-xl mx-auto mb-16">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-4 text-center">Manual Upload</h3>
              <ImageUploader onImageSelected={handleManualRefSelect} selectedImage={manualRef} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {state.refImages.map(img => (
                <button 
                  key={img.id}
                  onClick={() => selectRefImage(img.url)}
                  className="group relative rounded-3xl overflow-hidden border-4 border-transparent hover:border-red-500 transition-all aspect-[9/16] bg-slate-900 shadow-2xl hover:scale-105"
                >
                  <img src={img.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-8">
                    <span className="bg-white text-black px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">Select Style</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {state.step === 'PRODUCTION' && state.scriptPackage && (
          <section className="space-y-12 animate-in fade-in duration-1000">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-800 pb-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tight leading-tight">Director's Studio</h2>
                <p className="text-slate-400">Review, animate, and finalize your production.</p>
              </div>
              <button 
                onClick={downloadProduction}
                disabled={exporting}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <DownloadIcon />
                )}
                {exporting ? "Bundling ZIP..." : "Export Assets (ZIP)"}
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[2rem] space-y-8 sticky top-24 backdrop-blur">
                   <h3 className="font-black text-xs uppercase tracking-widest text-red-500 flex items-center justify-between">Distribution Hub</h3>
                   
                   <div className="space-y-4">
                     <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Audio Narration</span>
                        {state.scriptPackage.isAudioGenerating ? (
                           <div className="flex items-center gap-3 py-2 animate-pulse">
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-[10px] font-mono text-slate-500">VOICING...</span>
                           </div>
                        ) : state.scriptPackage.audioUrl ? (
                           <audio controls className="w-full h-10 -mx-4 scale-90">
                              <source src={state.scriptPackage.audioUrl} type="audio/wav" />
                           </audio>
                        ) : null}
                     </div>

                     <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 relative group">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Title</span>
                        <p className="text-sm font-bold line-clamp-2">{state.scriptPackage.title}</p>
                        <div className="absolute top-2 right-2"><CopyButton text={state.scriptPackage.title} /></div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-slate-800">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">YT Thumbnail (16:9)</span>
                        <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                          {state.scriptPackage.thumbnailUrl ? (
                            <img src={state.scriptPackage.thumbnailUrl} className="w-full h-full object-cover" />
                          ) : <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>}
                        </div>
                     </div>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-8">
                <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800 pb-4">Cinematic Storyboard</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {state.scriptPackage.segments.map((seg, i) => (
                     <div key={seg.id} className="flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden group shadow-xl transition-all hover:border-slate-700">
                       <div className="relative aspect-[9/16] bg-slate-950 flex items-center justify-center">
                          {seg.isVideoGenerating ? (
                            <div className="flex flex-col items-center gap-4 text-center p-8">
                               <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-red-500/20"></div>
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">Veo Synthesizing Motion...</span>
                               <p className="text-[9px] text-slate-600 font-mono mt-2 leading-relaxed italic">Synthesizing 3s realistic motion based on prompt & script...</p>
                            </div>
                          ) : seg.videoUrl ? (
                             <video src={seg.videoUrl} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />
                          ) : seg.isGenerating ? (
                            <div className="w-10 h-10 border-4 border-slate-800 border-t-red-500 rounded-full animate-spin"></div>
                          ) : seg.imageUrl ? (
                            <>
                              <img src={seg.imageUrl} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                                <button 
                                  onClick={() => animateScene(seg)}
                                  className="px-6 py-3 bg-red-600 text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-red-500 active:scale-95 transition-all"
                                >
                                  <MagicIcon /> Animate with Veo
                                </button>
                                <button 
                                  onClick={() => regenerateScene(seg)}
                                  className="text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                                >
                                  <RefreshIcon /> Reset Scene
                                </button>
                              </div>
                            </>
                          ) : <MagicIcon />}
                          
                          <div className="absolute bottom-6 left-6 right-6 p-5 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/5 shadow-2xl">
                            <div className="flex justify-between items-center mb-2">
                               <span className="text-[10px] text-red-500 font-black tracking-widest uppercase">Part {i+1} • 00:{seg.timestamp}</span>
                               <div className={`w-1.5 h-1.5 rounded-full ${seg.videoUrl ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                            </div>
                            <p className="text-xs text-white leading-relaxed font-bold italic">"{seg.text}"</p>
                          </div>
                       </div>
                       <div className="p-6 bg-slate-900/80 border-t border-slate-800">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Visual Logic</span>
                            <CopyButton text={seg.imagePrompt} />
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-2 italic font-mono leading-tight">"{seg.imagePrompt}"</p>
                       </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-full shadow-2xl z-50">
        {['NEWS', 'IDEATION', 'SCRIPT', 'REF_IMAGE', 'PRODUCTION'].map((step, idx) => (
          <React.Fragment key={step}>
            <div 
              className={`w-3 h-3 rounded-full transition-all duration-700 ${
                state.step === step ? 'bg-red-500 scale-125 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 
                ['NEWS', 'IDEATION', 'SCRIPT', 'REF_IMAGE', 'PRODUCTION'].indexOf(state.step) > idx ? 'bg-slate-500' : 'bg-slate-800'
              }`}
            />
            {idx < 4 && <div className="w-4 h-[1px] bg-slate-800" />}
          </React.Fragment>
        ))}
        <span className="ml-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{state.step}</span>
      </div>
    </div>
  );
}

export default App;
