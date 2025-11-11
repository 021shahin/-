
import { useState, useRef, useCallback } from 'react';
import { generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';

export const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isStoppingRef = useRef(false);
  const playbackRateRef = useRef(1.0);
  
  const playNextInQueue = useCallback((onEnd?: () => void) => {
    if (isStoppingRef.current) {
      audioQueueRef.current = [];
      sourceNodeRef.current = null;
      setIsPlaying(false);
      if (onEnd) onEnd();
      return;
    }

    if (audioQueueRef.current.length > 0) {
      const audioContext = audioContextRef.current!;
      const buffer = audioQueueRef.current.shift()!; // Get the next buffer
      
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.playbackRate.value = playbackRateRef.current;
      sourceNode.connect(audioContext.destination);
      sourceNodeRef.current = sourceNode;

      sourceNode.onended = () => {
          sourceNodeRef.current = null;
          playNextInQueue(onEnd); // Play the next chunk
      };
      
      sourceNode.start();
    } else {
        // Queue is empty, playback finished
        setIsPlaying(false);
        sourceNodeRef.current = null;
        if (onEnd) {
          onEnd();
        }
    }
  }, []);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      // The onended event will fire, which will call playNextInQueue, 
      // which will then see the isStoppingRef flag and clean up.
    } else {
      // If nothing is playing, but we want to stop (e.g. clear a queue before it starts)
      audioQueueRef.current = [];
      setIsPlaying(false);
    }
  }, []);

  const speak = useCallback(async (text: string, options?: { onEnd?: () => void; playbackRate?: number }) => {
    stop(); // Stop any currently playing audio and clear queue
    isStoppingRef.current = false; // Reset for the new playback
    setIsLoading(true);
    setError(null);
    playbackRateRef.current = options?.playbackRate ?? 1.0;

    try {
      if (!text.trim()) {
         if (options?.onEnd) options.onEnd();
         return;
      }

      const base64AudioChunks = await generateSpeech(text);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const audioBuffers = await Promise.all(
        base64AudioChunks.map(async (chunk) => {
          const audioData = decode(chunk);
          return await decodeAudioData(audioData, audioContext, 24000, 1);
        })
      );
      
      audioQueueRef.current = audioBuffers;

      if (audioQueueRef.current.length > 0) {
        setIsPlaying(true);
        playNextInQueue(options?.onEnd);
      } else {
        if (options?.onEnd) options.onEnd();
      }

    } catch (e) {
      console.error("Text-to-speech failed:", e);
      const errorMessage = e instanceof Error ? e.message : 'یک خطای ناشناخته رخ داد.';
      setError(errorMessage);
      setIsPlaying(false);
      audioQueueRef.current = [];
      if (options?.onEnd) {
        options.onEnd();
      }
    } finally {
      setIsLoading(false);
    }
  }, [stop, playNextInQueue]);

  return { speak, stop, isLoading, isPlaying, error };
};
