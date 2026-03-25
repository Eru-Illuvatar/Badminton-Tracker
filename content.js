// content.js – dynamically imports scraper-utils and sets up listener

(async () => {
  try {
    const { scrapeMatchesFromDocument, detectCurrentSite } = await import('./scraper-utils.js');

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "scrape") {
        (async () => {
          try {
            const currentSite = detectCurrentSite(window.location.hostname);
            if (!currentSite) throw new Error('Unsupported site for scraping');
            const data = await scrapeMatchesFromDocument(currentSite, document, window.location.href);
            sendResponse({ success: true, data, message: `Found ${data.length} matches from ${currentSite}` });
          } catch (error) {
            console.error('[content] Scraping error:', error);
            sendResponse({ success: false, data: [], error: error.message });
          }
        })();
        return true;
      }
    });
  } catch (importError) {
    console.error('[content] Failed to load scraper-utils:', importError);
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "scrape") {
        sendResponse({ success: false, data: [], error: `Import failed: ${importError.message}` });
        return true;
      }
    });
  }
})();