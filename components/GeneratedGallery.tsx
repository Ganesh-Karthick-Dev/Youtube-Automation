import React from 'react';
import { GeneratedImage } from '../types';
import { DownloadIcon } from './Icons';

interface GeneratedGalleryProps {
  images: GeneratedImage[];
  isGenerating: boolean;
}

const GeneratedGallery: React.FC<GeneratedGalleryProps> = ({ images, isGenerating }) => {
  if (images.length === 0 && !isGenerating) return null;

  const downloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = async () => {
    for (const img of images) {
      if (img.status === 'success' && img.imageUrl) {
        downloadImage(img.imageUrl, img.id);
        // Small delay to prevent browser throttling downloads
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  const hasSuccess = images.some(img => img.status === 'success');

  return (
    <div className="w-full mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Generated Results</h2>
        {hasSuccess && !isGenerating && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <DownloadIcon /> Download All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((img) => (
          <div 
            key={img.id} 
            className="relative group bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col"
          >
            {/* Aspect Ratio Container 9:16 */}
            <div className="relative w-full pt-[177.77%] bg-slate-900">
                <div className="absolute inset-0 flex items-center justify-center">
                    {img.status === 'pending' && (
                        <div className="flex flex-col items-center p-6 text-center">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-400 text-xs animate-pulse">Generating...</p>
                        </div>
                    )}

                    {img.status === 'error' && (
                        <div className="p-6 text-center">
                            <p className="text-red-400 text-sm mb-2">Generation Failed</p>
                            <p className="text-xs text-slate-500">{img.errorMessage}</p>
                        </div>
                    )}

                    {img.status === 'success' && img.imageUrl && (
                        <img 
                            src={img.imageUrl} 
                            alt={img.prompt}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
                
                {/* Overlay on hover (only for success) */}
                {img.status === 'success' && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <button
                            onClick={() => img.imageUrl && downloadImage(img.imageUrl, img.id)}
                            className="bg-white text-slate-900 p-3 rounded-full hover:bg-blue-50 transition-transform transform hover:scale-110"
                            title="Download"
                         >
                             <DownloadIcon />
                         </button>
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t border-slate-700 bg-slate-800 flex-grow">
                <p className="text-sm text-slate-300 line-clamp-2" title={img.prompt}>
                    {img.prompt}
                </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratedGallery;
