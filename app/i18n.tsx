"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "ja" | "en";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (ja: string, en: string) => string;
};

const I18nContext = createContext<I18nValue>({ locale: "ja", setLocale: () => undefined, t: (ja) => ja });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem("easy-arcade-language");
      setLocaleState(stored === "ja" || stored === "en" ? stored : navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (ready) localStorage.setItem("easy-arcade-language", locale);
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const t = useCallback((ja: string, en: string) => locale === "ja" ? ja : en, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  return <div className="language-switch" aria-label="Language"><button className={locale === "ja" ? "active" : ""} aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>日本語</button><button className={locale === "en" ? "active" : ""} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button></div>;
}
