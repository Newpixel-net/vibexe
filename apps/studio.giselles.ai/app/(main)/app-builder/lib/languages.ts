/**
 * Language Configuration — 100+ languages with RTL support
 *
 * Used by URL analyzer (language detection) and Sandpack preview (dir/lang attributes).
 * Each entry includes ISO 639-1 code, English name, native name, RTL flag, and script.
 */

export interface LanguageConfig {
  /** ISO 639-1 two-letter code (e.g. "en", "he", "ar") */
  code: string;
  /** English name */
  name: string;
  /** Native script name */
  nativeName: string;
  /** True for right-to-left languages */
  rtl: boolean;
  /** Primary script system */
  script: string;
}

/**
 * 100 supported languages — sorted alphabetically by English name.
 * RTL languages: Arabic, Hebrew, Persian, Urdu, Pashto, Sindhi, Kurdish (Sorani), Uighur, Yiddish, Dhivehi.
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", rtl: false, script: "Latin" },
  { code: "sq", name: "Albanian", nativeName: "Shqip", rtl: false, script: "Latin" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", rtl: false, script: "Ethiopic" },
  { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true, script: "Arabic" },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն", rtl: false, script: "Armenian" },
  { code: "az", name: "Azerbaijani", nativeName: "Azərbaycan", rtl: false, script: "Latin" },
  { code: "eu", name: "Basque", nativeName: "Euskara", rtl: false, script: "Latin" },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", rtl: false, script: "Cyrillic" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", rtl: false, script: "Bengali" },
  { code: "bs", name: "Bosnian", nativeName: "Bosanski", rtl: false, script: "Latin" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", rtl: false, script: "Cyrillic" },
  { code: "my", name: "Burmese", nativeName: "မြန်မာစာ", rtl: false, script: "Myanmar" },
  { code: "ca", name: "Catalan", nativeName: "Català", rtl: false, script: "Latin" },
  { code: "ceb", name: "Cebuano", nativeName: "Cebuano", rtl: false, script: "Latin" },
  { code: "zh", name: "Chinese", nativeName: "中文", rtl: false, script: "Han" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文", rtl: false, script: "Han" },
  { code: "co", name: "Corsican", nativeName: "Corsu", rtl: false, script: "Latin" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", rtl: false, script: "Latin" },
  { code: "cs", name: "Czech", nativeName: "Čeština", rtl: false, script: "Latin" },
  { code: "da", name: "Danish", nativeName: "Dansk", rtl: false, script: "Latin" },
  { code: "dv", name: "Dhivehi", nativeName: "ދިވެހި", rtl: true, script: "Thaana" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", rtl: false, script: "Latin" },
  { code: "en", name: "English", nativeName: "English", rtl: false, script: "Latin" },
  { code: "eo", name: "Esperanto", nativeName: "Esperanto", rtl: false, script: "Latin" },
  { code: "et", name: "Estonian", nativeName: "Eesti", rtl: false, script: "Latin" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", rtl: false, script: "Latin" },
  { code: "fr", name: "French", nativeName: "Français", rtl: false, script: "Latin" },
  { code: "fy", name: "Frisian", nativeName: "Frysk", rtl: false, script: "Latin" },
  { code: "gl", name: "Galician", nativeName: "Galego", rtl: false, script: "Latin" },
  { code: "ka", name: "Georgian", nativeName: "ქართული", rtl: false, script: "Georgian" },
  { code: "de", name: "German", nativeName: "Deutsch", rtl: false, script: "Latin" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", rtl: false, script: "Greek" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", rtl: false, script: "Gujarati" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl Ayisyen", rtl: false, script: "Latin" },
  { code: "ha", name: "Hausa", nativeName: "Hausa", rtl: false, script: "Latin" },
  { code: "haw", name: "Hawaiian", nativeName: "ʻŌlelo Hawaiʻi", rtl: false, script: "Latin" },
  { code: "he", name: "Hebrew", nativeName: "עברית", rtl: true, script: "Hebrew" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", rtl: false, script: "Devanagari" },
  { code: "hmn", name: "Hmong", nativeName: "Hmong", rtl: false, script: "Latin" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", rtl: false, script: "Latin" },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", rtl: false, script: "Latin" },
  { code: "ig", name: "Igbo", nativeName: "Igbo", rtl: false, script: "Latin" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", rtl: false, script: "Latin" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge", rtl: false, script: "Latin" },
  { code: "it", name: "Italian", nativeName: "Italiano", rtl: false, script: "Latin" },
  { code: "ja", name: "Japanese", nativeName: "日本語", rtl: false, script: "Kana/Kanji" },
  { code: "jv", name: "Javanese", nativeName: "Basa Jawa", rtl: false, script: "Latin" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", rtl: false, script: "Kannada" },
  { code: "kk", name: "Kazakh", nativeName: "Қазақша", rtl: false, script: "Cyrillic" },
  { code: "km", name: "Khmer", nativeName: "ភាសាខ្មែរ", rtl: false, script: "Khmer" },
  { code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda", rtl: false, script: "Latin" },
  { code: "ko", name: "Korean", nativeName: "한국어", rtl: false, script: "Hangul" },
  { code: "ku", name: "Kurdish", nativeName: "Kurdî", rtl: false, script: "Latin" },
  { code: "ckb", name: "Kurdish (Sorani)", nativeName: "کوردی", rtl: true, script: "Arabic" },
  { code: "ky", name: "Kyrgyz", nativeName: "Кыргызча", rtl: false, script: "Cyrillic" },
  { code: "lo", name: "Lao", nativeName: "ລາວ", rtl: false, script: "Lao" },
  { code: "la", name: "Latin", nativeName: "Latina", rtl: false, script: "Latin" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", rtl: false, script: "Latin" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", rtl: false, script: "Latin" },
  { code: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch", rtl: false, script: "Latin" },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", rtl: false, script: "Cyrillic" },
  { code: "mg", name: "Malagasy", nativeName: "Malagasy", rtl: false, script: "Latin" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", rtl: false, script: "Latin" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", rtl: false, script: "Malayalam" },
  { code: "mt", name: "Maltese", nativeName: "Malti", rtl: false, script: "Latin" },
  { code: "mi", name: "Maori", nativeName: "Te Reo Māori", rtl: false, script: "Latin" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", rtl: false, script: "Devanagari" },
  { code: "mn", name: "Mongolian", nativeName: "Монгол", rtl: false, script: "Cyrillic" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", rtl: false, script: "Devanagari" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", rtl: false, script: "Latin" },
  { code: "ny", name: "Nyanja", nativeName: "Chichewa", rtl: false, script: "Latin" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", rtl: false, script: "Odia" },
  { code: "ps", name: "Pashto", nativeName: "پښتو", rtl: true, script: "Arabic" },
  { code: "fa", name: "Persian", nativeName: "فارسی", rtl: true, script: "Arabic" },
  { code: "pl", name: "Polish", nativeName: "Polski", rtl: false, script: "Latin" },
  { code: "pt", name: "Portuguese", nativeName: "Português", rtl: false, script: "Latin" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português (Brasil)", rtl: false, script: "Latin" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", rtl: false, script: "Gurmukhi" },
  { code: "ro", name: "Romanian", nativeName: "Română", rtl: false, script: "Latin" },
  { code: "ru", name: "Russian", nativeName: "Русский", rtl: false, script: "Cyrillic" },
  { code: "sm", name: "Samoan", nativeName: "Gagana Samoa", rtl: false, script: "Latin" },
  { code: "gd", name: "Scottish Gaelic", nativeName: "Gàidhlig", rtl: false, script: "Latin" },
  { code: "sr", name: "Serbian", nativeName: "Српски", rtl: false, script: "Cyrillic" },
  { code: "st", name: "Sesotho", nativeName: "Sesotho", rtl: false, script: "Latin" },
  { code: "sn", name: "Shona", nativeName: "chiShona", rtl: false, script: "Latin" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي", rtl: true, script: "Arabic" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල", rtl: false, script: "Sinhala" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", rtl: false, script: "Latin" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", rtl: false, script: "Latin" },
  { code: "so", name: "Somali", nativeName: "Soomaali", rtl: false, script: "Latin" },
  { code: "es", name: "Spanish", nativeName: "Español", rtl: false, script: "Latin" },
  { code: "su", name: "Sundanese", nativeName: "Basa Sunda", rtl: false, script: "Latin" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", rtl: false, script: "Latin" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", rtl: false, script: "Latin" },
  { code: "tl", name: "Tagalog", nativeName: "Tagalog", rtl: false, script: "Latin" },
  { code: "tg", name: "Tajik", nativeName: "Тоҷикӣ", rtl: false, script: "Cyrillic" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", rtl: false, script: "Tamil" },
  { code: "tt", name: "Tatar", nativeName: "Татарча", rtl: false, script: "Cyrillic" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", rtl: false, script: "Telugu" },
  { code: "th", name: "Thai", nativeName: "ไทย", rtl: false, script: "Thai" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", rtl: false, script: "Latin" },
  { code: "tk", name: "Turkmen", nativeName: "Türkmen", rtl: false, script: "Latin" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", rtl: false, script: "Cyrillic" },
  { code: "ug", name: "Uighur", nativeName: "ئۇيغۇرچە", rtl: true, script: "Arabic" },
  { code: "ur", name: "Urdu", nativeName: "اردو", rtl: true, script: "Arabic" },
  { code: "uz", name: "Uzbek", nativeName: "Oʻzbekcha", rtl: false, script: "Latin" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", rtl: false, script: "Latin" },
  { code: "cy", name: "Welsh", nativeName: "Cymraeg", rtl: false, script: "Latin" },
  { code: "xh", name: "Xhosa", nativeName: "isiXhosa", rtl: false, script: "Latin" },
  { code: "yi", name: "Yiddish", nativeName: "ייִדיש", rtl: true, script: "Hebrew" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá", rtl: false, script: "Latin" },
  { code: "zu", name: "Zulu", nativeName: "isiZulu", rtl: false, script: "Latin" },
];

/** All RTL language codes for quick lookup */
const RTL_CODES = new Set(
  SUPPORTED_LANGUAGES.filter((l) => l.rtl).map((l) => l.code),
);

/**
 * Check if a language code is RTL.
 * Handles full codes ("he"), regional codes ("ar-SA"), and case variations.
 */
export function isRtlLanguage(langCode: string): boolean {
  if (!langCode) return false;
  const base = langCode.toLowerCase().split("-")[0];
  return RTL_CODES.has(base) || RTL_CODES.has(langCode.toLowerCase());
}

/**
 * Look up a language config by code.
 * Handles exact matches and base-code fallback (e.g. "pt-BR" → exact, "fr-CA" → "fr").
 */
export function getLanguageConfig(langCode: string): LanguageConfig | null {
  if (!langCode) return null;
  const lower = langCode.toLowerCase();
  // Exact match first
  const exact = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact;
  // Base code fallback
  const base = lower.split("-")[0];
  return SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === base) || null;
}

/**
 * Get the text direction for a language code.
 */
export function getTextDirection(langCode: string): "ltr" | "rtl" {
  return isRtlLanguage(langCode) ? "rtl" : "ltr";
}

/**
 * Get human-readable language label for display.
 * Returns "Hebrew (עברית)" format.
 */
export function getLanguageLabel(langCode: string): string {
  const config = getLanguageConfig(langCode);
  if (!config) return langCode;
  return config.name === config.nativeName
    ? config.name
    : `${config.name} (${config.nativeName})`;
}
