const PROPERTY_SITES = [
  { id: '99acres', name: '99acres', homepage: 'https://www.99acres.com/' },
  { id: 'magicbricks', name: 'Magicbricks', homepage: 'https://www.magicbricks.com/' },
  { id: 'housing', name: 'Housing.com', homepage: 'https://housing.com/' },
];

const PROPERTY_SITE_HOSTS = {
  '99acres': ['99acres.com', 'www.99acres.com'],
  magicbricks: ['magicbricks.com', 'www.magicbricks.com'],
  housing: ['housing.com', 'www.housing.com'],
};

const normalizeQuery = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const getStorage = (area, defaults) => new Promise((resolve) => area.get(defaults, resolve));

const setStorage = (area, values) =>
  new Promise((resolve, reject) => {
    area.set(values, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });

async function captureSiteTab(tabId) {
  const targetTab = await chrome.tabs.get(tabId);
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: targetTab.windowId });

  try {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const currentTab = await chrome.tabs.get(tabId);
    const image = await chrome.tabs.captureVisibleTab(targetTab.windowId, { format: 'png' });

    return {
      image,
      url: currentTab.url ?? targetTab.url ?? '',
      title: currentTab.title ?? targetTab.title ?? '',
      capturedAt: new Date().toISOString(),
    };
  } finally {
    if (activeTab?.id != null && activeTab.id !== tabId) {
      await chrome.tabs.update(activeTab.id, { active: true }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.tabs.onRemoved.addListener((closedTabId) => {
  chrome.storage.local.get({ siteTabs: [] }, ({ siteTabs }) => {
    const currentTabs = Array.isArray(siteTabs) ? siteTabs : [];
    const remainingTabs = currentTabs.filter((item) => item.tabId !== closedTabId);
    if (remainingTabs.length !== currentTabs.length) {
      chrome.storage.local.set({ siteTabs: remainingTabs });
    }
  });
});

async function sendResultToDashboard(data) {
  const response = await fetch('http://localhost:3000/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Dashboard sync failed (${response.status}).`);
}

async function clearDashboardResults() {
  try {
    const response = await fetch('http://localhost:3000/api/results', { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Dashboard clear failed (${response.status}).`);
    }
  } catch (error) {
    console.warn('[Property Search Assistant] Could not clear previous dashboard results:', error);
  }
}

async function handleMessage(message, sender) {
  if (message?.type === 'GET_PROPERTY_SITES') {
    const { siteTabs = [] } = await getStorage(chrome.storage.local, { siteTabs: [] });
    return { sites: PROPERTY_SITES, siteTabs: Array.isArray(siteTabs) ? siteTabs : [] };
  }

  if (message?.type === 'GET_PROPERTY_RESULTS') {
    const { propertyResults = [] } = await getStorage(chrome.storage.local, {
      propertyResults: [],
    });
    return { results: Array.isArray(propertyResults) ? propertyResults : [] };
  }

  if (message?.type === 'SAVE_CONFIRMED_SITE_PAGE') {
    const siteId = String(message.siteId ?? '');
    const query = normalizeQuery(message.query);
    const tabId = Number(message.tabId);

    if (!PROPERTY_SITE_HOSTS[siteId] || !query || !Number.isInteger(tabId)) {
      throw new Error('Choose a supported site tab and enter the search query first.');
    }

    const tab = await chrome.tabs.get(tabId);
    const pageUrl = new URL(tab.url ?? '');

    if (!PROPERTY_SITE_HOSTS[siteId].includes(pageUrl.hostname)) {
      const siteName = PROPERTY_SITES.find((site) => site.id === siteId)?.name ?? siteId;
      throw new Error(`The selected tab is not a ${siteName} page.`);
    }

    const { confirmedSearchPages = [] } = await getStorage(chrome.storage.local, {
      confirmedSearchPages: [],
    });
    const savedPages = Array.isArray(confirmedSearchPages) ? confirmedSearchPages : [];
    const savedPage = {
      siteId,
      query,
      url: pageUrl.href,
      savedAt: Date.now(),
    };
    const next = [
      savedPage,
      ...savedPages.filter((item) => !(item.siteId === siteId && item.query === query)),
    ].slice(0, 100);

    await setStorage(chrome.storage.local, { confirmedSearchPages: next });
    return { ok: true, savedPage };
  }

  if (message?.type === 'CAPTURE_SITE_TAB') {
    const tabId = Number(message.tabId);

    try {
      return { ok: true, ...(await captureSiteTab(tabId)) };
    } catch (error) {
      const closed = /No tab with id/i.test(error?.message ?? '');

      if (closed) {
        const { siteTabs = [] } = await getStorage(chrome.storage.local, { siteTabs: [] });
        await setStorage(chrome.storage.local, {
          siteTabs: (Array.isArray(siteTabs) ? siteTabs : []).filter(
            (item) => item.tabId !== tabId,
          ),
        });
      }

      throw new Error(
        closed
          ? 'This site tab was closed. Search again to open a fresh tab before taking a snapshot.'
          : (error?.message ?? 'Could not capture this site tab.'),
      );
    }
  }

  if (message?.type === 'PROPERTY_DATA' && message.data) {
    const { propertyResults = [] } = await getStorage(chrome.storage.local, {
      propertyResults: [],
    });
    const sourceTabId = sender.tab?.id;
    const savedData = { ...message.data, sourceTabId, receivedAt: Date.now() };
    const next = [
      savedData,
      ...(Array.isArray(propertyResults) ? propertyResults : []).filter(
        (item) => !(item.url === savedData.url && item.sourceTabId === sourceTabId),
      ),
    ].slice(0, 50);

    await setStorage(chrome.storage.local, { propertyResults: next });

    try {
      await sendResultToDashboard(savedData);
      return { ok: true, dashboardSynced: true };
    } catch (error) {
      console.warn('[Property Search Assistant] Could not sync result to dashboard:', error);
      return { ok: true, dashboardSynced: false };
    }
  }

  if (message?.type === 'OPEN_PROPERTY_SITES') {
    const query = String(message.query ?? '').trim();
    if (!query) throw new Error('Enter a property name or details first.');

    const requestedIds = new Set(message.siteIds ?? []);
    const selectedSites = PROPERTY_SITES.filter((site) => requestedIds.has(site.id));
    if (!selectedSites.length) throw new Error('Select at least one website.');

    const slug = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const fallback99acresUrl =
      `https://www.99acres.com/search/property/buy/${slug}` +
      `?city=1171166&keyword=${encodeURIComponent(query)}&preference=S&res_com=R`;

    const queryKey = normalizeQuery(query);
    const { confirmedSearchPages = [] } = await getStorage(chrome.storage.local, {
      confirmedSearchPages: [],
    });
    const confirmedPages = Array.isArray(confirmedSearchPages) ? confirmedSearchPages : [];

    await clearDashboardResults();
    await setStorage(chrome.storage.local, { propertyResults: [], siteTabs: [] });

    const outcomes = await Promise.allSettled(
      selectedSites.map((site) => {
        const rememberedPage = confirmedPages.find(
          (item) => item.siteId === site.id && item.query === queryKey,
        );
        const url =
          rememberedPage?.url ?? (site.id === '99acres' ? fallback99acresUrl : site.homepage);

        return chrome.tabs.create({ url, active: false });
      }),
    );

    const siteTabs = outcomes.flatMap((outcome, index) => {
      if (outcome.status !== 'fulfilled' || outcome.value.id == null) return [];

      return [
        {
          siteId: selectedSites[index].id,
          tabId: outcome.value.id,
          url: outcome.value.url ?? selectedSites[index].homepage,
          query,
        },
      ];
    });

    await setStorage(chrome.storage.local, { siteTabs });

    return {
      ok: true,
      opened: siteTabs.length,
      failed: outcomes.length - siteTabs.length,
      siteTabs,
    };
  }

  return undefined;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({ ok: false, error: error?.message ?? 'Extension request failed.' }),
    );
  return true;
});
