chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "GRAB_PAGE_TEXT") {
    const selection = window.getSelection()?.toString()?.trim();
    const bodyText =
      selection && selection.length > 30
        ? selection
        : document.body?.innerText || "";

    sendResponse({ text: bodyText.slice(0, 12000) });
  }
  return true;
});