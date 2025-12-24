import React, { useRef, useState } from 'react';
import { UploadedFile } from '../types';
import { UploadIcon, RefreshIcon } from './Icons';

interface ImageUploaderProps {
  onImageSelected: (file: UploadedFile) => void;
  selectedImage: UploadedFile | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, selectedImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onImageSelected({
          base64: event.target.result as string,
          mimeType: file.type,
          previewUrl: URL.createObjectURL(file),
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  if (selectedImage) {
    return (
      <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden border-2 border-slate-700 group">
        <img 
          src={selectedImage.previewUrl} 
          alt="Reference" 
          className="w-full h-full object-contain bg-black/40 backdrop-blur-sm"
        />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
           <button 
             onClick={triggerSelect}
             className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-full font-semibold hover:bg-slate-200 transition-colors"
           >
             <RefreshIcon /> Change Image
           </button>
        </div>
        <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-xs px-2 py-1 rounded backdrop-blur">
          Reference Image
        </div>
         <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div
      onClick={triggerSelect}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 
        ${isDragging ? 'border-blue-500 bg-slate-800' : 'border-slate-600 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-500'}`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <UploadIcon />
        <p className="mb-2 text-sm text-gray-400">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">SVG, PNG, JPG or WEBP</p>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ImageUploader;
