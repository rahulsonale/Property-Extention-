(() => {
  globalThis.captureListingEvidence = async (card) => {
    let lastError = 'Screenshot capture failed.';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      const rect = card.getBoundingClientRect();
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_LISTING_VIEWPORT' }, (result) => {
          const runtimeError = chrome.runtime.lastError;
          resolve(runtimeError ? { error: runtimeError.message } : result);
        });
      });

      if (!response?.ok || !response.image) {
        lastError = response?.error ?? 'The extension could not capture the visible tab.';
      } else {
        const imageResult = await new Promise((resolve) => {
          const screenshot = new Image();
          screenshot.onload = () => {
            const scaleX = screenshot.naturalWidth / window.innerWidth;
            const scaleY = screenshot.naturalHeight / window.innerHeight;
            const left = Math.max(0, Math.round(rect.left * scaleX));
            const top = Math.max(0, Math.round(rect.top * scaleY));
            const right = Math.min(screenshot.naturalWidth, Math.round(rect.right * scaleX));
            const bottom = Math.min(screenshot.naturalHeight, Math.round(rect.bottom * scaleY));

            if (right <= left || bottom <= top) {
              resolve({ error: 'Listing card was outside the captured viewport.' });
              return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = right - left;
            canvas.height = bottom - top;
            const context = canvas.getContext('2d');
            if (!context) {
              resolve({ error: 'Could not crop the listing screenshot.' });
              return;
            }

            context.drawImage(
              screenshot,
              left,
              top,
              canvas.width,
              canvas.height,
              0,
              0,
              canvas.width,
              canvas.height,
            );
            resolve({
              image: canvas.toDataURL('image/jpeg', 0.72),
              url: response.url ?? location.href,
              capturedAt: response.capturedAt ?? new Date().toISOString(),
            });
          };
          screenshot.onerror = () => resolve({ error: 'Could not read the captured screenshot.' });
          screenshot.src = response.image;
        });

        if (imageResult?.image) return imageResult;
        lastError = imageResult?.error ?? lastError;
      }

      console.warn(`[Property Search Assistant] Listing proof attempt ${attempt + 1} failed:`, lastError);
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 700));
    }

    return { error: lastError };
  };
})();
