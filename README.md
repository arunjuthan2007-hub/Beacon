# Beacon

Beacon is a Chrome extension built with React, Vite, and the Google Gemini API that extracts legal and policy text from web pages or user input, classifies the document type, and translates dense clauses into plain-English **Good**, **Watch Out**, and **High Risk** cards.

## Features
- **Live Page Text Extraction:** Grabs readable legal content from the active browser tab while filtering out navigation bars, sidebars, and surrounding page noise.
- **Document Type Classification:** Identifies whether text is a **Terms & Conditions**, **Privacy Policy**, **Sign-Up / Consent Screen**, or **Cookie / Data-Sharing Notice**.
- **Plain-English Breakdown:** Summarizes what you are agreeing to and what personal or tracking data may be collected or shared, using low-variance (`temperature: 0`) structured output.
- **Compact Popup + Full View Tab:** Provides a compact popup for quick checks and a **Full View** tab (`?view=full`) for detailed reading, with automatic handoff if you switch views while an analysis is running.
- **Theme & Session Sync:** Remembers your theme choice and keeps your active draft/results available across popup reopens and browser restarts until you click **Clear**.

## Tech Stack
- **Frontend:** React, Vite, CSS
- **Browser APIs:** Chrome Extension APIs (`chrome.tabs`, `chrome.storage.local`)
- **AI:** Google Gemini API (`generateContent` with `temperature: 0`)

## Setup & Local Build
1. Clone the repository:
   ```bash
   git clone [https://github.com/arunjuthan2007-hub/Beacon.git](https://github.com/arunjuthan2007-hub/Beacon.git)
   cd Beacon