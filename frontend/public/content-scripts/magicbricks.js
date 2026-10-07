(() => {
  if (!location.pathname.includes('-pdpid-')) return;

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
        id: `magicbricks-${index}`,
        configuration:
          text.match(
            /\b\d+\s*BHK\s+(?:Apartment|Flat|Builder Floor|Independent House|Villa|House)\b/i,
          )?.[0] ?? null,
        price:
          text.match(/(?:₹|Rs\.?)\s*[\d,.]+(?:\s*-\s*[\d,.]+\s*)?(?:Lac|L|Cr|Crore)\b/i)?.[0] ??
          null,
        area:
          text.match(
            /\b\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm)\b/i,
          )?.[0] ?? null,
        areaType:
          text.match(/\b(?:Carpet Area|Super Area|Built[\s-]?up Area|Plot Area)\b/i)?.[0] ?? null,
        ratePerSqFt:
          text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*(?:\/\s*|per\s*)(?:sq\.?\s*ft|sqft)\b/i)?.[0] ??
          null,
      };

      if (listing.price || listing.area || listing.ratePerSqFt) {
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

    const cards = [...document.querySelectorAll('.pdp__prop__card')].filter(isVisible).slice(0, 10);
    if (cards.length) {
      extractionStarted = true;
      clearInterval(timer);
      const listings = await extractListings(cards);

      if (!listings.length) return;
      const data = {
        website: 'Magicbricks',
        propertyName: 'Magicbricks project listings',
        url: location.href,
        listings,
      };

      chrome.runtime.sendMessage({ type: 'PROPERTY_DATA', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Property Search Assistant] Could not send Magicbricks data:', chrome.runtime.lastError.message);
        } else if (!response?.ok) {
          console.warn('[Property Search Assistant] Magicbricks data was not saved.');
        }
      });
      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.info('[Property Search Assistant] No supported Magicbricks property cards were found.');
    }
  }, 500);
})();
