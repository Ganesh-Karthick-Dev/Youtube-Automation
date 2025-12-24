import React from 'react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="w-full">
      <label htmlFor="prompts" className="block mb-2 text-sm font-medium text-gray-300">
        Enter up to 12 prompts (one per line)
      </label>
      <div className="relative">
        <textarea
          id="prompts"
          rows={12}
          className="block p-4 w-full text-sm rounded-lg border bg-slate-800 border-slate-600 placeholder-gray-500 text-white focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
          placeholder="Make it cyberpunk&#10;Add a retro filter&#10;Remove the person in the background&#10;Turn the sky purple&#10;Make it a pencil sketch&#10;Convert to pixel art&#10;Make it anime style&#10;Add a sunset background&#10;Turn it into a painting&#10;Make it black and white&#10;Add neon lights&#10;Make it futuristic"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        ></textarea>
        <div className="absolute bottom-2 right-2 text-xs text-slate-500">
            {value.split('\n').filter(p => p.trim()).length} / 12
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Each line represents a separate image variation to generate.
      </p>
    </div>
  );
};

export default PromptInput;