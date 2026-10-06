(() => {
  if (!location.pathname.includes('-pdpid-')) return;

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    );
  };

  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    const cards = [...document.querySelectorAll('.pdp__prop__card')].filter(isVisible).slice(0, 10);

    const listings = cards
      .map((card) => {
        const text = (card.innerText || '').replace(/\s+/g, ' ').trim();

        return {
          configuration:
            text.match(
              /\b\d+\s*BHK\s+(?:Apartment|Flat|Builder Floor|Independent House|Villa|House)\b/i,
            )?.[0] ?? null,
          price:
            text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*(?:-\s*[\d,.]+\s*)?(?:Lac|L|Cr|Crore)\b/i)?.[0] ??
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
      })
      .filter((listing) => listing.price || listing.area || listing.ratePerSqFt);

    if (listings.length) {
      clearInterval(timer);

      const data = {
        website: 'Magicbricks',
        propertyName: 'Magicbricks project listings',
        url: location.href,
        listings,
      };

      chrome.runtime.sendMessage({ type: 'PROPERTY_DATA', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            '[Property Search Assistant] Could not send Magicbricks data:',
            chrome.runtime.lastError.message,
          );
        } else if (!response?.ok) {
          console.warn('[Property Search Assistant] Magicbricks data was not saved.');
        }
      });

      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.info(
        '[Property Search Assistant] No supported Magicbricks property cards were found.',
      );
    }
  }, 500);
})();
