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

  if (message?.type !== 'OPEN_PROPERTY_SITES') {
    return;
  }

  const selectedIds = new Set(message.siteIds ?? []);
  const selectedSites = PROPERTY_SITES.filter((site) => selectedIds.has(site.id));

  if (selectedSites.length === 0) {
    sendResponse({ ok: false, error: 'Select at least one website.' });
    return;
  }

  Promise.allSettled(
    selectedSites.map((site) =>
      chrome.tabs.create({
        url: site.homepage,
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
