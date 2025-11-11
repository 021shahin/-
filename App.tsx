
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { SpeakerIcon, StopIcon, FileUploadIcon } from './components/Icons';
import { Spinner } from './components/Spinner';
import { FloatingActionButton } from './components/FloatingActionButton';

// pdf.js is loaded from a script tag in index.html
declare const pdfjsLib: any;

const App: React.FC = () => {
  const [text, setText] = useState<string>('سلام دنیا! این یک آزمایش برای تبدیل متن به گفتار است.');
  const { speak, stop, isLoading, isPlaying, error } = useTextToSpeech();
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  
  const appRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionInfo, setSelectionInfo] = useState<{ text: string; position: { top: number; left: number; } } | null>(null);
  const [currentlyPlayingSource, setCurrentlyPlayingSource] = useState<'textarea' | 'selection' | null>(null);
  const [isFileProcessing, setIsFileProcessing] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);


  const onPlaybackEnd = useCallback(() => {
    setCurrentlyPlayingSource(null);
  }, []);

  const handleSpeak = (textToSpeak: string, source: 'textarea' | 'selection') => {
    if (isPlaying && currentlyPlayingSource === source) {
      stop();
    } else {
      if (!textToSpeak.trim()) return;
      setCurrentlyPlayingSource(source);
      speak(textToSpeak, { onEnd: onPlaybackEnd, playbackRate });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsFileProcessing(true);
    setFileError(null);
    setText('');

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (file.type === 'text/plain' || fileExtension === 'txt') {
        const fileText = await file.text();
        setText(fileText);
      } else if (file.type === 'application/pdf' || fileExtension === 'pdf') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const numPages = pdf.numPages;
        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        setText(fullText);
      } else {
        throw new Error('فرمت فایل پشتیبانی نمی‌شود. لطفاً یک فایل PDF یا TXT انتخاب کنید.');
      }
    } catch (err: any) {
      let errorMessage = 'خطا در پردازش فایل.';
      if (err.name === 'PasswordException') {
          errorMessage = 'این فایل PDF با رمز عبور محافظت شده است و قابل خواندن نیست.';
      } else if (err.name === 'InvalidPDFException') {
          errorMessage = 'فایل PDF نامعتبر یا خراب است.';
      } else if (err.name === 'MissingPDFException') {
          errorMessage = 'فایل PDF یافت نشد یا در خواندن آن مشکلی پیش آمد.';
      } else if (err instanceof Error) {
          errorMessage = err.message;
      }
      setFileError(errorMessage);
      console.error(err);
    } finally {
      setIsFileProcessing(false);
      // Reset file input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selection && selectedText && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);

          if (appRef.current && appRef.current.contains(range.commonAncestorContainer)) {
            if (selectionInfo) setSelectionInfo(null);
            return;
          }

          const rect = range.getBoundingClientRect();
          if (rect.width < 5 && rect.height < 5) {
              if (selectionInfo) setSelectionInfo(null);
              return;
          }
          
          setSelectionInfo({
            text: selectedText,
            position: {
              top: rect.bottom + window.scrollY + 8,
              left: rect.left + window.scrollX + rect.width / 2,
            },
          });
        } else {
           if (selectionInfo) setSelectionInfo(null);
        }
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectionInfo]);

  const isTextareaLoading = isLoading && currentlyPlayingSource === 'textarea';
  const isTextareaPlaying = isPlaying && currentlyPlayingSource === 'textarea';

  return (
    <>
      <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white p-4">
        <div ref={appRef} className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 transform transition-all duration-300 hover:shadow-cyan-500/20">
          <header className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">
              تبدیل متن به گفتار
            </h1>
            <p className="text-gray-400 mt-2">
              متن فارسی خود را بنویسید، یا یک فایل (PDF, TXT) بارگذاری کنید.
            </p>
          </header>

          <main className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="متن خود را اینجا وارد کنید یا یک فایل بارگذاری نمایید..."
              className="w-full h-48 p-4 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-300 text-lg leading-relaxed resize-none"
              rows={6}
            />

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center">
                <p><strong>خطا:</strong> {error}</p>
              </div>
            )}
            {fileError && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center">
                <p><strong>خطا:</strong> {fileError}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="playback-speed" className="block text-sm font-medium text-gray-400 text-center">
                  سرعت پخش: {playbackRate.toFixed(2)}x
                </label>
                <input
                  id="playback-speed"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.25"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
                  disabled={isPlaying || isLoading}
                />
              </div>

              <div className="flex flex-col md:flex-row justify-center items-center gap-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.txt"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isFileProcessing || isPlaying || isLoading}
                  className="flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 ease-in-out w-full md:w-auto bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-500/50 disabled:bg-gray-700 disabled:cursor-wait disabled:text-gray-400 transform hover:scale-105 active:scale-100"
                >
                  {isFileProcessing ? <Spinner /> : <FileUploadIcon />}
                  <span>{isFileProcessing ? 'در حال پردازش...' : 'بارگذاری فایل'}</span>
                </button>
                <button
                  onClick={() => handleSpeak(text, 'textarea')}
                  disabled={isTextareaLoading || !text.trim() || isFileProcessing}
                  className={`
                    flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 ease-in-out
                    w-full md:w-auto
                    ${isTextareaPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'}
                    focus:outline-none focus:ring-4 ${isTextareaPlaying ? 'focus:ring-red-500/50' : 'focus:ring-cyan-500/50'}
                    disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400
                    transform hover:scale-105 active:scale-100
                  `}
                >
                  {isTextareaLoading ? (
                    <>
                      <Spinner />
                      <span>در حال پردازش...</span>
                    </>
                  ) : isTextareaPlaying ? (
                    <>
                      <StopIcon />
                      <span>توقف</span>
                    </>
                  ) : (
                    <>
                      <SpeakerIcon />
                      <span>پخش صدا</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </main>
          
          <footer className="text-center text-gray-500 text-sm pt-4 border-t border-gray-700">
              <p>قدرت گرفته از Gemini API</p>
          </footer>
        </div>
      </div>
      {selectionInfo && (
        <FloatingActionButton 
          position={selectionInfo.position}
          onClick={() => handleSpeak(selectionInfo.text, 'selection')}
          isLoading={isLoading && currentlyPlayingSource === 'selection'}
          isPlaying={isPlaying && currentlyPlayingSource === 'selection'}
        />
      )}
    </>
  );
};

export default App;
