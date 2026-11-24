import { useEffect, useRef, useState } from "react";
import "./App.css";

const DEFAULT_DOC_TYPE = "Legal Policies";

const SAMPLE_PRIVACY =
  "By continuing to use SnapVault, you agree to our Terms and Privacy Policy. Your plan auto-renews at ₹399/month unless cancelled 5 days before renewal. We collect your name, email, phone number, approximate location, contacts, and uploaded photos/documents. Your uploaded files and usage behavior may be shared with analytics and advertising partners and used to train machine learning models. Disputes are subject to binding arbitration.";

function getToneClass(level) {
  const value = (level || "").toLowerCase();
  if (value.includes("high")) return "tone-high";
  if (value.includes("good") || value.includes("safe") || value.includes("low")) {
    return "tone-good";
  }
  return "tone-watch";
}

function applyThemeClasses(isDark) {
  document.documentElement.classList.toggle("ct-dark-mode", isDark);
  document.body.classList.toggle("ct-body-dark", isDark);
}

function readInitialTheme() {
  try {
    return localStorage.getItem("ctThemeMode") === "dark";
  } catch {
    return false;
  }
}

function writeThemeChoice(isDark) {
  const mode = isDark ? "dark" : "light";
  try {
    localStorage.setItem("ctThemeMode", mode);
  } catch {
    // Ignore storage errors
  }
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ ctThemeMode: mode });
  }
}

function readInitialSession() {
  try {
    const raw = localStorage.getItem("ctSavedSession");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        text: typeof parsed?.text === "string" ? parsed.text : "",
        docType:
          typeof parsed?.docType === "string" && parsed.docType
            ? parsed.docType
            : DEFAULT_DOC_TYPE,
        result: parsed?.result || null,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return {
    text: "",
    docType: DEFAULT_DOC_TYPE,
    result: null,
  };
}

function saveSession(session) {
  try {
    localStorage.setItem("ctSavedSession", JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ ctSavedSession: session });
  }
}

function clearSavedSession() {
  try {
    localStorage.removeItem("ctSavedSession");
  } catch {
    // Ignore storage errors
  }
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.remove(["ctSavedSession"]);
  }
}

function parseModelJson(rawText) {
  const cleaned = String(rawText || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error("Model returned incomplete JSON.");
  }
}

export default function App() {
  const isFullView =
    new URLSearchParams(window.location.search).get("view") === "full";
  const initialSession = readInitialSession();

  const [text, setText] = useState(initialSession.text);
  const [docType, setDocType] = useState(initialSession.docType);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(initialSession.result);
  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);
  const [darkMode, setDarkMode] = useState(readInitialTheme);

  const actionsRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
    stretching: false,
  });

  useEffect(() => {
    applyThemeClasses(darkMode);

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["ctThemeMode", "ctSavedSession"], (data) => {
        if (data?.ctThemeMode === "dark" || data?.ctThemeMode === "light") {
          const isDark = data.ctThemeMode === "dark";
          setDarkMode(isDark);
          applyThemeClasses(isDark);
          try {
            localStorage.setItem("ctThemeMode", data.ctThemeMode);
          } catch {
            // Ignore storage errors
          }
        }

        if (data?.ctSavedSession) {
          const s = data.ctSavedSession;
          if (typeof s.text === "string") setText(s.text);
          if (typeof s.docType === "string" && s.docType) setDocType(s.docType);
          if (s.result) setResult(s.result);
          try {
            localStorage.setItem("ctSavedSession", JSON.stringify(s));
          } catch {
            // Ignore storage errors
          }
        }
      });

      const onStorageChange = (changes, areaName) => {
        if (areaName !== "local") return;

        if (changes.ctThemeMode) {
          const nextVal = changes.ctThemeMode.newValue;
          if (nextVal === "dark" || nextVal === "light") {
            const isDark = nextVal === "dark";
            setDarkMode(isDark);
            applyThemeClasses(isDark);
          }
        }

        if (changes.ctSavedSession) {
          const nextSession = changes.ctSavedSession.newValue;
          if (!nextSession) {
            setText("");
            setDocType(DEFAULT_DOC_TYPE);
            setResult(null);
          } else {
            if (typeof nextSession.text === "string") setText(nextSession.text);
            if (typeof nextSession.docType === "string" && nextSession.docType) {
              setDocType(nextSession.docType);
            }
            setResult(nextSession.result || null);
          }
        }
      };

      chrome.storage.onChanged?.addListener(onStorageChange);
      return () => chrome.storage.onChanged?.removeListener(onStorageChange);
    }
  }, []);

  const moveThumbToButton = (btnEl) => {
    const container = actionsRef.current;
    if (!container || !btnEl) return;

    const cRect = container.getBoundingClientRect();
    const bRect = btnEl.getBoundingClientRect();

    setThumbStyle((prev) => ({
      left: bRect.left - cRect.left,
      top: bRect.top - cRect.top,
      width: bRect.width,
      height: bRect.height,
      opacity: 1,
      stretching: prev.opacity === 1 && Math.abs(prev.left - (bRect.left - cRect.left)) > 4,
    }));
  };

  const hideThumb = () => {
    setThumbStyle((prev) => ({
      ...prev,
      opacity: 0,
      stretching: false,
    }));
  };

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--pointer-x", `${x.toFixed(1)}%`);
    e.currentTarget.style.setProperty("--pointer-y", `${y.toFixed(1)}%`);
  };

  const toggleFullViewTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    applyThemeClasses(nextDark);
    writeThemeChoice(nextDark);
  };

  const clearAll = () => {
    setText("");
    setDocType(DEFAULT_DOC_TYPE);
    setResult(null);
    setError("");
    setStatusMsg("");
    setShouldAutoAnalyze(false);
    clearSavedSession();
  };

  const openFullTab = () => {
    const shouldRunInFull = Boolean(text.trim() && !result) || loading;
    saveSession({ text, docType, result });
    if (shouldRunInFull) {
      setShouldAutoAnalyze(true);
    }

    const url =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("index.html?view=full")
        : `${window.location.pathname}?view=full`;

    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const grabPageText = async () => {
    setError("");
    setStatusMsg("");
    setResult(null);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) {
        setError("No active tab found.");
        return;
      }

      if (
        tab.url?.startsWith("chrome://") ||
        tab.url?.startsWith("edge://") ||
        tab.url?.startsWith("about:") ||
        tab.url?.startsWith("chrome-extension://")
      ) {
        setError("Open a website's Terms or Privacy page, or paste text.");
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "GRAB_PAGE_TEXT",
      });
      if (response?.text && response.text.trim().length > 0) {
        const grabbed = response.text.trim();
        setDocType(DEFAULT_DOC_TYPE);
        setText(grabbed);
        setStatusMsg(
          `Grabbed ${grabbed.length.toLocaleString()} chars · ${DEFAULT_DOC_TYPE}`
        );
        saveSession({ text: grabbed, docType: DEFAULT_DOC_TYPE, result: null });
      } else {
        setError(
          "No text found on page. Paste Terms, Privacy, Consent, or Cookie text."
        );
      }
    } catch {
      setError("Refresh the page and try Grab Page, or paste text.");
    }
  };

  const analyzeText = async (overrideText) => {
    setError("");
    setStatusMsg("");
    setResult(null);

    const sourceText = typeof overrideText === "string" ? overrideText : text;
    const trimmed = sourceText.trim();

    if (!trimmed) {
      setError("Grab a page or paste text first.");
      return;
    }

    // Paste your actual API key inside the quotes below before running npm run build
    const apiKey = "";

    if (
      !apiKey ||
      apiKey === "AQ.your_actual_key_here" ||
      apiKey === "your_api_key_here"
    ) {
      setError("Add your Gemini API key in src/App.jsx and rebuild.");
      return;
    }

    const promptLines = [
      "You are Beacon, a cautious, strict legal and privacy text reviewer. Base EVERY statement strictly on the provided text. Do NOT guess, assume missing clauses, or invent risks that are not present in the text.",
      "",
      "First, identify what kind of text this actually is and set \"detectedDocType\" to one of:",
      '- "Terms & Conditions"',
      '- "Privacy Policy"',
      '- "Terms & Conditions & Privacy Policy"',
      '- "Sign-Up / Consent Screen"',
      '- "Cookie / Data-Sharing Notice"',
      '- "Not a Policy / Unclear"',
      "",
      "Next, check whether the text actually contains legal/policy/consent/cookie content or is mostly HTML markup, navigation menus, raw code/JSON, random snippets, or unrelated page text:",
      '- If the text does NOT contain actual legal/policy/consent/cookie terms: set "detectedDocType" to "Not a Policy / Unclear", set "verdict" to "Unclear / Not Policy", set "headline" to state plainly that no clear legal or policy clauses were found in the text, keep "whatYouAccept" to at most 1 item explaining what the text actually is, and keep "dataShared" as [].',
      '- If the text DOES contain policy/legal/consent/cookie clauses, use these strict criteria:',
      '  - "Good": Clearly stated user protections, easy opt-outs/controls, no hidden billing or intrusive tracking, and terms that genuinely protect the user.',
      '  - "Watch Out": Standard data collection, routine account/service rules, or targeted/personalized ads where user data is used for ad delivery.',
      '  - "High Risk": Broad/invasive data collection (contacts, precise location, private files), cross-app/cross-site ad tracking, AI/ML model training on user content, forced arbitration, or tricky auto-renewals/cancellation traps.',
      "",
      "Never mark targeted advertisements or ad-funded tracking as 'Good'. Never invent clauses not found in the text.",
      "Review all relevant clauses present in the text—such as auto-renewals, billing/cancellation cutoffs, refunds, account termination, arbitration/waivers, personal data collected, third-party/ad sharing, AI/ML model training, consent/permissions, or tracking cookies.",
      "",
      "Return ONLY valid JSON with concise strings (no unescaped quotes or newlines inside strings) in this exact schema:",
      "{",
      '  "detectedDocType": "Terms & Conditions" | "Privacy Policy" | "Terms & Conditions & Privacy Policy" | "Sign-Up / Consent Screen" | "Cookie / Data-Sharing Notice" | "Not a Policy / Unclear",',
      '  "verdict": "Good" | "Watch Out" | "High Risk" | "Unclear / Not Policy",',
      '  "headline": "short 6-10 word takeaway based strictly on the text",',
      '  "whatYouAccept": [',
      "    {",
      '      "title": "short point from text",',
      '      "level": "Good" | "Watch Out" | "High Risk",',
      '      "detail": "1 simple sentence grounded strictly in the text"',
      "    }",
      "  ],",
      '  "dataShared": [',
      "    {",
      '      "item": "data type mentioned in text",',
      '      "usage": "1 simple sentence on how the text says it is used"',
      "    }",
      "  ]",
      "}",
      "",
      "Text to review:",
      trimmed.slice(0, 8000),
    ];

    const prompt = promptLines.join("\n");

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
    ];

    setLoading(true);
    setStatusMsg("Analyzing...");
    try {
      let lastError = "";

      for (const model of models) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
            apiKey.trim()
          )}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = parseModelJson(raw);
          const resolvedDocType =
            typeof parsed?.detectedDocType === "string" &&
            parsed.detectedDocType.trim()
              ? parsed.detectedDocType.trim()
              : DEFAULT_DOC_TYPE;

          setDocType(resolvedDocType);
          setResult(parsed);
          saveSession({
            text: trimmed,
            docType: resolvedDocType,
            result: parsed,
          });
          return;
        }

        lastError = data?.error?.message || `HTTP ${response.status}`;
      }

      throw new Error(lastError || "Unable to complete analysis right now.");
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setStatusMsg("");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      isFullView &&
      shouldAutoAnalyze &&
      text.trim() &&
      !loading &&
      !result
    ) {
      setShouldAutoAnalyze(false);
      analyzeText(text);
    }
  }, [isFullView, shouldAutoAnalyze, text, loading, result]);

  return (
    <main
      onPointerMove={handlePointerMove}
      className={`ct-popup ${isFullView ? "ct-fullpage" : ""} ${
        darkMode ? "ct-dark" : ""
      }`}
    >
      <header className="ct-header">
        <div className="ct-brand">
          <div className="ct-logo">B</div>
          <span className="ct-title">Beacon</span>
        </div>

        <div className="ct-header-actions">
          {isFullView && (
            <button
              type="button"
              onClick={toggleFullViewTheme}
              className="ct-chip-btn"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? "☀ Light" : "☾ Dark"}
            </button>
          )}
          {!isFullView && (
            <button
              type="button"
              onClick={openFullTab}
              className="ct-chip-btn"
              title="Full View"
            >
              ↗ Full
            </button>
          )}
        </div>
      </header>

      <section
        ref={actionsRef}
        onPointerLeave={hideThumb}
        className="ct-actions"
      >
        <span
          aria-hidden="true"
          className={`ct-liquid-thumb ${thumbStyle.stretching ? "is-stretching" : ""}`}
          style={{
            transform: `translate3d(${thumbStyle.left}px, ${thumbStyle.top}px, 0)`,
            width: `${thumbStyle.width}px`,
            height: `${thumbStyle.height}px`,
            opacity: thumbStyle.opacity,
          }}
        />

        {!isFullView && (
          <button
            type="button"
            onPointerEnter={(e) => moveThumbToButton(e.currentTarget)}
            onFocus={(e) => moveThumbToButton(e.currentTarget)}
            onClick={grabPageText}
            className="ct-btn ct-btn-ghost"
          >
            Grab Page
          </button>
        )}
        <button
          type="button"
          onPointerEnter={(e) => moveThumbToButton(e.currentTarget)}
          onFocus={(e) => moveThumbToButton(e.currentTarget)}
          onClick={clearAll}
          className="ct-btn ct-btn-ghost"
        >
          Clear
        </button>
        <button
          type="button"
          onPointerEnter={(e) => moveThumbToButton(e.currentTarget)}
          onFocus={(e) => moveThumbToButton(e.currentTarget)}
          onClick={() => analyzeText()}
          disabled={loading}
          className="ct-btn ct-btn-primary"
        >
          {loading ? "Checking..." : "Check"}
        </button>
        {isFullView && (
          <button
            type="button"
            onPointerEnter={(e) => moveThumbToButton(e.currentTarget)}
            onFocus={(e) => moveThumbToButton(e.currentTarget)}
            onClick={() => {
              setDocType(DEFAULT_DOC_TYPE);
              setText(SAMPLE_PRIVACY);
              setError("");
              setStatusMsg("Sample loaded.");
              setResult(null);
              saveSession({
                text: SAMPLE_PRIVACY,
                docType: DEFAULT_DOC_TYPE,
                result: null,
              });
            }}
            className="ct-btn ct-btn-ghost"
          >
            Sample
          </button>
        )}
      </section>

      <div className="ct-box">
        <div className="ct-box-bar">
          <span className="ct-tag">{docType}</span>
          <span className="ct-count">{text.length.toLocaleString()}</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            const nextVal = e.target.value;
            setDocType(DEFAULT_DOC_TYPE);
            setText(nextVal);
            saveSession({ text: nextVal, docType: DEFAULT_DOC_TYPE, result });
          }}
          placeholder="Grab page or paste Terms, Privacy, Consent, or Cookie text..."
          rows={isFullView ? 8 : 4}
          className="ct-textarea"
        />
      </div>

      {statusMsg && !error && <p className="ct-msg">{statusMsg}</p>}
      {error && <p className="ct-err">{error}</p>}

      {result && (
        <section className="ct-results">
          <div className={`ct-verdict ${getToneClass(result.verdict)}`}>
            <div className="ct-verdict-row">
              <span className="ct-pill">{result.verdict || "Watch Out"}</span>
              {result.headline && (
                <span className="ct-headline">{result.headline}</span>
              )}
            </div>
          </div>

          <div className={isFullView ? "ct-grid" : "ct-stack"}>
            {Array.isArray(result.whatYouAccept) &&
              result.whatYouAccept.length > 0 && (
                <div className="ct-card">
                  <h2 className="ct-card-title">Key Terms</h2>
                  {result.whatYouAccept.map((item, idx) => (
                    <div
                      key={idx}
                      className={`ct-row ${getToneClass(item.level)}`}
                    >
                      <div className="ct-row-top">
                        <strong>{item.title}</strong>
                        <span
                          className={`ct-pill ct-pill-xs ${getToneClass(
                            item.level
                          )}`}
                        >
                          {item.level || "Watch Out"}
                        </span>
                      </div>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
              )}

            {Array.isArray(result.dataShared) && result.dataShared.length > 0 && (
              <div className="ct-card">
                <h2 className="ct-card-title">Data Shared</h2>
                {result.dataShared.map((entry, idx) => (
                  <div key={idx} className="ct-row">
                    <strong>{entry.item}</strong>
                    <p>{entry.usage}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}