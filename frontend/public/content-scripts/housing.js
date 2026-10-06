(() => {
  if (!location.pathname.startsWith('/in/buy/')) return;

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

    const cards = [...document.querySelectorAll('.T_cardV1Style')].filter(isVisible).slice(0, 10);

    const listings = cards
      .map((card) => {
        const text = (card.innerText || '').replace(/\s+/g, ' ').trim();

        return {
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
            text.match(
              /\b(?:Carpet|Built[\s-]?up|Super[\s-]?built[\s-]?up|Super)\s+area\b/i,
            )?.[0] ?? null,
          ratePerSqFt:
            text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*k?\s*(?:\/|per)\s*sq\.?\s*ft\b/i)?.[0] ?? null,
        };
      })
      .filter((listing) => listing.price || listing.area || listing.ratePerSqFt);

    if (listings.length) {
      clearInterval(timer);

      const data = {
        website: 'Housing.com',
        propertyName: 'Housing.com project listings',
        url: location.href,
        listings,
      };

      chrome.runtime.sendMessage({ type: 'PROPERTY_DATA', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            '[Property Search Assistant] Could not send Housing.com data:',
            chrome.runtime.lastError.message,
          );
        } else if (!response?.ok) {
          console.warn('[Property Search Assistant] Housing.com data was not saved.');
        }
      });

      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.info(
        '[Property Search Assistant] No supported Housing.com property cards were found.',
      );
    }
  }, 500);
})();
