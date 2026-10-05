(() => {
  if (!location.pathname.includes('/search/property/')) {
    return;
  }

  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    const cards = [...document.querySelectorAll('.PseudoTupleRevamp__tupleWrapProject')];

    const results = cards
      .map((card) => {
        const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
        const title =
          card.querySelector('.PseudoTupleRevamp__headNrating')?.innerText?.trim() ||
          '99acres property';

        const areaMatch = text.match(
          /\b(\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm))\b/i,
        );

        const areaType = /carpet/i.test(text) ? 'Carpet area' : '';

        const ratePattern =
          /(\d+\s*BHK\s+[A-Za-z/-]+)\s*₹\s*([\d,.]+(?:\s*-\s*[\d,.]+)?(?:\s*(?:L|Lac|Lacs|Cr|Crore))?)/gi;

        const configurations = [...text.matchAll(ratePattern)].map((match) => ({
          configuration: match[1].trim(),
          area: areaMatch?.[1] ?? null,
          areaType,
          prices: {
            newBooking: { display: `₹${match[2].trim()}` },
            resale: null,
            rental: null,
          },
        }));

        const link = card.querySelector('a[href]');

        return {
          website: '99acres',
          propertyName: title,
          url: link?.href || location.href,
          configurations,
        };
      })
      .filter((result) => result.configurations.length > 0);

    if (results.length > 0) {
      clearInterval(timer);

      for (const data of results) {
        console.log('[Property Search Assistant] Extracted 99acres data:', data);

        chrome.runtime.sendMessage({ type: 'PROPERTY_DATA', data }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              '[Property Search Assistant] Could not send extracted data:',
              chrome.runtime.lastError.message,
            );
          } else if (!response?.ok) {
            console.warn('[Property Search Assistant] The extension did not save extracted data.');
          }
        });
      }

      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.info('[Property Search Assistant] No supported 99acres project cards were found.');
    }
  }, 500);
})();
