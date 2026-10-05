const PROPERTY_SITES = [
  {
    id: '99acres',
    name: '99acres',
    homepage: 'https://www.99acres.com/',
  },
  {
    id: 'magicbricks',
    name: 'Magicbricks',
    homepage: 'https://www.magicbricks.com/',
  },
  {
    id: 'housing',
    name: 'Housing.com',
    homepage: 'https://housing.com/',
  },
  {
    id: 'nobroker',
    name: 'NoBroker',
    homepage: 'https://www.nobroker.in/',
  },
  {
    id: 'squareyards',
    name: 'Square Yards',
    homepage: 'https://www.squareyards.com/',
  },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_PROPERTY_SITES') {
    sendResponse({ sites: PROPERTY_SITES });
    return;
  }

  if (message?.type === 'GET_PROPERTY_RESULTS') {
    chrome.storage.local.get({ propertyResults: [] }, ({ propertyResults }) => {
      sendResponse({ results: propertyResults });
    });
    return true;
  }

  if (message?.type === 'PROPERTY_DATA' && message.data) {
    chrome.storage.local.get({ propertyResults: [] }, ({ propertyResults }) => {
      const results = Array.isArray(propertyResults) ? propertyResults : [];
      const sourceTabId = _sender.tab?.id;
      const next = results.filter(
        (item) => !(item.url === message.data.url && item.sourceTabId === sourceTabId),
      );
      next.unshift({ ...message.data, sourceTabId, receivedAt: Date.now() });
      chrome.storage.local.set({ propertyResults: next.slice(0, 50) }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (message?.type !== 'OPEN_PROPERTY_SITES') {
    return;
  }

  const selectedIds = new Set(message.siteIds ?? []);
  const selectedSites = PROPERTY_SITES.filter((site) => selectedIds.has(site.id));

  if (selectedSites.length === 0) {
    sendResponse({ ok: false, error: 'Select at least one website.' });
    return;
  }

  const query = String(message.query ?? '').trim();
  const slug = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const ninetyNineAcresSearchUrl =
    `https://www.99acres.com/search/property/buy/${slug}` +
    `?city=1171166&keyword=${encodeURIComponent(query)}&preference=S&res_com=R`;

  Promise.allSettled(
    selectedSites.map((site) =>
      chrome.tabs.create({
        url: site.id === '99acres' && query ? ninetyNineAcresSearchUrl : site.homepage,
        active: false,
      }),
    ),
  ).then((outcomes) => {
    const opened = outcomes.filter((item) => item.status === 'fulfilled').length;
    const failed = outcomes.length - opened;

    sendResponse({ ok: true, opened, failed });
  });

  return true;
});
