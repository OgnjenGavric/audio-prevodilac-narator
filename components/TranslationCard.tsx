
import React, { useState, useCallback } from 'react';
import { Translation, AudioInfo } from '../types';
import { generateSpeech } from '../services/geminiService';
import { decodeBase64, pcmToWavBlob, convertUint8ArrayToInt16Array } from '../utils/audioUtils';
import Loader from './Loader';

interface TranslationCardProps {
    translation: Translation;
}

// Audio context should be created on user interaction
let audioContext: AudioContext | null = null;

const TranslationCard: React.FC<TranslationCardProps> = ({ translation }) => {
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
    const [error, setError] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);

    const handleGenerateAudio = useCallback(async () => {
        setIsGeneratingAudio(true);
        setError('');
        setAudioInfo(null);
        try {
            if (!audioContext) {
                 audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }

            const base64Audio = await generateSpeech(translation.text);
            const pcmDataUint8 = decodeBase64(base64Audio);
            const pcmDataInt16 = convertUint8ArrayToInt16Array(pcmDataUint8);
            
            const blob = pcmToWavBlob(pcmDataInt16, 24000, 1);
            const url = URL.createObjectURL(blob);
            setAudioInfo({ url, blob });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepoznata greška pri generisanju zvuka.');
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [translation.text]);

    const handlePlayAudio = useCallback(async () => {
        if (!audioInfo || !audioContext) return;

        setIsPlaying(true);
        const arrayBuffer = await audioInfo.blob.arrayBuffer();
        
        // Skip WAV header (44 bytes) to get raw PCM data for AudioContext
        const pcmData = arrayBuffer.slice(44);

        const audioBuffer = audioContext.createBuffer(1, pcmData.byteLength / 2, 24000);
        const channelData = audioBuffer.getChannelData(0);
        const pcmInt16 = new Int16Array(pcmData);

        for (let i = 0; i < pcmInt16.length; i++) {
            channelData[i] = pcmInt16[i] / 32768.0;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start();

    }, [audioInfo]);
    
    const handleDownload = () => {
        if (!audioInfo) return;
        const link = document.createElement('a');
        link.href = audioInfo.url;
        link.download = `prevod_${translation.languageCode}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 flex flex-col h-full">
            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-3">{translation.languageName}</h3>
            <div className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md flex-grow mb-4 overflow-y-auto max-h-48">
                <p className="whitespace-pre-wrap">{translation.text}</p>
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400 mb-2">{error}</p>}
            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                {audioInfo ? (
                    <div className="flex items-center space-x-2">
                         <button onClick={handlePlayAudio} disabled={isPlaying} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center transition-colors disabled:bg-green-300">
                            {isPlaying ? (
                                <span className="w-5 h-5 block border-2 border-white rounded-full border-t-transparent animate-spin"></span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            )}
                            Pusti
                        </button>
                        <button onClick={handleDownload} className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio}
                        className="w-full flex justify-center items-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-blue-300"
                    >
                        {isGeneratingAudio ? (
                           <Loader size="5" className="text-white" />
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M18 3a1 1 0 00-1.447-.894L4.447 8.106A1 1 0 004 9v2a1 1 0 00.553.894l12 6A1 1 0 0018 17V3z" />
                                </svg>
                                Generiši glasovnu naraciju
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TranslationCard;
