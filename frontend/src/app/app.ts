import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor(private cdr: ChangeDetectorRef) {}
  query = '';
  loading = false;
  error = '';
  results: Array<{
    website: string;
    url: string;
    status: string;
    data: Record<string, unknown>;
  }> = [];

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
        headers: { 'Content-Type': 'application/json' },
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
}
