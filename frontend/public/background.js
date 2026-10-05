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

async function captureSiteTab(tabId) {
  const targetTab = await chrome.tabs.get(tabId);
  const [activeTab] = await chrome.tabs.query({
    active: true,
    windowId: targetTab.windowId,
  });

  try {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 700));

    const image = await chrome.tabs.captureVisibleTab(targetTab.windowId, {
      format: 'png',
    });

    return {
      image,
      url: targetTab.url ?? '',
      title: targetTab.title ?? '',
      capturedAt: new Date().toISOString(),
    };
  } finally {
    if (activeTab?.id != null && activeTab.id !== tabId) {
      await chrome.tabs.update(activeTab.id, { active: true }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_PROPERTY_SITES') {
    chrome.storage.local.get({ siteTabs: [] }, ({ siteTabs }) => {
      sendResponse({ sites: PROPERTY_SITES, siteTabs });
    });
    return true;
  }

  if (message?.type === 'GET_PROPERTY_RESULTS') {
    chrome.storage.local.get({ propertyResults: [] }, ({ propertyResults }) => {
      sendResponse({ results: propertyResults });
    });
    return true;
  }

  if (message?.type === 'CAPTURE_SITE_TAB') {
    captureSiteTab(Number(message.tabId))
      .then((snapshot) => sendResponse({ ok: true, ...snapshot }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error?.message ?? 'Could not capture this site tab.',
        }),
      );
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

  if (!query) {
    sendResponse({ ok: false, error: 'Enter a property name or details first.' });
    return;
  }

  chrome.storage.local.set({ propertyResults: [], siteTabs: [] }, () => {
    Promise.allSettled(
      selectedSites.map((site) =>
        chrome.tabs.create({
          url: site.id === '99acres' ? ninetyNineAcresSearchUrl : site.homepage,
          active: false,
        }),
      ),
    ).then((outcomes) => {
      const siteTabs = outcomes.flatMap((outcome, index) => {
        if (outcome.status !== 'fulfilled' || outcome.value.id == null) {
          return [];
        }

        return [
          {
            siteId: selectedSites[index].id,
            tabId: outcome.value.id,
            url: outcome.value.url ?? selectedSites[index].homepage,
          },
        ];
      });

      chrome.storage.local.set({ siteTabs }, () => {
        sendResponse({
          ok: true,
          opened: siteTabs.length,
          failed: outcomes.length - siteTabs.length,
          siteTabs,
        });
      });
    });
  });

  return true;
});
