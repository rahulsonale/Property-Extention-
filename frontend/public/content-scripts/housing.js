(() => {
  if (!location.pathname.startsWith('/in/buy/')) return;

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    );
  };

  const extractListings = async (cards) => {
    const initialScrollY = window.scrollY;
    const listings = [];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
      const listing = {
        id: `housing-${index}`,
        configuration:
          text.match(
            /\b\d+\s*BHK\s+(?:Apartment|Flat|Independent House|Independent Floor|Villa|Builder Floor|House)\b/i,
          )?.[0] ?? null,
        price: text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*(?:L|Lac|Lacs|Cr|Crore)\b/i)?.[0] ?? null,
        area:
          text.match(
            /\b\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm)\b/i,
          )?.[0] ?? null,
        areaType:
          text.match(/\b(?:Carpet|Built[\s-]?up|Super[\s-]?built[\s-]?up|Super)\s+area\b/i)?.[0] ??
          null,
        ratePerSqFt:
          text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*k?\s*(?:\/|per)\s*sq\.?\s*ft\b/i)?.[0] ?? null,
      };

      if (listing.price || listing.area || listing.ratePerSqFt) {
        chrome.runtime.sendMessage({
          type: 'LISTING_CAPTURE_PROGRESS',
          siteId: 'housing',
          status: 'capturing',
          current: listings.length + 1,
          total: cards.length,
        });
        listing.evidence = await globalThis.captureListingEvidence(card);
        listings.push(listing);
      }
    }

    window.scrollTo({ top: initialScrollY, behavior: 'instant' });
    return listings;
  };

  let attempts = 0;
  let extractionStarted = false;
  const timer = setInterval(async () => {
    if (extractionStarted) return;
    attempts += 1;

    const cards = [...document.querySelectorAll('.T_cardV1Style')].filter(isVisible).slice(0, 10);
    if (cards.length) {
      extractionStarted = true;
      clearInterval(timer);
      chrome.runtime.sendMessage({
        type: 'LISTING_CAPTURE_PROGRESS',
        siteId: 'housing',
        status: 'capturing',
        current: 0,
        total: cards.length,
      });
      const listings = await extractListings(cards);

      if (!listings.length) {
        chrome.runtime.sendMessage({
          type: 'LISTING_CAPTURE_PROGRESS',
          siteId: 'housing',
          status: 'error',
          current: 0,
          total: cards.length,
          message: 'Housing.com listings could not be read from this page.',
        });
        return;
      }

      chrome.runtime.sendMessage({
        type: 'LISTING_CAPTURE_PROGRESS',
        siteId: 'housing',
        status: 'complete',
        current: listings.length,
        total: cards.length,
      });
      const data = {
        website: 'Housing.com',
        propertyName: 'Housing.com project listings',
        url: location.href,
        listings,
      };

      chrome.runtime.sendMessage({ type: 'PROPERTY_DATA', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Property Search Assistant] Could not send Housing.com data:', chrome.runtime.lastError.message);
        } else if (!response?.ok) {
          console.warn('[Property Search Assistant] Housing.com data was not saved.');
        }
      });
      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.info('[Property Search Assistant] No supported Housing.com property cards were found.');
      chrome.runtime.sendMessage({
        type: 'LISTING_CAPTURE_PROGRESS',
        siteId: 'housing',
        status: 'error',
        current: 0,
        total: 0,
        message: 'Housing.com listings were not found on the opened page. Check that it is a results page and try again.',
      });
    }
  }, 500);
})();
