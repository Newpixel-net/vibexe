/**
 * URL Analyzer — Server-side website content extraction for site replication.
 * Fetches HTML/CSS and extracts design tokens (fonts, colors, typography, layout).
 * Detects language, text direction, and content locale for multi-language support.
 */

import { isRtlLanguage, getLanguageConfig, getLanguageLabel } from "./languages";

export interface SiteLanguage {
  /** ISO 639-1 code detected from HTML lang, meta, or content analysis */
  code: string;
  /** Human-readable label (e.g. "Hebrew (עברית)") */
  label: string;
  /** Text direction: "ltr" or "rtl" */
  direction: "ltr" | "rtl";
  /** How was the language detected */
  source: "html-lang" | "meta-language" | "content-language-header" | "og-locale" | "content-analysis";
}

export interface SiteAnalysis {
  url: string;
  title: string;
  description: string;
  language: SiteLanguage;
  fonts: { family: string; weights: string[]; source: "google" | "adobe" | "custom" }[];
  colors: { role: string; value: string }[];
  typography: { element: string; fontSize: string; fontWeight: string; lineHeight: string }[];
  layout: { sections: string[]; hasHero: boolean; hasNav: boolean; hasFooter: boolean; hasRtl: boolean };
  animations: string[];
  images: { src: string; alt: string; role: "logo" | "hero" | "background" | "content" }[];
  cssVariables: Record<string, string>;
  meta: Record<string, string>;
  /** Raw text content samples for AI context (helps AI understand the site's language) */
  textSamples: string[];
}

const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch and analyze a URL to extract design tokens for replication.
 * Returns null if the URL can't be fetched.
 */
export async function analyzeUrl(url: string): Promise<SiteAnalysis | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const baseUrl = new URL(url).origin;

    // Detect language from multiple sources (priority order)
    const contentLanguageHeader = response.headers.get("Content-Language") || "";
    const language = detectLanguage(html, contentLanguageHeader);

    // Extract meta info
    const title = extractTag(html, "title") || "";
    const description = extractMeta(html, "description") || extractMeta(html, "og:description") || "";
    const meta = extractAllMeta(html);

    // Extract visible text samples for AI context
    const textSamples = extractTextSamples(html);

    // Extract fonts
    const fonts = extractFonts(html, baseUrl);

    // Extract colors from inline styles and CSS
    const colors = extractColors(html);

    // Extract typography patterns
    const typography = extractTypography(html);

    // Extract layout structure (includes RTL detection)
    const layout = extractLayout(html);
    // Override RTL flag from language detection
    if (language.direction === "rtl") layout.hasRtl = true;

    // Extract animation patterns
    const animations = extractAnimations(html);

    // Extract images
    const images = extractImages(html, baseUrl);

    // Extract CSS custom properties
    const cssVariables = extractCssVariables(html);

    // Fetch external stylesheets for deeper analysis
    const stylesheetUrls = extractStylesheetUrls(html, baseUrl);
    for (const cssUrl of stylesheetUrls.slice(0, 5)) {
      try {
        const cssResponse = await fetch(cssUrl, {
          headers: { "User-Agent": CHROME_UA },
          signal: AbortSignal.timeout(5000),
        });
        if (cssResponse.ok) {
          const cssText = await cssResponse.text();
          // Merge CSS analysis
          const cssColors = extractColorsFromCss(cssText);
          for (const c of cssColors) {
            if (!colors.some((existing) => existing.value === c.value)) {
              colors.push(c);
            }
          }
          const cssFonts = extractFontsFromCss(cssText);
          for (const f of cssFonts) {
            if (!fonts.some((existing) => existing.family === f.family)) {
              fonts.push(f);
            }
          }
          const cssVars = extractCssVariablesFromCss(cssText);
          Object.assign(cssVariables, cssVars);
          const cssAnims = extractAnimationsFromCss(cssText);
          for (const a of cssAnims) {
            if (!animations.includes(a)) animations.push(a);
          }
        }
      } catch {
        // Skip inaccessible stylesheets
      }
    }

    console.log(`[URL Analyzer] Language detected: ${language.label} (${language.code}), direction: ${language.direction}, source: ${language.source}`);

    return {
      url,
      title,
      description,
      language,
      fonts,
      colors: colors.slice(0, 20),
      typography,
      layout,
      animations: animations.slice(0, 15),
      images: images.slice(0, 20),
      cssVariables,
      meta,
      textSamples,
    };
  } catch (error) {
    console.error("[URL Analyzer] Failed to analyze:", url, error);
    return null;
  }
}

// ─── HTML Parsing Helpers ─────────────────────────────────────────

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractAllMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const regex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    meta[match[1]] = match[2];
  }
  return meta;
}

// ─── Font Extraction ──────────────────────────────────────────────

function extractFonts(html: string, _baseUrl: string): SiteAnalysis["fonts"] {
  const fonts: SiteAnalysis["fonts"] = [];

  // Google Fonts links
  const googleFontRegex = /fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = googleFontRegex.exec(html)) !== null) {
    const familyStr = decodeURIComponent(match[1]);
    const families = familyStr.split("|");
    for (const fam of families) {
      const [name, params] = fam.split(":");
      const weights = params
        ? params.match(/\d{3}/g) || ["400"]
        : ["400"];
      fonts.push({
        family: name.replace(/\+/g, " "),
        weights,
        source: "google",
      });
    }
  }

  // @font-face in inline styles
  const fontFaceRegex = /font-family:\s*["']?([^"';,}]+)/gi;
  while ((match = fontFaceRegex.exec(html)) !== null) {
    const family = match[1].trim();
    if (!fonts.some((f) => f.family.toLowerCase() === family.toLowerCase()) &&
        !["inherit", "initial", "unset", "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui"].includes(family.toLowerCase())) {
      fonts.push({ family, weights: ["400"], source: "custom" });
    }
  }

  return fonts;
}

function extractFontsFromCss(css: string): SiteAnalysis["fonts"] {
  const fonts: SiteAnalysis["fonts"] = [];
  const fontFaceRegex = /@font-face\s*\{[^}]*font-family:\s*["']?([^"';,}]+)[^}]*\}/gi;
  let match: RegExpExecArray | null;
  while ((match = fontFaceRegex.exec(css)) !== null) {
    const family = match[1].trim();
    const weightMatch = match[0].match(/font-weight:\s*(\d{3})/);
    fonts.push({
      family,
      weights: weightMatch ? [weightMatch[1]] : ["400"],
      source: "custom",
    });
  }
  return fonts;
}

// ─── Color Extraction ─────────────────────────────────────────────

function extractColors(html: string): SiteAnalysis["colors"] {
  const colors: SiteAnalysis["colors"] = [];
  const seen = new Set<string>();

  // Hex colors
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
  let match: RegExpExecArray | null;
  while ((match = hexRegex.exec(html)) !== null) {
    const value = match[0].toLowerCase();
    if (!seen.has(value) && value.length >= 4) {
      seen.add(value);
      colors.push({ role: "detected", value });
    }
  }

  // rgb/rgba colors
  const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/gi;
  while ((match = rgbRegex.exec(html)) !== null) {
    const value = match[0].toLowerCase();
    if (!seen.has(value)) {
      seen.add(value);
      colors.push({ role: "detected", value });
    }
  }

  // Try to detect role from context
  const bgColorMatch = html.match(/(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
  if (bgColorMatch) {
    const existing = colors.find((c) => c.value === bgColorMatch[1].toLowerCase());
    if (existing) existing.role = "background";
  }

  const textColorMatch = html.match(/(?:^|\s)color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
  if (textColorMatch) {
    const existing = colors.find((c) => c.value === textColorMatch[1].toLowerCase());
    if (existing) existing.role = "text";
  }

  return colors;
}

function extractColorsFromCss(css: string): SiteAnalysis["colors"] {
  const colors: SiteAnalysis["colors"] = [];
  const seen = new Set<string>();

  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
  let match: RegExpExecArray | null;
  while ((match = hexRegex.exec(css)) !== null) {
    const value = match[0].toLowerCase();
    if (!seen.has(value) && value.length >= 4) {
      seen.add(value);
      colors.push({ role: "detected", value });
    }
  }

  return colors;
}

// ─── Typography Extraction ────────────────────────────────────────

function extractTypography(html: string): SiteAnalysis["typography"] {
  const typography: SiteAnalysis["typography"] = [];

  // Extract from inline styles on heading/text elements
  const styleRegex = /<(h[1-6]|p|span|div|a)[^>]+style=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(html)) !== null) {
    const element = match[1];
    const style = match[2];
    const fontSize = style.match(/font-size:\s*([^;]+)/i)?.[1]?.trim() || "";
    const fontWeight = style.match(/font-weight:\s*([^;]+)/i)?.[1]?.trim() || "";
    const lineHeight = style.match(/line-height:\s*([^;]+)/i)?.[1]?.trim() || "";
    if (fontSize || fontWeight) {
      typography.push({ element, fontSize, fontWeight, lineHeight });
    }
  }

  return typography;
}

// ─── Layout Extraction ────────────────────────────────────────────

function extractLayout(html: string): SiteAnalysis["layout"] {
  const lower = html.toLowerCase();
  const sections: string[] = [];

  if (lower.includes("<header") || lower.includes("class=\"header") || lower.includes("id=\"header")) {
    sections.push("header");
  }
  if (lower.includes("<nav") || lower.includes("class=\"nav")) {
    sections.push("navigation");
  }
  if (lower.includes("hero") || lower.includes("banner") || lower.includes("jumbotron")) {
    sections.push("hero");
  }
  if (lower.includes("<main") || lower.includes("class=\"main")) {
    sections.push("main-content");
  }
  if (lower.includes("<aside") || lower.includes("sidebar")) {
    sections.push("sidebar");
  }
  if (lower.includes("<footer") || lower.includes("class=\"footer") || lower.includes("id=\"footer")) {
    sections.push("footer");
  }

  // Detect generic sections
  const sectionRegex = /<section[^>]*(?:class|id)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(html)) !== null) {
    const name = match[1].split(/\s+/)[0];
    if (!sections.includes(name)) {
      sections.push(name);
    }
  }

  // Detect RTL from dir attribute or direction CSS
  const hasRtl = /dir=["']rtl["']/i.test(html) || /direction:\s*rtl/i.test(html);

  return {
    sections,
    hasHero: sections.includes("hero"),
    hasNav: sections.includes("navigation"),
    hasFooter: sections.includes("footer"),
    hasRtl,
  };
}

// ─── Animation Extraction ─────────────────────────────────────────

function extractAnimations(html: string): string[] {
  const animations: string[] = [];

  if (html.includes("transition")) animations.push("CSS transitions detected");
  if (html.includes("@keyframes")) animations.push("CSS keyframe animations detected");
  if (html.includes("transform")) animations.push("CSS transforms detected");
  if (html.includes("animation")) animations.push("CSS animations detected");
  if (html.includes("backdrop-filter")) animations.push("backdrop-filter effects detected");
  if (html.includes("mix-blend-mode")) animations.push("mix-blend-mode effects detected");
  if (html.includes("scroll-behavior")) animations.push("smooth scroll behavior detected");

  // Specific transition patterns
  const transitionRegex = /transition[^;:]*:\s*([^;}"']+)/gi;
  let match: RegExpExecArray | null;
  while ((match = transitionRegex.exec(html)) !== null) {
    const value = match[1].trim();
    if (value.length < 100 && !animations.includes(value)) {
      animations.push(`transition: ${value}`);
    }
  }

  return animations;
}

function extractAnimationsFromCss(css: string): string[] {
  const animations: string[] = [];

  const keyframeRegex = /@keyframes\s+([^\s{]+)/g;
  let match: RegExpExecArray | null;
  while ((match = keyframeRegex.exec(css)) !== null) {
    animations.push(`@keyframes ${match[1]}`);
  }

  if (css.includes("backdrop-filter")) animations.push("backdrop-filter in CSS");
  if (css.includes("mix-blend-mode")) animations.push("mix-blend-mode in CSS");

  return animations;
}

// ─── Image Extraction ─────────────────────────────────────────────

function extractImages(html: string, baseUrl: string): SiteAnalysis["images"] {
  const images: SiteAnalysis["images"] = [];
  const seen = new Set<string>();

  // <img> tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (!seen.has(src)) {
      seen.add(src);
      const alt = match[2] || "";
      const role = classifyImageRole(src, alt, html);
      images.push({ src, alt, role });
    }
  }

  // Background images in inline styles
  const bgImgRegex = /background(?:-image)?:\s*url\(["']?([^)"']+)["']?\)/gi;
  while ((match = bgImgRegex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (!seen.has(src)) {
      seen.add(src);
      images.push({ src, alt: "", role: "background" });
    }
  }

  return images;
}

function resolveUrl(src: string, baseUrl: string): string {
  if (src.startsWith("http")) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `${baseUrl}${src}`;
  return `${baseUrl}/${src}`;
}

function classifyImageRole(_src: string, _alt: string, _html: string): "logo" | "hero" | "background" | "content" {
  const lower = (_src + _alt).toLowerCase();
  if (lower.includes("logo")) return "logo";
  if (lower.includes("hero") || lower.includes("banner")) return "hero";
  if (lower.includes("bg") || lower.includes("background")) return "background";
  return "content";
}

// ─── CSS Variables ────────────────────────────────────────────────

function extractCssVariables(html: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;}"']+)/g;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(html)) !== null) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

function extractCssVariablesFromCss(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(css)) !== null) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

// ─── Stylesheet URLs ──────────────────────────────────────────────

function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    urls.push(resolveUrl(match[1], baseUrl));
  }
  // Also check reverse order (href before rel)
  const linkRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi;
  while ((match = linkRegex2.exec(html)) !== null) {
    const resolved = resolveUrl(match[1], baseUrl);
    if (!urls.includes(resolved)) urls.push(resolved);
  }
  return urls;
}

// ─── Language Detection ──────────────────────────────────────────

/**
 * Detect website language from multiple sources (priority order):
 * 1. <html lang="..."> attribute
 * 2. <meta http-equiv="content-language"> tag
 * 3. Content-Language HTTP header
 * 4. og:locale meta tag
 * 5. dir="rtl" attribute (infers RTL language)
 * 6. Content analysis (Unicode script detection)
 */
function detectLanguage(html: string, contentLanguageHeader: string): SiteLanguage {
  // 1. HTML lang attribute — most reliable
  const htmlLangMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  if (htmlLangMatch) {
    const code = htmlLangMatch[1].trim();
    return buildSiteLanguage(code, "html-lang");
  }

  // 2. Meta http-equiv content-language
  const metaLangMatch = html.match(/<meta[^>]+http-equiv=["']content-language["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+http-equiv=["']content-language["']/i);
  if (metaLangMatch) {
    return buildSiteLanguage(metaLangMatch[1].trim(), "meta-language");
  }

  // 3. Content-Language HTTP header
  if (contentLanguageHeader) {
    const code = contentLanguageHeader.split(",")[0].trim();
    if (code) return buildSiteLanguage(code, "content-language-header");
  }

  // 4. og:locale meta tag (e.g. "he_IL", "ar_SA")
  const ogLocaleMatch = html.match(/<meta[^>]+property=["']og:locale["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:locale["']/i);
  if (ogLocaleMatch) {
    const locale = ogLocaleMatch[1].trim();
    // Convert og:locale format (he_IL) to language code (he)
    const code = locale.replace("_", "-").split("-")[0];
    return buildSiteLanguage(code, "og-locale");
  }

  // 5. dir="rtl" attribute suggests RTL language
  const dirRtlMatch = html.match(/<(?:html|body)[^>]+dir=["']rtl["']/i);
  if (dirRtlMatch) {
    // Try to identify specific RTL language from content
    const rtlCode = detectRtlLanguageFromContent(html);
    return buildSiteLanguage(rtlCode, "content-analysis");
  }

  // 6. Content analysis — detect from Unicode script ranges
  const detectedCode = detectLanguageFromContent(html);
  if (detectedCode !== "en") {
    return buildSiteLanguage(detectedCode, "content-analysis");
  }

  // Default to English
  return buildSiteLanguage("en", "content-analysis");
}

function buildSiteLanguage(code: string, source: SiteLanguage["source"]): SiteLanguage {
  const normalizedCode = code.toLowerCase().split(",")[0].trim();
  const config = getLanguageConfig(normalizedCode);
  return {
    code: normalizedCode,
    label: config ? getLanguageLabel(normalizedCode) : normalizedCode,
    direction: isRtlLanguage(normalizedCode) ? "rtl" : "ltr",
    source,
  };
}

/**
 * Detect language from text content using Unicode script ranges.
 * Returns ISO 639-1 code.
 */
function detectLanguageFromContent(html: string): string {
  // Strip HTML tags to get visible text
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .substring(0, 5000);

  // Count characters in different Unicode ranges
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const cjkChars = (text.match(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const cyrillicChars = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const georgianChars = (text.match(/[\u10A0-\u10FF]/g) || []).length;
  const armenianChars = (text.match(/[\u0530-\u058F]/g) || []).length;
  const tamilChars = (text.match(/[\u0B80-\u0BFF]/g) || []).length;

  const threshold = 10; // Minimum chars to consider a detection
  const counts: [string, number][] = [
    ["he", hebrewChars],
    ["ar", arabicChars],
    ["zh", cjkChars],
    ["ru", cyrillicChars],
    ["th", thaiChars],
    ["ko", koreanChars],
    ["hi", devanagariChars],
    ["bn", bengaliChars],
    ["ka", georgianChars],
    ["hy", armenianChars],
    ["ta", tamilChars],
  ];

  // Find the script with the most characters
  const best = counts.reduce((max, curr) => curr[1] > max[1] ? curr : max, ["en", 0]);
  return best[1] >= threshold ? best[0] : "en";
}

/**
 * When dir="rtl" is detected but no lang attribute, try to identify the specific RTL language.
 */
function detectRtlLanguageFromContent(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").substring(0, 5000);
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;

  if (hebrewChars > arabicChars && hebrewChars > 10) return "he";
  if (arabicChars > hebrewChars && arabicChars > 10) return "ar";
  if (hebrewChars > 5) return "he";
  if (arabicChars > 5) return "ar";
  return "ar"; // Default RTL to Arabic
}

/**
 * Extract visible text samples from the page for AI context.
 * Returns headings, nav items, and key paragraphs.
 */
function extractTextSamples(html: string): string[] {
  const samples: string[] = [];

  // Extract heading content
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length > 2 && text.length < 200) {
      samples.push(text);
    }
  }

  // Extract nav link text
  const navLinkRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  const navTexts: string[] = [];
  while ((match = navLinkRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length > 1 && text.length < 50 && navTexts.length < 10) {
      navTexts.push(text);
    }
  }
  if (navTexts.length > 0) {
    samples.push(`Navigation: ${navTexts.slice(0, 8).join(", ")}`);
  }

  // Extract first few paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pCount = 0;
  while ((match = pRegex.exec(html)) !== null && pCount < 3) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length > 20 && text.length < 300) {
      samples.push(text);
      pCount++;
    }
  }

  // Extract button/CTA text
  const btnRegex = /<(?:button|a)[^>]*class[^>]*(?:btn|button|cta)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  while ((match = btnRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length > 1 && text.length < 50 && samples.length < 15) {
      samples.push(`CTA: ${text}`);
    }
  }

  return samples.slice(0, 15);
}

// ─── Format for Prompt ────────────────────────────────────────────

/**
 * Format SiteAnalysis into a markdown string for injection into the AI prompt.
 */
export function formatSiteAnalysis(analysis: SiteAnalysis): string {
  const sections: string[] = [];

  sections.push(`## Reference Website Analysis: ${new URL(analysis.url).hostname}`);
  if (analysis.title) sections.push(`**Title**: ${analysis.title}`);
  if (analysis.description) sections.push(`**Description**: ${analysis.description}`);

  // Language & Direction — CRITICAL for replication
  sections.push(`\n### ⚠️ LANGUAGE & TEXT DIRECTION (CRITICAL)`);
  sections.push(`- **Language**: ${analysis.language.label} (code: \`${analysis.language.code}\`)`);
  sections.push(`- **Text direction**: ${analysis.language.direction.toUpperCase()}`);
  sections.push(`- **Detection source**: ${analysis.language.source}`);
  if (analysis.language.direction === "rtl") {
    sections.push(`- **RTL REQUIRED**: This site uses right-to-left layout. ALL text, menus, navigation, and layout must flow RTL.`);
  }
  if (analysis.language.code !== "en") {
    sections.push(`- **NON-ENGLISH**: All visible text content (headings, buttons, paragraphs, labels, navigation, footers) MUST be written in ${analysis.language.label}. Do NOT translate to English.`);
  }

  // Text samples for language context
  if (analysis.textSamples.length > 0) {
    sections.push(`\n### Original Text Content (preserve this language)`);
    for (const sample of analysis.textSamples) {
      sections.push(`- "${sample}"`);
    }
  }

  // Fonts
  if (analysis.fonts.length > 0) {
    sections.push("\n### Fonts");
    for (const font of analysis.fonts) {
      sections.push(`- **${font.family}** (${font.weights.join(", ")}) — ${font.source}`);
    }
  }

  // Colors
  if (analysis.colors.length > 0) {
    sections.push("\n### Colors");
    for (const color of analysis.colors) {
      sections.push(`- ${color.role}: \`${color.value}\``);
    }
  }

  // CSS Variables
  if (Object.keys(analysis.cssVariables).length > 0) {
    sections.push("\n### CSS Custom Properties");
    for (const [key, value] of Object.entries(analysis.cssVariables)) {
      sections.push(`- \`${key}\`: \`${value}\``);
    }
  }

  // Typography
  if (analysis.typography.length > 0) {
    sections.push("\n### Typography Scale");
    for (const t of analysis.typography) {
      sections.push(`- \`<${t.element}>\`: font-size: ${t.fontSize}, font-weight: ${t.fontWeight}, line-height: ${t.lineHeight}`);
    }
  }

  // Layout
  sections.push("\n### Layout Structure");
  sections.push(`- Sections: ${analysis.layout.sections.join(", ") || "not detected"}`);
  sections.push(`- Has hero: ${analysis.layout.hasHero ? "yes" : "no"}`);
  sections.push(`- Has navigation: ${analysis.layout.hasNav ? "yes" : "no"}`);
  sections.push(`- Has footer: ${analysis.layout.hasFooter ? "yes" : "no"}`);
  sections.push(`- RTL layout: ${analysis.layout.hasRtl ? "yes" : "no"}`);

  // Animations
  if (analysis.animations.length > 0) {
    sections.push("\n### Animations & Effects");
    for (const anim of analysis.animations) {
      sections.push(`- ${anim}`);
    }
  }

  // Images
  if (analysis.images.length > 0) {
    sections.push("\n### Images");
    for (const img of analysis.images) {
      sections.push(`- ${img.role}: ${img.src}${img.alt ? ` (${img.alt})` : ""}`);
    }
  }

  // Meta
  const ogImage = analysis.meta["og:image"];
  if (ogImage) {
    sections.push(`\n### Open Graph Image\n- ${ogImage}`);
  }

  return sections.join("\n");
}
