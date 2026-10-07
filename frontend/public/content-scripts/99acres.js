(() => {
  if (!location.pathname.includes('/search/property/')) return;

  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    );
  };

  const extractProjectSummary = () => {
    const card = document.querySelector('.PseudoTupleRevamp__tupleWrapProject');
    if (!card || !visible(card)) return null;

    const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
    const title =
      card.querySelector('.PseudoTupleRevamp__headNrating')?.innerText?.trim() ||
      '99acres property';

    const areaMatch = text.match(
      /\b(\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm))\b/i,
    );

    const ratePattern =
      /(\d+\s*BHK\s+[A-Za-z/-]+)\s*₹\s*([\d,.]+(?:\s*-\s*[\d,.]+)?(?:\s*(?:L|Lac|Lacs|Cr|Crore))?)/gi;

    const configurations = [...text.matchAll(ratePattern)].map((match) => ({
      configuration: match[1].trim(),
      area: areaMatch?.[1] ?? null,
      areaType: /carpet/i.test(text) ? 'Carpet area' : null,
      prices: {
        newBooking: { display: `₹${match[2].trim()}` },
        resale: null,
        rental: null,
      },
    }));

    return { propertyName: title, configurations };
  };

  const extractListings = async () => {
    const initialScrollY = window.scrollY;
    const cards = [...document.querySelectorAll('.tupleNew__outerTupleWrap')]
      .filter(visible)
      .slice(0, 10);
    const listings = [];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const text = (card.innerText || '').replace(/\s+/g, ' ').trim();

      const price =
        text.match(
          /(?:₹|Rs\.?)\s*[\d,.]+(?:\s*-\s*[\d,.]+)?\s*(?:L|Lac|Lacs|Cr|Crore)\b/i,
        )?.[0] ?? null;

      const areaMatch = text.match(
        /\b\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm)\b/i,
      );

      const ratePerSqFt =
        text.match(/(?:₹|Rs\.?)\s*[\d,.]+\s*\/\s*(?:sq\.?\s*ft|sqft)\b/i)?.[0] ?? null;

      const configuration =
        text.match(
          /\b\d+\s*BHK\s+(?:Apartment|Flat|Builder Floor|Independent House|Villa|House)\b/i,
        )?.[0] ?? null;

      const areaType =
        text.match(/\b(?:Carpet Area|Super Area|Built[\s-]?up Area|Plot Area)\b/i)?.[0] ?? null;

      const listing = {
        id: `99acres-${index}-${btoa(unescape(encodeURIComponent(text.slice(0, 80))))}`,
        configuration,
        price,
        area: areaMatch?.[0] ?? null,
        areaType,
        ratePerSqFt,
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

    const project = extractProjectSummary();
    const hasListings = [...document.querySelectorAll('.tupleNew__outerTupleWrap')].some(visible);

    if (project || hasListings) {
      extractionStarted = true;
      clearInterval(timer);
      const listings = await extractListings();

      const data = {
        website: '99acres',
        propertyName: project?.propertyName ?? '99acres search results',
        url: location.href,
        configurations: project?.configurations ?? [],
        listings,
      };

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

      return;
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.info('[Property Search Assistant] No supported 99acres results were found.');
    }
  }, 500);
})();
