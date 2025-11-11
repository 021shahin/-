import React from 'react';
import { SpeakerIcon, StopIcon } from './Icons';
import { Spinner } from './Spinner';

interface Props {
  position: { top: number; left: number };
  onClick: () => void;
  isLoading: boolean;
  isPlaying: boolean;
}

export const FloatingActionButton: React.FC<Props> = ({ position, onClick, isLoading, isPlaying }) => {
  return (
    <div
      className="fixed z-50 transform -translate-x-1/2 transition-all duration-150 ease-in-out"
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={onClick}
        disabled={isLoading}
        className={`
          flex items-center justify-center w-12 h-12 rounded-full text-white shadow-lg
          ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'}
          focus:outline-none focus:ring-4 ${isPlaying ? 'focus:ring-red-500/50' : 'focus:ring-cyan-500/50'}
          disabled:bg-gray-600 disabled:cursor-not-allowed
          transform hover:scale-110 active:scale-100
        `}
        aria-label={isPlaying ? 'توقف خواندن' : 'خواندن متن انتخاب شده'}
      >
        {isLoading ? <Spinner /> : isPlaying ? <StopIcon /> : <SpeakerIcon />}
      </button>
    </div>
  );
};