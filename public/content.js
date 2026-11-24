function detectPolicyType(rawText) {
  const fullLower = rawText.toLowerCase();
  const leadLower = rawText.slice(0, 2000).toLowerCase();

  const hasCookieSignals =
    leadLower.includes("cookie policy") ||
    leadLower.includes("cookies policy") ||
    leadLower.includes("about cookies") ||
    leadLower.includes("how we use cookies") ||
    fullLower.includes("strictly necessary") ||
    fullLower.includes("manage cookie") ||
    fullLower.includes("cookie preferences") ||
    (fullLower.includes("cookie") &&
      (fullLower.includes("tracking") ||
        fullLower.includes("advertis") ||
        fullLower.includes("opt out") ||
        fullLower.includes("browser")));

  if (hasCookieSignals) {
    return "Cookie / Data-Sharing Notice";
  }

  if (
    leadLower.includes("sign up") ||
    leadLower.includes("create an account") ||
    leadLower.includes("by continuing") ||
    leadLower.includes("by creating an account") ||
    (rawText.length < 3500 &&
      (fullLower.includes("i agree") || fullLower.includes("consent")))
  ) {
    return "Sign-Up / Consent Screen";
  }

  if (
    leadLower.includes("privacy policy") ||
    leadLower.includes("privacy notice") ||
    fullLower.includes("personal information") ||
    fullLower.includes("personal data")
  ) {
    return "Privacy Policy";
  }

  return "Terms & Conditions";
}

function cleanCloneText(sourceEl) {
  if (!sourceEl) return "";
  const clone = sourceEl.cloneNode(true);

  const noiseSelectors = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "template",
    "iframe",
    "object",
    "embed",
    "[hidden]",
    '[aria-hidden="true"]',
    "nav",
    "aside",
    "header",
    "footer",
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="banner"]',
    '[aria-label*="sidebar" i]',
    '[aria-label*="menu" i]',
    '[aria-label*="navigation" i]',
    '[class*="sidebar" i]',
    '[class*="nav-" i]',
    '[class*="navbar" i]',
    '[class*="breadcrumb" i]',
    '[class*="related" i]',
    '[class*="cookie-banner" i]',
    '[id*="sidebar" i]',
    '[id*="nav" i]',
  ];

  clone.querySelectorAll(noiseSelectors.join(",")).forEach((node) => node.remove());

  // Also strip any elements with inline display: none or visibility: hidden
  clone.querySelectorAll("[style]").forEach((el) => {
    const inlineStyle = (el.getAttribute("style") || "").toLowerCase().replace(/\s+/g, "");
    if (inlineStyle.includes("display:none") || inlineStyle.includes("visibility:hidden")) {
      el.remove();
    }
  });

  // Detached clones don't always compute styles in innerText, so fall back to textContent
  const raw =
    sourceEl.isConnected && typeof clone.innerText === "string" && clone.innerText.length > 0
      ? clone.innerText
      : clone.textContent || "";

  return raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findPolicyContainerFromHeading() {
  const headings = Array.from(document.querySelectorAll("h1, h2"));
  const legalHeading = headings.find((h) => {
    const t = (h.innerText || h.textContent || "").toLowerCase();
    return (
      t.includes("terms of use") ||
      t.includes("terms of service") ||
      t.includes("terms and conditions") ||
      t.includes("privacy policy") ||
      t.includes("cookies policy") ||
      t.includes("cookie policy") ||
      t.includes("legal")
    );
  });

  if (!legalHeading) return null;

  let current = legalHeading.parentElement;
  for (let i = 0; i < 5 && current && current !== document.body; i++) {
    const cleaned = cleanCloneText(current);
    if (cleaned.length >= 300) {
      return cleaned;
    }
    current = current.parentElement;
  }

  return null;
}

function extractReadablePageText() {
  const fromHeading = findPolicyContainerFromHeading();
  if (fromHeading) {
    return fromHeading;
  }

  const candidates = [
    "article",
    "main",
    '[role="main"]',
    ".terms",
    ".privacy",
    ".policy",
    ".legal",
    "#terms",
    "#privacy",
    "#policy",
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (el) {
      const cleaned = cleanCloneText(el);
      if (cleaned.length >= 200) {
        return cleaned;
      }
    }
  }

  return cleanCloneText(document.body);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GRAB_PAGE_TEXT") {
    const text = extractReadablePageText();
    const docType = detectPolicyType(text);
    sendResponse({ text, docType });
  }
  return true;
});