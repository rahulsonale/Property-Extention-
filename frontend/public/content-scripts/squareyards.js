(() => {
  if (!location.pathname.startsWith('/sale/')) return;

  const pricePattern = /(?:₹|Rs\.?|INR\s*)\s*[\d,.]+(?:\s*[-–]\s*(?:₹|Rs\.?)?\s*[\d,.]+)?\s*(?:Lac(?:s)?|Lakh(?:s)?|Cr(?:ore)?s?)?/i;
  const areaPattern = /\b\d[\d,]*(?:\s*[-–]\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm)\b/i;
  const configurationPattern = /\b\d+\s*(?:BHK|RK)\b/i;

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };

  const sendProgress = (status, current, total, message) => {
    chrome.runtime.sendMessage({ type: 'LISTING_CAPTURE_PROGRESS', siteId: 'squareyards', status, current, total, message });
  };

  const findCards = () => {
    const elements = [...document.querySelectorAll('article, li, [class*="card"], [class*="Card"]')];
    const candidates = elements
      .filter(isVisible)
      .map((element) => ({ element, text: (element.innerText || '').replace(/\s+/g, ' ').trim() }))
      .filter(({ text }) => text.length >= 40 && text.length <= 1800 && pricePattern.test(text) && areaPattern.test(text) && configurationPattern.test(text))
      .sort((left, right) => left.text.length - right.text.length);

    const cards = [];
    for (const candidate of candidates) {
      if (cards.some((card) => card.contains(candidate.element) || candidate.element.contains(card))) continue;
      cards.push(candidate.element);
      if (cards.length >= 10) break;
    }
    return cards;
  };

  const extract = async (cards) => {
    const listings = [];
    for (let index = 0; index < cards.length; index += 1) {
      const text = (cards[index].innerText || '').replace(/\s+/g, ' ').trim();
      const listing = {
        id: `squareyards-${index}`,
        configuration: text.match(configurationPattern)?.[0] ?? null,
        price: text.match(pricePattern)?.[0] ?? null,
        area: text.match(areaPattern)?.[0] ?? null,
        areaType: text.match(/\b(?:Carpet|Built[\s-]?up|Super[\s-]?built[\s-]?up|Plot)\s*area?\b/i)?.[0] ?? null,
        ratePerSqFt: text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*(?:\/|per)\s*sq\.?\s*ft\b/i)?.[0] ?? null,
      };
      sendProgress('capturing', index + 1, cards.length);
      listing.evidence = await globalThis.captureListingEvidence(cards[index]);
      listings.push(listing);
    }
    return listings;
  };

  let attempts = 0;
  let started = false;
  const timer = setInterval(async () => {
    if (started) return;
    attempts += 1;
    const cards = findCards();
    if (cards.length) {
      started = true;
      clearInterval(timer);
      sendProgress('capturing', 0, cards.length);
      const listings = await extract(cards);
      if (!listings.length) {
        sendProgress('error', 0, cards.length, 'SquareYards listing details could not be read.');
        return;
      }
      sendProgress('complete', listings.length, cards.length);
      chrome.runtime.sendMessage({
        type: 'PROPERTY_DATA',
        data: { website: 'SquareYards', propertyName: 'SquareYards property listings', url: location.href, listings },
      });
      return;
    }
    if (attempts >= 60) {
      clearInterval(timer);
      sendProgress('error', 0, 0, 'SquareYards listings were not found on the opened page.');
    }
  }, 500);
})();
