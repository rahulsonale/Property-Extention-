(() => {
  if (!location.pathname.includes('/flats-for-sale-in-')) return;

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  };

  const sendProgress = (status, current, total, message) => {
    chrome.runtime.sendMessage({
      type: 'LISTING_CAPTURE_PROGRESS',
      siteId: 'nobroker',
      status,
      current,
      total,
      message,
    });
  };

  const pricePattern = /(?:₹|Rs\.?\s*)\s*[\d,.]+(?:\s*[-–]\s*(?:₹|Rs\.?\s*)?[\d,.]+)?\s*(?:Lacs?|Lakhs?|Cr(?:ores?)?)\b/i;
  const areaPattern = /\b\d[\d,]*(?:\s*[-–]\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm)\b/i;
  const configurationPattern = /\b\d+\s*(?:BHK|RK)\s*(?:Flat|Apartment|House|Villa)?\b/i;

  const getListingCards = () => {
    const selectors = [
      'article',
      'li',
      '[class*="propertyCard"]',
      '[class*="PropertyCard"]',
      '[class*="listingCard"]',
      '[class*="ListingCard"]',
      '[class*="card"]',
    ];
    let elements = [...document.querySelectorAll(selectors.join(','))];

    // NoBroker has changed its card class names over time; use the visible page
    // structure as a fallback when its result cards do not have a stable class.
    if (!elements.length || !elements.some((element) => areaPattern.test(element.innerText || ''))) {
      elements = [...new Set([...elements, ...document.querySelectorAll('main div, #root div')])];
    }

    const candidates = elements
      .filter(isVisible)
      .map((element) => ({
        element,
        text: (element.innerText || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter(
        ({ text }) =>
          text.length >= 45 &&
          text.length <= 1600 &&
          pricePattern.test(text) &&
          areaPattern.test(text) &&
          configurationPattern.test(text),
      )
      .sort((left, right) => left.text.length - right.text.length);

    const cards = [];
    for (const candidate of candidates) {
      if (
        cards.some(
          (card) =>
            card === candidate.element ||
            card.contains(candidate.element) ||
            candidate.element.contains(card),
        )
      ) {
        continue;
      }
      cards.push(candidate.element);
      if (cards.length >= 10) break;
    }

    return cards;
  };

  const extractListings = async (cards) => {
    const initialScrollY = window.scrollY;
    const listings = [];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
      const listing = {
        id: `nobroker-${index}`,
        configuration: text.match(configurationPattern)?.[0] ?? null,
        price: text.match(pricePattern)?.[0] ?? null,
        area: text.match(areaPattern)?.[0] ?? null,
        areaType:
          text.match(/\b(?:Carpet|Built[\s-]?up|Builtup|Super(?:\s+Built[\s-]?up)?|Plot)\s*(?:area)?\b/i)?.[0] ??
          null,
        ratePerSqFt:
          text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*k?\s*(?:\/|per)\s*sq\.?\s*ft\b/i)?.[0] ?? null,
      };

      sendProgress('capturing', listings.length + 1, cards.length);
      listing.evidence = await globalThis.captureListingEvidence(card);
      listings.push(listing);
    }

    window.scrollTo({ top: initialScrollY, behavior: 'instant' });
    return listings;
  };

  let attempts = 0;
  let extractionStarted = false;
  const timer = setInterval(async () => {
    if (extractionStarted) return;
    attempts += 1;

    const cards = getListingCards();
    if (cards.length) {
      extractionStarted = true;
      clearInterval(timer);
      sendProgress('capturing', 0, cards.length);

      const listings = await extractListings(cards);
      if (!listings.length) {
        sendProgress('error', 0, cards.length, 'NoBroker listing details could be read from the results.');
        return;
      }

      sendProgress('complete', listings.length, cards.length);
      const data = {
        website: 'NoBroker',
        propertyName: 'NoBroker property listings',
        url: location.href,
        listings,
      };

      chrome.runtime.sendMessage({ type: 'PROPERTY_DATA', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Property Search Assistant] Could not send NoBroker data:', chrome.runtime.lastError.message);
        } else if (!response?.ok) {
          console.warn('[Property Search Assistant] NoBroker data was not saved.');
        }
      });
      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      sendProgress(
        'error',
        0,
        0,
        'NoBroker listings were not found. Check that the search results have loaded, then try again.',
      );
    }
  }, 500);
})();
