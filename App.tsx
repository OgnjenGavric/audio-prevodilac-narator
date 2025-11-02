import React, { useState, useCallback, useRef } from 'react';
import { transcribeAudio, translateText } from './services/geminiService';
import { fileToBase64 } from './utils/audioUtils';
import { Translation, Language } from './types';
import { LANGUAGES } from './constants';
import Loader from './components/Loader';
import TranslationCard from './components/TranslationCard';

const App: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isLoadingTranscription, setIsLoadingTranscription] = useState(false);
  const [transcription, setTranscription] = useState<string>('');

  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    null
  );
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [error, setError] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const resetState = (clearFile = true) => {
    if (clearFile) setAudioFile(null);
    setTranscription('');
    setTranslations([]);
    setSelectedLanguage(null);
    setError('');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetState(false);
      setAudioFile(file);
    }
  };

  const cleanupRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  const handleStartRecording = async () => {
    if (isRecording) return;

    resetState();
    setIsRecording(true);
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const recordedFile = new File([audioBlob], 'snimak.wav', {
          type: mimeType,
        });
        setAudioFile(recordedFile);
        cleanupRecording();
      };

      mediaRecorderRef.current.start();
    } catch (err) {
      setError(
        'Nije moguće pristupiti mikrofonu. Proverite dozvole u pretraživaču.'
      );
      console.error('Error accessing microphone:', err);
      setIsRecording(false);
      cleanupRecording();
    }
  };

  const handleStopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleBatchTranscription = useCallback(async () => {
    if (!audioFile) return;

    setIsLoadingTranscription(true);
    setTranscription('');
    setTranslations([]);
    setSelectedLanguage(null);
    setError('');

    try {
      const audioBase64 = await fileToBase64(audioFile);
      const result = await transcribeAudio(audioBase64, audioFile.type);
      setTranscription(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Došlo je do nepoznate greške.'
      );
    } finally {
      setIsLoadingTranscription(false);
    }
  }, [audioFile]);

  const handleTranslate = useCallback(async () => {
    if (!transcription || !selectedLanguage) return;
    setIsLoadingTranslation(true);
    setError('');
    setTranslations([]);
    try {
      const result = await translateText(transcription, [selectedLanguage]);
      setTranslations(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Došlo je do nepoznate greške.'
      );
    } finally {
      setIsLoadingTranslation(false);
    }
  }, [transcription, selectedLanguage]);

  const handleLanguageSelect = (lang: Language) => {
    setSelectedLanguage(lang);
    setIsDropdownOpen(false);
  };

  return (
    <div className='min-h-screen bg-[#0F172A] font-sans p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='text-center mb-10'>
          <h1 className='text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 pb-2'>
            AI Audio prevodilac & narator
          </h1>
          <p className='mt-2 text-lg text-gray-400'>
            Snimite ili otpremite audio, dobijte transkripcije, prevode i
            AI-generisane glasovne naracije.
          </p>
        </header>

        <main className='space-y-8'>
          <div className='bg-[#1E293B] shadow-2xl shadow-indigo-500/10 rounded-xl p-6 sm:p-8 w-full max-w-2xl mx-auto'>
            <h2 className='text-xl font-semibold mb-6 text-gray-200'>
              1. Obezbedite Audio
            </h2>
            <div className='flex flex-col sm:flex-row items-center gap-4'>
              <button
                onClick={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                className={`w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-md transition-all duration-300 ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white shadow-lg shadow-indigo-500/30`}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-5 w-5'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-12 0H3a7.001 7.001 0 006 6.93V17H7a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z'
                    clipRule='evenodd'
                  />
                </svg>
                {isRecording ? 'Zaustavi Snimanje' : 'Započni Snimanje'}
              </button>

              <span className='text-gray-400 font-medium'>ILI</span>

              <label
                htmlFor='file-upload'
                className={`w-full sm:w-auto flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-md bg-[#334155] ${
                  isRecording
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#475569]'
                } text-gray-200 transition-colors duration-300`}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-5 w-5'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
                Otpremi Fajl
              </label>
              <input
                id='file-upload'
                type='file'
                className='hidden'
                onChange={handleFileChange}
                accept='audio/*'
                disabled={isRecording}
              />
            </div>
            {audioFile && !isRecording && (
              <p className='mt-4 text-center text-gray-400'>
                Izabran fajl:{' '}
                <span className='font-medium text-indigo-400'>
                  {audioFile.name}
                </span>
              </p>
            )}
            {isRecording && (
              <p className='mt-4 text-center text-red-400 animate-pulse'>
                Snimanje u toku...
              </p>
            )}

            <div className='mt-6'>
              <button
                onClick={handleBatchTranscription}
                disabled={!audioFile || isLoadingTranscription || isRecording}
                className='w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-green-800 disabled:text-gray-400 disabled:cursor-not-allowed shadow-lg shadow-green-500/30'
              >
                {isLoadingTranscription ? (
                  <Loader size='6' className='text-white' />
                ) : (
                  'Prevedi Audio'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              className='bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative max-w-2xl mx-auto'
              role='alert'
            >
              <strong className='font-bold'>Greška: </strong>
              <span className='block sm:inline'>{error}</span>
            </div>
          )}

          {transcription && (
            <div className='bg-[#1E293B] shadow-2xl shadow-indigo-500/10 rounded-xl p-6 sm:p-8 w-full max-w-2xl mx-auto space-y-6'>
              <div>
                <h2 className='text-2xl font-semibold mb-3 text-gray-200'>
                  Originalni Transkript (Srpski)
                </h2>
                <p className='text-gray-300 bg-gray-900/50 p-4 rounded-md whitespace-pre-wrap min-h-[100px]'>
                  {transcription}
                </p>
              </div>

              <div>
                <h2 className='text-2xl font-semibold mb-3 text-gray-200'>
                  3. Izaberite Jezik za Prevod
                </h2>
                <div className='relative'>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className='w-full bg-[#334155] text-gray-200 font-semibold py-3 px-4 rounded-lg inline-flex items-center justify-between transition-colors hover:bg-[#475569]'
                  >
                    <span>
                      {selectedLanguage
                        ? selectedLanguage.name
                        : 'Izaberite jezik'}
                    </span>
                    <svg
                      className={`fill-current h-4 w-4 transform transition-transform ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 20 20'
                    >
                      <path d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z' />
                    </svg>
                  </button>
                  {isDropdownOpen && (
                    <div className='absolute z-10 w-full mt-1 bg-[#334155] border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto'>
                      {LANGUAGES.map((lang) => (
                        <div
                          key={lang.code}
                          className={`p-3 cursor-pointer ${
                            selectedLanguage?.code === lang.code
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-200 hover:bg-indigo-600/30'
                          }`}
                          onClick={() => handleLanguageSelect(lang)}
                        >
                          <span className='ml-3'>{lang.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleTranslate}
                  disabled={isLoadingTranslation || !selectedLanguage}
                  className='mt-4 w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed'
                >
                  {isLoadingTranslation ? (
                    <Loader size='6' className='text-white' />
                  ) : (
                    'Prevedi'
                  )}
                </button>
              </div>
            </div>
          )}

          {translations.length > 0 && (
            <div className='w-full max-w-7xl mx-auto'>
              <h2 className='text-3xl font-bold mb-6 text-center text-white'>
                4. Prevod i Glasovna Naracija
              </h2>
              <div className='flex justify-center'>
                {translations.map((t) => (
                  <div key={t.languageCode} className='w-full max-w-2xl'>
                    <TranslationCard translation={t} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
