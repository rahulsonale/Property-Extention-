import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

declare const chrome: any;

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  sites: Array<{
    id: string;
    name: string;
    homepage: string;
  }> = [];

  selectedSiteIds: string[] = [];

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
      }) => {
        this.sites = response?.sites ?? [];

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

    chrome.runtime.sendMessage(
      {
        type: 'OPEN_PROPERTY_SITES',
        query,
        siteIds: this.selectedSiteIds,
      },
      (response: { ok?: boolean; opened?: number; failed?: number; error?: string }) => {
        const runtimeError = chrome.runtime.lastError;

        if (runtimeError || !response?.ok) {
          this.error = response?.error ?? runtimeError?.message ?? 'Could not open the sites.';
        } else {
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
