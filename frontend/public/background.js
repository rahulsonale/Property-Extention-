const PROPERTY_SITES = [
  { id: '99acres', name: '99acres', homepage: 'https://www.99acres.com/' },
  { id: 'magicbricks', name: 'Magicbricks', homepage: 'https://www.magicbricks.com/' },
  { id: 'housing', name: 'Housing.com', homepage: 'https://housing.com/' },
  { id: 'nobroker', name: 'NoBroker', homepage: 'https://www.nobroker.in/' },
  { id: 'squareyards', name: 'SquareYards', homepage: 'https://www.squareyards.com/sale' },
];

const PROPERTY_SITE_HOSTS = {
  '99acres': ['99acres.com', 'www.99acres.com'],
  magicbricks: ['magicbricks.com', 'www.magicbricks.com'],
  housing: ['housing.com', 'www.housing.com'],
  nobroker: ['nobroker.in', 'www.nobroker.in'],
  squareyards: ['squareyards.com', 'www.squareyards.com'],
};

const normalizeQuery = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const slugifyLocation = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const canonicalCitySlug = (value) => {
  const slug = slugifyLocation(value);
  return slug === 'bangalore' ? 'bengaluru' : slug;
};

const parseLocationQuery = (value) => {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const city = parts.pop();
  const locality = parts.join(', ');

  return locality && city ? { locality, city } : null;
};

const buildSiteSearchUrl = (siteId, query) => {
  const location = parseLocationQuery(query);
  if (!location) return null;

  if (siteId === 'magicbricks') {
    const url = new URL('https://www.magicbricks.com/property-for-sale/residential-real-estate');
    url.searchParams.set('Locality', location.locality);
    url.searchParams.set('cityName', location.city);
    return url.href;
  }

  if (siteId === 'housing') {
    const citySlug = canonicalCitySlug(location.city);

    if (!citySlug) return null;

    return `https://housing.com/in/buy/${citySlug}/`;
  }

  if (siteId === 'nobroker') {
    const citySlug = slugifyLocation(location.city).replace(/-/g, '_');

    if (!citySlug) return null;

    return `https://www.nobroker.in/flats-for-sale-in-${citySlug}_${citySlug}`;
  }

  if (siteId === 'squareyards') {
    const citySlug = slugifyLocation(location.city);

    if (!citySlug) return null;

    return `https://www.squareyards.com/sale/property-for-sale-in-${citySlug}`;
  }

  return null;
};

const isValidSavedPage = (siteId, url) => {
  try {
    const pageUrl = new URL(url);
    const supportedHost = PROPERTY_SITE_HOSTS[siteId]?.includes(pageUrl.hostname);

    // Do not treat a plain homepage as a saved search/results page.
    const isPlainHomepage =
      pageUrl.pathname === '/' && pageUrl.search === '' && pageUrl.hash === '';

    return Boolean(supportedHost) && !isPlainHomepage;
  } catch {
    return false;
  }
};

const getStorage = (area, defaults) => new Promise((resolve) => area.get(defaults, resolve));

const setStorage = (area, values) =>
  new Promise((resolve, reject) => {
    area.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

async function captureSiteTab(tabId) {
  const targetTab = await chrome.tabs.get(tabId);
  const [activeTab] = await chrome.tabs.query({
    active: true,
    windowId: targetTab.windowId,
  });

  try {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 700));

    const currentTab = await chrome.tabs.get(tabId);
    const image = await chrome.tabs.captureVisibleTab(targetTab.windowId, {
      format: 'png',
    });

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

let listingCaptureQueue = Promise.resolve();
const listingCaptureOriginalTabs = new Map();
const listingCaptureRestoreTimers = new Map();
const listingCaptureLastAt = new Map();

function captureListingTab(tabId) {
  const capture = listingCaptureQueue.then(async () => {
    const targetTab = await chrome.tabs.get(tabId);
    const windowId = targetTab.windowId;
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });

    if (!listingCaptureOriginalTabs.has(windowId) && activeTab?.id != null) {
      listingCaptureOriginalTabs.set(windowId, activeTab.id);
    }

    if (activeTab?.id !== tabId) {
      await chrome.tabs.update(tabId, { active: true });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const lastCapturedAt = listingCaptureLastAt.get(windowId) ?? 0;
    const waitMs = Math.max(0, 600 - (Date.now() - lastCapturedAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));

    const currentTab = await chrome.tabs.get(tabId);
    const image = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    listingCaptureLastAt.set(windowId, Date.now());

    const previousTimer = listingCaptureRestoreTimers.get(windowId);
    if (previousTimer) clearTimeout(previousTimer);
    const timer = setTimeout(() => {
      const originalTabId = listingCaptureOriginalTabs.get(windowId);
      if (originalTabId != null && originalTabId !== tabId) {
        chrome.tabs.update(originalTabId, { active: true }).catch(() => {});
      }
      listingCaptureOriginalTabs.delete(windowId);
      listingCaptureRestoreTimers.delete(windowId);
    }, 1800);
    listingCaptureRestoreTimers.set(windowId, timer);

    return {
      image,
      url: currentTab.url ?? targetTab.url ?? '',
      title: currentTab.title ?? targetTab.title ?? '',
      capturedAt: new Date().toISOString(),
    };
  });
  listingCaptureQueue = capture.catch(() => {});
  return capture;
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

  if (!response.ok) {
    throw new Error(`Dashboard sync failed (${response.status}).`);
  }
}

async function clearDashboardResults() {
  try {
    const response = await fetch('http://localhost:3000/api/results', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Dashboard clear failed (${response.status}).`);
    }
  } catch (error) {
    console.warn('[Property Search Assistant] Could not clear previous dashboard results:', error);
  }
}

async function sendDashboardProgress(progress) {
  const response = await fetch('http://localhost:3000/api/results/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  });

  if (!response.ok) throw new Error(`Progress update failed (${response.status}).`);
}

async function handleMessage(message, sender) {
  if (message?.type === 'GET_PROPERTY_SITES') {
    const { siteTabs = [] } = await getStorage(chrome.storage.local, {
      siteTabs: [],
    });

    return {
      sites: PROPERTY_SITES,
      siteTabs: Array.isArray(siteTabs) ? siteTabs : [],
    };
  }

  if (message?.type === 'GET_PROPERTY_RESULTS') {
    const { propertyResults = [] } = await getStorage(chrome.storage.local, {
      propertyResults: [],
    });

    return {
      results: Array.isArray(propertyResults) ? propertyResults : [],
    };
  }

  if (message?.type === 'SAVE_CONFIRMED_SITE_PAGE') {
    const siteId = String(message.siteId ?? '');
    const query = normalizeQuery(message.query);
    const tabId = Number(message.tabId);

    if (!PROPERTY_SITE_HOSTS[siteId] || !query || !Number.isInteger(tabId)) {
      throw new Error('Choose a supported site tab and enter the search query first.');
    }

    const tab = await chrome.tabs.get(tabId);
    let pageUrl;

    try {
      pageUrl = new URL(tab.url ?? '');
    } catch {
      throw new Error('The selected tab does not have a valid website URL.');
    }

    if (!PROPERTY_SITE_HOSTS[siteId].includes(pageUrl.hostname)) {
      const siteName = PROPERTY_SITES.find((site) => site.id === siteId)?.name ?? siteId;

      throw new Error(`The selected tab is not a ${siteName} page.`);
    }

    if (!isValidSavedPage(siteId, pageUrl.href)) {
      throw new Error('Open the correct search or listings page on this site before saving it.');
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
      ...savedPages.filter(
        (item) => !(item.siteId === siteId && normalizeQuery(item.query) === query),
      ),
    ].slice(0, 100);

    await setStorage(chrome.storage.local, {
      confirmedSearchPages: next,
    });

    return { ok: true, savedPage };
  }

  if (message?.type === 'CAPTURE_SITE_TAB') {
    const tabId = Number(message.tabId);

    try {
      return {
        ok: true,
        ...(await captureSiteTab(tabId)),
      };
    } catch (error) {
      const closed = /No tab with id/i.test(error?.message ?? '');

      if (closed) {
        const { siteTabs = [] } = await getStorage(chrome.storage.local, {
          siteTabs: [],
        });

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

  if (message?.type === 'CAPTURE_LISTING_VIEWPORT') {
    const tabId = sender.tab?.id;
    if (tabId == null) throw new Error('Could not identify the listing tab.');

    return { ok: true, ...(await captureListingTab(tabId)) };
  }

  if (
    message?.type === 'LISTING_CAPTURE_PROGRESS' &&
    ['housing', 'magicbricks', 'nobroker', 'squareyards'].includes(message.siteId)
  ) {
    const progress = {
      siteId: message.siteId,
      status: message.status,
      current: message.current ?? 0,
      total: message.total ?? 0,
      message: message.message,
    };

    try {
      await sendDashboardProgress(progress);
    } catch (error) {
      console.warn('[Property Search Assistant] Could not update dashboard progress:', error);
    }

    return { ok: true };
  }

  if (message?.type === 'PROPERTY_DATA' && message.data) {
    const { propertyResults = [] } = await getStorage(chrome.storage.local, {
      propertyResults: [],
    });
    const sourceTabId = sender.tab?.id;
    const dashboardData = {
      ...message.data,
      sourceTabId,
      receivedAt: Date.now(),
    };
    const savedData = {
      ...dashboardData,
      listings: Array.isArray(dashboardData.listings)
        ? dashboardData.listings.map(({ evidence, ...listing }) => listing)
        : dashboardData.listings,
    };

    const next = [
      savedData,
      ...(Array.isArray(propertyResults) ? propertyResults : []).filter(
        (item) => !(item.url === savedData.url && item.sourceTabId === sourceTabId),
      ),
    ].slice(0, 50);

    await setStorage(chrome.storage.local, { propertyResults: next });

    try {
      await sendResultToDashboard(dashboardData);
      return { ok: true, dashboardSynced: true };
    } catch (error) {
      console.warn('[Property Search Assistant] Could not sync result to dashboard:', error);

      return { ok: true, dashboardSynced: false };
    }
  }

  if (message?.type === 'OPEN_PROPERTY_SITES') {
    const query = String(message.query ?? '').trim();

    if (!query) {
      throw new Error('Enter a property name or details first.');
    }

    const requestedIds = new Set(message.siteIds ?? []);
    const selectedSites = PROPERTY_SITES.filter((site) => requestedIds.has(site.id));

    if (!selectedSites.length) {
      throw new Error('Select at least one website.');
    }

    const queryKey = normalizeQuery(query);
    const { confirmedSearchPages = [] } = await getStorage(chrome.storage.local, {
      confirmedSearchPages: [],
    });
    const confirmedPages = Array.isArray(confirmedSearchPages)
      ? confirmedSearchPages.filter((item) => isValidSavedPage(item.siteId, item.url))
      : [];

    await clearDashboardResults();
    const progressSite = selectedSites.find((site) =>
      ['housing', 'magicbricks', 'nobroker', 'squareyards'].includes(site.id),
    );

    if (progressSite) {
      await sendDashboardProgress({
        siteId: progressSite.id,
        status: 'waiting',
        current: 0,
        total: 0,
      }).catch((error) =>
        console.warn('[Property Search Assistant] Could not initialize dashboard progress:', error),
      );
    }
    await setStorage(chrome.storage.local, {
      propertyResults: [],
      siteTabs: [],
    });

    const outcomes = await Promise.allSettled(
      selectedSites.map((site) => {
        const rememberedPage = confirmedPages.find(
          (item) => item.siteId === site.id && normalizeQuery(item.query) === queryKey,
        );

        const generatedUrl = buildSiteSearchUrl(site.id, query);
        const url = rememberedPage?.url ?? generatedUrl ?? site.homepage;

        return chrome.tabs.create({ url, active: false });
      }),
    );

    const siteTabs = outcomes.flatMap((outcome, index) => {
      if (outcome.status !== 'fulfilled' || outcome.value.id == null) {
        return [];
      }

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
      sendResponse({
        ok: false,
        error: error?.message ?? 'Extension request failed.',
      }),
    );

  return true;
});
