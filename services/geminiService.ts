
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, Translation } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    };
    const textPart = {
      text: "Transkribuj ovaj audio snimak na srpskom jeziku. Vrati samo transkribovani tekst.",
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, textPart] },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error during transcription:", error);
    throw new Error("Transkripcija nije uspela. Proverite konzolu za detalje.");
  }
};

export const translateText = async (text: string, targetLanguages: Language[]): Promise<Translation[]> => {
    try {
        const languageList = targetLanguages.map(lang => `${lang.englishName} (${lang.code})`).join(', ');
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Prevedi sledeći srpski tekst na navedene jezike: ${languageList}. Vrati rezultat kao JSON niz objekata. Svaki objekat treba da ima "languageCode" (npr. "en") i "translatedText" ključeve. Prevod treba da zadrži sličan ton, stil i broj znakova.\n\nTekst za prevod:\n"${text}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            languageCode: {
                                type: Type.STRING,
                                description: 'ISO 639-1 kod jezika (npr. "en", "de").',
                            },
                            translatedText: {
                                type: Type.STRING,
                                description: 'Prevedeni tekst.',
                            },
                        },
                        required: ["languageCode", "translatedText"],
                    },
                },
            },
        });

        const parsedResponse = JSON.parse(response.text);
        
        return parsedResponse.map((item: any) => {
            const lang = targetLanguages.find(l => l.code === item.languageCode);
            return {
                languageCode: item.languageCode,
                languageName: lang ? lang.name : item.languageCode,
                text: item.translatedText,
            };
        });

    } catch (error) {
        console.error("Error during translation:", error);
        throw new Error("Prevođenje nije uspelo. Proverite konzolu za detalje.");
    }
};


export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' }, // Female-sounding voice
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Nije primljen audio sadržaj od API-ja.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Generisanje glasa nije uspelo. Proverite konzolu za detalje.");
    }
};
