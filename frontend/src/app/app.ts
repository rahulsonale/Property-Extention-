import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

declare const chrome: any;

type SavedSnapshot = {
  siteId: string;
  title: string;
  url: string;
  capturedAt: string;
  image: string;
};

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  isExtension = false;

  sites: Array<{
    id: string;
    name: string;
    homepage: string;
  }> = [];

  private dashboardPollTimer = 0;
  selectedSiteIds: string[] = [];
  siteTabs: Array<{ siteId: string; tabId: number; url: string; query?: string }> = [];
  snapshots: Record<string, SavedSnapshot> = {};
  snapshotLoadingSiteIds: string[] = [];
  snapshotErrors: Record<string, string> = {};
  rememberedPageMessages: Record<string, string> = {};

  manualRates: Partial<Record<string, string>> = {};
  query = '';
  loading = false;
  error = '';

  results: Array<{
    website: string;
    url: string;
    propertyName?: string;
    projectId?: string | number;
    configurations?: Array<{
      configuration?: string;
      area?: string | null;
      areaType?: string | null;
      prices?: Record<
        string,
        { display?: string | null; min?: number | null; max?: number | null } | null
      >;
    }>;
    sourceTabId?: number;
    receivedAt?: number;
  }> = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.isExtension = location.protocol === 'chrome-extension:';

    try {
      const savedRates = localStorage.getItem('propertyManualRates');
      this.manualRates = savedRates ? JSON.parse(savedRates) : {};
    } catch {
      this.manualRates = {};
    }

    void this.refreshDashboardResults();
    this.dashboardPollTimer = window.setInterval(() => {
      void this.refreshDashboardResults();
    }, 3000);

    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      this.error = 'Open the installed extension to select websites.';
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'GET_PROPERTY_SITES' },
      (response: {
        sites?: Array<{
          id: string;
          name: string;
          homepage: string;
        }>;
        siteTabs?: App['siteTabs'];
      }) => {
        this.sites = response?.sites ?? [];
        this.siteTabs = response?.siteTabs ?? [];

        this.selectedSiteIds = this.sites.map((site) => site.id);

        this.cdr.markForCheck();
      },
    );

    chrome.runtime.sendMessage(
      { type: 'GET_PROPERTY_RESULTS' },
      (response: { results?: App['results'] }) => {
        if (!chrome.runtime.lastError) this.results = response?.results ?? [];
        this.cdr.markForCheck();
      },
    );

    chrome.runtime.onMessage.addListener(
      (message: { type?: string; data?: App['results'][number] }) => {
        if (message?.type === 'PROPERTY_DATA' && message.data) {
          this.results = [
            message.data,
            ...this.results.filter((item) => item.url !== message.data?.url),
          ];
          this.cdr.markForCheck();
        }
      },
    );

    void this.loadSavedSnapshots();
  }

  ngOnDestroy(): void {
    window.clearInterval(this.dashboardPollTimer);
  }

  private async refreshDashboardResults(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3000/api/results');

      if (!response.ok) return;

      const payload: { results?: App['results'] } = await response.json();
      this.results = payload.results ?? [];
      this.cdr.markForCheck();
    } catch {
      // Keep the current results if the local backend is temporarily unavailable.
    }
  }

  saveManualRate(siteId: string, value: string): void {
    this.manualRates = { ...this.manualRates, [siteId]: value };
    localStorage.setItem('propertyManualRates', JSON.stringify(this.manualRates));
  }

  toggleSite(siteId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.selectedSiteIds = checked
      ? [...new Set([...this.selectedSiteIds, siteId])]
      : this.selectedSiteIds.filter((id) => id !== siteId);
  }

  openSites(): void {
    const query = this.query.trim();

    if (!query) {
      this.error = 'Enter a property name or details first.';
      return;
    }

    if (this.selectedSiteIds.length === 0) {
      this.error = 'Select at least one website.';
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      this.error = 'Open the installed extension to use this feature.';
      return;
    }

    this.error = '';
    this.results = [];

    chrome.runtime.sendMessage(
      {
        type: 'OPEN_PROPERTY_SITES',
        query,
        siteIds: this.selectedSiteIds,
      },
      (response: {
        ok?: boolean;
        opened?: number;
        failed?: number;
        error?: string;
        siteTabs?: App['siteTabs'];
      }) => {
        const runtimeError = chrome.runtime.lastError;

        if (runtimeError || !response?.ok) {
          this.error = response?.error ?? runtimeError?.message ?? 'Could not open the sites.';
        } else {
          this.siteTabs = response.siteTabs ?? [];
          this.error = `Opened ${response.opened} site tab(s). Search for "${query}" on each site for now.`;
        }

        this.cdr.markForCheck();
      },
    );
  }

  async search(): Promise<void> {
    const query = this.query.trim();

    if (!query || this.loading) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.results = [];

    try {
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`);
      }

      const result = await response.json();

      this.results = result.results ?? [];
    } catch {
      this.error = 'Could not reach the search API. Check that the backend is running.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private openSnapshotDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('property-rate-finder', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'siteId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveSnapshot(snapshot: SavedSnapshot): Promise<void> {
    const db = await this.openSnapshotDb();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put(snapshot);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }

  private async loadSavedSnapshots(): Promise<void> {
    let db: IDBDatabase | undefined;

    try {
      db = await this.openSnapshotDb();
      const snapshots = await new Promise<SavedSnapshot[]>((resolve, reject) => {
        const request = db!.transaction('snapshots', 'readonly').objectStore('snapshots').getAll();

        request.onsuccess = () => resolve(request.result as SavedSnapshot[]);
        request.onerror = () => reject(request.error);
      });

      this.snapshots = Object.fromEntries(snapshots.map((item) => [item.siteId, item]));
    } catch {
      this.error = 'Could not load saved screenshots.';
    } finally {
      db?.close();
      this.cdr.markForCheck();
    }
  }

  private stampScreenshot(imageData: string, url: string, capturedAt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight + 72;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not prepare the screenshot.'));
          return;
        }

        context.drawImage(image, 0, 0);
        context.fillStyle = '#0f172a';
        context.fillRect(0, image.naturalHeight, canvas.width, 72);
        context.fillStyle = '#ffffff';
        context.font = '14px Arial';
        context.fillText(`Captured: ${capturedAt}`, 16, image.naturalHeight + 24);
        context.font = '12px Arial';
        context.fillText(url, 16, image.naturalHeight + 50, canvas.width - 32);

        resolve(canvas.toDataURL('image/png'));
      };

      image.onerror = () => reject(new Error('Could not read the captured image.'));
      image.src = imageData;
    });
  }

  takeSnapshot(siteId: string): void {
    const siteTab = this.siteTabs.find((item) => item.siteId === siteId);

    if (!siteTab) {
      this.snapshotErrors[siteId] = 'Search this site first.';
      return;
    }

    this.snapshotLoadingSiteIds = [...this.snapshotLoadingSiteIds, siteId];
    delete this.snapshotErrors[siteId];

    chrome.runtime.sendMessage(
      { type: 'CAPTURE_SITE_TAB', tabId: siteTab.tabId },
      async (response: {
        ok?: boolean;
        image?: string;
        url?: string;
        title?: string;
        capturedAt?: string;
        error?: string;
      }) => {
        try {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError || !response?.ok || !response.image) {
            throw new Error(response?.error ?? runtimeError?.message ?? 'Screenshot failed.');
          }

          const capturedAt = new Date(response.capturedAt ?? Date.now()).toLocaleString();
          const url = response.url ?? siteTab.url;
          const snapshot: SavedSnapshot = {
            siteId,
            title: response.title ?? siteId,
            url,
            capturedAt,
            image: await this.stampScreenshot(response.image, url, capturedAt),
          };

          await this.saveSnapshot(snapshot);
          this.snapshots = { ...this.snapshots, [siteId]: snapshot };
        } catch (error) {
          this.snapshotErrors[siteId] =
            error instanceof Error ? error.message : 'Screenshot failed.';
        } finally {
          this.snapshotLoadingSiteIds = this.snapshotLoadingSiteIds.filter((id) => id !== siteId);
          this.cdr.markForCheck();
        }
      },
    );
  }

  rememberCurrentSitePage(tab: { siteId: string; tabId: number; query?: string }): void {
    if (!tab.query) {
      this.rememberedPageMessages[tab.siteId] =
        'Run a search first, then save its corrected results page.';
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'SAVE_CONFIRMED_SITE_PAGE',
        siteId: tab.siteId,
        tabId: tab.tabId,
        query: tab.query,
      },
      (response: { ok?: boolean; error?: string }) => {
        const runtimeError = chrome.runtime.lastError;
        this.rememberedPageMessages[tab.siteId] = response?.ok
          ? `Saved this 99acres results page for “${tab.query}”. Future searches for the same query will use it.`
          : (response?.error ?? runtimeError?.message ?? 'Could not save this results page.');
        this.cdr.markForCheck();
      },
    );
  }

  formatJson(data: Record<string, unknown>): string {
    return JSON.stringify(data, null, 2);
  }

  priceLabel(
    price: { display?: string | null; min?: number | null; max?: number | null } | null | undefined,
  ): string {
    if (!price) return '—';
    if (price.display) return price.display;
    if (price.min != null && price.max != null)
      return price.min === price.max ? String(price.min) : `${price.min}–${price.max}`;
    return price.min != null ? String(price.min) : price.max != null ? String(price.max) : '—';
  }
}
