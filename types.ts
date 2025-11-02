
export interface Language {
  code: string;
  name: string;
  englishName: string;
}

export interface Translation {
  languageCode: string;
  languageName: string;
  text: string;
}

export interface AudioInfo {
  url: string;
  blob: Blob;
}
