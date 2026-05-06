import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import {
  IonApp,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowDownCircleOutline,
  arrowUpCircleOutline,
  checkmarkCircleOutline,
  closeOutline,
  flashOutline,
  globeOutline,
  linkOutline,
  moonOutline,
  personCircleOutline,
  refreshOutline,
  saveOutline,
  settingsOutline,
  sunnyOutline,
} from 'ionicons/icons';

const SERVER_STORAGE_KEY = 'openspeedtest-server-url';
const THEME_STORAGE_KEY = 'ftap-theme-mode';
const RESULTS_STORAGE_KEY = 'ftap-speed-results';
const LOCAL_NETWORK_SERVER_URL = 'http://192.168.0.13:3000';
const ANDROID_EMULATOR_SERVER_URL = 'http://10.0.2.2:3000';
const GITHUB_PAGES_HOST = 'rgalor-ca.github.io';
const DOWNLOAD_DURATION_MS = 6500;
const UPLOAD_DURATION_MS = 6500;
const GAUGE_RESET_MS = 720;
const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;

type ThemeMode = 'dark' | 'light';
type TestPhase =
  | 'idle'
  | 'ping'
  | 'download'
  | 'download-reset'
  | 'upload'
  | 'upload-reset'
  | 'complete'
  | 'error'
  | 'stopped';
type HistoryMetric = 'download' | 'upload';

interface SpeedResult {
  id: string;
  createdAt: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  serverHost: string;
  serverUrl: string;
}

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    IonApp,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly serverUrl = signal(getInitialServerUrl());
  readonly notice = signal('Ready to run a basic OpenSpeedTest-powered check.');
  readonly noticeTone = signal<'medium' | 'success' | 'danger'>('medium');
  readonly testPhase = signal<TestPhase>('idle');
  readonly historyMetric = signal<HistoryMetric>('download');
  readonly themeMode = signal<ThemeMode>(getInitialThemeMode());
  readonly showSettingsModal = signal(false);
  readonly showResultsModal = signal(false);
  readonly results = signal<SpeedResult[]>(getStoredResults());
  readonly downloadMbps = signal<number | null>(null);
  readonly uploadMbps = signal<number | null>(null);
  readonly pingMs = signal<number | null>(null);
  readonly jitterMs = signal<number | null>(null);
  readonly currentMbps = signal<number | null>(null);
  readonly phaseProgress = signal(0);
  readonly resultId = signal(generateResultId());

  readonly isRunning = computed(() =>
    ['ping', 'download', 'download-reset', 'upload', 'upload-reset'].includes(this.testPhase()),
  );
  readonly isUploadPhase = computed(() =>
    ['upload', 'upload-reset'].includes(this.testPhase()),
  );
  readonly isDarkMode = computed(() => this.themeMode() === 'dark');
  readonly themeIcon = computed(() => (this.isDarkMode() ? 'sunny-outline' : 'moon-outline'));
  readonly themeButtonLabel = computed(() =>
    this.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode',
  );
  readonly serverHost = computed(() => {
    try {
      return new URL(this.serverUrl()).host;
    } catch {
      return 'Server not set';
    }
  });
  readonly phaseLabel = computed(() => {
    switch (this.testPhase()) {
      case 'ping':
        return 'Checking ping';
      case 'download':
        return 'Testing download';
      case 'download-reset':
        return 'Preparing upload';
      case 'upload':
        return 'Testing upload';
      case 'upload-reset':
        return 'Finalizing result';
      case 'complete':
        return 'Results';
      case 'error':
        return 'Unable to test';
      case 'stopped':
        return 'Stopped';
      default:
        return 'Ready';
    }
  });
  readonly primaryMetric = computed(() => {
    if (this.isUploadPhase()) {
      return this.currentMbps() ?? this.uploadMbps();
    }

    if (this.testPhase() === 'complete') {
      return this.downloadMbps();
    }

    return this.currentMbps() ?? this.downloadMbps();
  });
  readonly gaugeProgress = computed(() => `${Math.min(this.speedToGauge(this.primaryMetric()), 270)}deg`);
  readonly needleAngle = computed(() => `${-135 + Math.min(this.speedToGauge(this.primaryMetric()), 270)}deg`);
  readonly progressWidth = computed(() => `${Math.round(this.phaseProgress() * 100)}%`);
  readonly accentColor = computed(() => (this.isUploadPhase() ? '#bf69ff' : '#22e6e1'));
  readonly activeMetricLabel = computed(() => (this.isUploadPhase() ? 'Upload' : 'Download'));
  readonly buttonLabel = computed(() => (this.isRunning() ? 'STOP' : 'GO'));
  readonly latestResult = computed(() => this.results()[0] ?? null);
  readonly historyRows = computed(() => this.results().slice(0, 4));
  readonly chartResults = computed(() => this.results().slice(0, 6).reverse());
  readonly historyPeak = computed(() => {
    const values = this.chartResults().map((result) =>
      this.historyMetric() === 'upload' ? result.uploadMbps : result.downloadMbps,
    );

    return Math.max(100, ...values);
  });
  readonly historyPeakLabel = computed(() => Math.round(this.historyPeak()).toString());
  readonly historyMidLabel = computed(() => Math.round(this.historyPeak() / 2).toString());

  private abortController: AbortController | null = null;
  private stopRequested = false;

  constructor() {
    addIcons({
      arrowDownCircleOutline,
      arrowUpCircleOutline,
      checkmarkCircleOutline,
      closeOutline,
      flashOutline,
      globeOutline,
      linkOutline,
      moonOutline,
      personCircleOutline,
      refreshOutline,
      saveOutline,
      settingsOutline,
      sunnyOutline,
    });

    effect(() => {
      const theme = this.themeMode();
      document.documentElement.dataset['theme'] = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    });
  }

  onServerUrlInput(event: Event): void {
    const detail = (event as CustomEvent<{ value?: string | number | null }>).detail;
    this.serverUrl.set(String(detail.value ?? ''));
  }

  async handleGoButton(): Promise<void> {
    if (this.isRunning()) {
      this.stopTest();
      return;
    }

    await this.startTest();
  }

  async startTest(): Promise<void> {
    this.closeModals();
    const normalizedUrl = this.normalizeServerUrl();

    if (!normalizedUrl) {
      this.testPhase.set('error');
      this.noticeTone.set('danger');
      this.notice.set('Enter a valid OpenSpeedTest server URL that starts with http:// or https://.');
      return;
    }

    if (isBlockedMixedContent(normalizedUrl)) {
      this.testPhase.set('error');
      this.noticeTone.set('danger');
      this.notice.set('This HTTPS page requires an HTTPS OpenSpeedTest server URL.');
      return;
    }

    this.resetRunState();
    this.serverUrl.set(normalizedUrl);
    localStorage.setItem(SERVER_STORAGE_KEY, normalizedUrl);
    this.abortController = new AbortController();
    this.stopRequested = false;

    try {
      this.testPhase.set('ping');
      this.noticeTone.set('medium');
      this.notice.set('Pinging the OpenSpeedTest server.');
      const latency = await this.measurePing(normalizedUrl, this.abortController.signal);
      this.pingMs.set(latency.ping);
      this.jitterMs.set(latency.jitter);

      this.testPhase.set('download');
      this.notice.set('Measuring download using the OpenSpeedTest download endpoint.');
      const download = await this.measureDownload(normalizedUrl, this.abortController.signal);
      this.downloadMbps.set(download);
      await this.resetGaugeBeforeNextPhase('download-reset', 'Preparing upload test.');

      this.testPhase.set('upload');
      this.notice.set('Measuring upload using the OpenSpeedTest upload endpoint.');
      const upload = await this.measureUpload(normalizedUrl, this.abortController.signal);
      this.uploadMbps.set(upload);
      await this.resetGaugeBeforeNextPhase('upload-reset', 'Finalizing result.');

      const completedResult = this.createCompletedResult(normalizedUrl, download, upload, latency);
      this.testPhase.set('complete');
      this.phaseProgress.set(1);
      this.currentMbps.set(null);
      this.resultId.set(completedResult.id);
      this.saveResult(completedResult);
      this.noticeTone.set('success');
      this.notice.set('FTAP OpenSpeedTest POC completed.');
    } catch (error) {
      if (this.stopRequested || this.abortController?.signal.aborted) {
        this.testPhase.set('stopped');
        this.noticeTone.set('medium');
        this.notice.set('Speed test stopped.');
        return;
      }

      this.testPhase.set('error');
      this.currentMbps.set(null);
      this.phaseProgress.set(0);
      this.noticeTone.set('danger');
      this.notice.set(getTestErrorMessage(error));
    } finally {
      this.abortController = null;
      this.stopRequested = false;
    }
  }

  stopTest(): void {
    this.stopRequested = true;
    this.abortController?.abort();
    this.currentMbps.set(null);
    this.phaseProgress.set(0);
    this.testPhase.set('stopped');
    this.noticeTone.set('medium');
    this.notice.set('Speed test stopped.');
  }

  async reloadTest(): Promise<void> {
    await this.startTest();
  }

  saveServer(): void {
    const normalizedUrl = this.normalizeServerUrl();

    if (!normalizedUrl) {
      this.noticeTone.set('danger');
      this.notice.set('Server URL was not saved because it is not a valid http:// or https:// URL.');
      return;
    }

    if (isBlockedMixedContent(normalizedUrl)) {
      this.noticeTone.set('danger');
      this.notice.set('Use an HTTPS OpenSpeedTest server URL when running this app from GitHub Pages.');
      return;
    }

    localStorage.setItem(SERVER_STORAGE_KEY, normalizedUrl);
    this.serverUrl.set(normalizedUrl);
    this.showSettingsModal.set(false);
    this.noticeTone.set('success');
    this.notice.set('Server URL saved on this device.');
  }

  openSettings(): void {
    this.showResultsModal.set(false);
    this.showSettingsModal.set(true);
  }

  openResults(): void {
    this.showSettingsModal.set(false);
    this.showResultsModal.set(true);
  }

  closeModals(): void {
    this.showSettingsModal.set(false);
    this.showResultsModal.set(false);
  }

  setHistoryMetric(metric: HistoryMetric): void {
    this.historyMetric.set(metric);
  }

  toggleTheme(): void {
    this.themeMode.set(this.isDarkMode() ? 'light' : 'dark');
  }

  formatSpeed(value: number | null): string {
    if (value === null) {
      return '---';
    }

    if (value >= 100) {
      return value.toFixed(2);
    }

    if (value >= 10) {
      return value.toFixed(2);
    }

    return value.toFixed(1);
  }

  formatLatency(value: number | null): string {
    return value === null ? '-' : Math.round(value).toString();
  }

  formatResultDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatResultTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatResultTooltip(result: SpeedResult): string {
    const metric = this.historyMetric();
    const speed = metric === 'upload' ? result.uploadMbps : result.downloadMbps;
    return `${this.formatResultDate(result.createdAt)} ${this.formatSpeed(speed)} Mbps`;
  }

  historyPointLeft(index: number): number {
    const points = this.chartResults().length;

    if (points <= 1) {
      return 4;
    }

    return 4 + (index / (points - 1)) * 92;
  }

  historyPointBottom(result: SpeedResult): number {
    const speed = this.historyMetric() === 'upload' ? result.uploadMbps : result.downloadMbps;
    return Math.max(8, Math.min(92, (speed / this.historyPeak()) * 84));
  }

  private async measurePing(baseUrl: string, signal: AbortSignal): Promise<{ ping: number; jitter: number }> {
    const durations: number[] = [];

    for (let index = 0; index < 6; index += 1) {
      const startedAt = performance.now();
      const response = await fetch(this.endpoint(baseUrl, 'upload', `ping=${Date.now()}-${index}`), {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error('OpenSpeedTest ping endpoint did not respond.');
      }

      durations.push(performance.now() - startedAt);
      this.phaseProgress.set((index + 1) / 6);
      await delay(80, signal);
    }

    const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const jitter =
      durations
        .slice(1)
        .reduce((sum, value, index) => sum + Math.abs(value - durations[index]), 0) /
      Math.max(1, durations.length - 1);

    return {
      ping: roundMetric(average),
      jitter: roundMetric(jitter),
    };
  }

  private async measureDownload(baseUrl: string, signal: AbortSignal): Promise<number> {
    const startedAt = performance.now();
    const endAt = startedAt + DOWNLOAD_DURATION_MS;
    let downloadedBytes = 0;
    let lastUiUpdate = 0;

    while (performance.now() < endAt) {
      const response = await fetch(this.endpoint(baseUrl, 'downloading', `download=${Date.now()}`), {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error('OpenSpeedTest download endpoint did not respond.');
      }

      if (!response.body) {
        const payload = await response.arrayBuffer();
        downloadedBytes += payload.byteLength;
        continue;
      }

      const reader = response.body.getReader();

      while (performance.now() < endAt) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        downloadedBytes += value.byteLength;
        const now = performance.now();

        if (now - lastUiUpdate > 120) {
          this.updateSpeedProgress(downloadedBytes, startedAt, now, DOWNLOAD_DURATION_MS);
          lastUiUpdate = now;
        }
      }

      await reader.cancel().catch(() => undefined);
    }

    return this.finalizeSpeed(downloadedBytes, startedAt);
  }

  private async measureUpload(baseUrl: string, signal: AbortSignal): Promise<number> {
    const startedAt = performance.now();
    const endAt = startedAt + UPLOAD_DURATION_MS;
    let uploadedBytes = 0;
    const uploadChunk = new Uint8Array(UPLOAD_CHUNK_BYTES);
    uploadChunk.fill(7);

    while (performance.now() < endAt) {
      const response = await fetch(this.endpoint(baseUrl, 'upload', `upload=${Date.now()}`), {
        body: uploadChunk,
        cache: 'no-store',
        method: 'POST',
        signal,
      });

      if (!response.ok) {
        throw new Error('OpenSpeedTest upload endpoint did not respond.');
      }

      uploadedBytes += uploadChunk.byteLength;
      this.updateSpeedProgress(uploadedBytes, startedAt, performance.now(), UPLOAD_DURATION_MS);
    }

    return this.finalizeSpeed(uploadedBytes, startedAt);
  }

  private updateSpeedProgress(bytes: number, startedAt: number, now: number, durationMs: number): void {
    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.1);
    const mbps = (bytes * 8) / elapsedSeconds / 1_000_000;
    this.currentMbps.set(roundMetric(mbps * 1.04));
    this.phaseProgress.set(Math.min((now - startedAt) / durationMs, 1));
  }

  private async resetGaugeBeforeNextPhase(phase: TestPhase, notice: string): Promise<void> {
    if (!this.abortController) {
      return;
    }

    this.testPhase.set(phase);
    this.notice.set(notice);
    this.currentMbps.set(0);
    this.phaseProgress.set(0);
    await delay(GAUGE_RESET_MS, this.abortController.signal);
  }

  private finalizeSpeed(bytes: number, startedAt: number): number {
    const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.1);
    return roundMetric(((bytes * 8) / elapsedSeconds / 1_000_000) * 1.04);
  }

  private endpoint(baseUrl: string, path: 'downloading' | 'upload', query: string): string {
    return new URL(`${path}?${query}`, `${baseUrl}/`).toString();
  }

  private normalizeServerUrl(): string | null {
    const value = this.serverUrl().trim();

    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }

      url.pathname = url.pathname.replace(/\/+$/, '');
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  private resetRunState(): void {
    this.downloadMbps.set(null);
    this.uploadMbps.set(null);
    this.pingMs.set(null);
    this.jitterMs.set(null);
    this.currentMbps.set(null);
    this.phaseProgress.set(0);
  }

  private speedToGauge(value: number | null): number {
    if (!value || value <= 0) {
      return 0;
    }

    const normalized = Math.min(Math.log10(value + 1) / Math.log10(1001), 1);
    return normalized * 270;
  }

  private createCompletedResult(
    normalizedUrl: string,
    download: number,
    upload: number,
    latency: { ping: number; jitter: number },
  ): SpeedResult {
    return {
      id: generateResultId(),
      createdAt: new Date().toISOString(),
      downloadMbps: download,
      uploadMbps: upload,
      pingMs: latency.ping,
      jitterMs: latency.jitter,
      serverHost: this.serverHost(),
      serverUrl: normalizedUrl,
    };
  }

  private saveResult(result: SpeedResult): void {
    const nextResults = [result, ...this.results()].slice(0, 20);
    this.results.set(nextResults);
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(nextResults));
  }
}

function getInitialServerUrl(): string {
  const savedUrl = localStorage.getItem(SERVER_STORAGE_KEY);

  if (Capacitor.getPlatform() === 'android' && (!savedUrl || savedUrl === LOCAL_NETWORK_SERVER_URL)) {
    return ANDROID_EMULATOR_SERVER_URL;
  }

  if (!savedUrl && location.hostname === GITHUB_PAGES_HOST) {
    return '';
  }

  return savedUrl ?? LOCAL_NETWORK_SERVER_URL;
}

function getInitialThemeMode(): ThemeMode {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function getStoredResults(): SpeedResult[] {
  try {
    const rawResults = localStorage.getItem(RESULTS_STORAGE_KEY);

    if (!rawResults) {
      return [];
    }

    const parsedResults = JSON.parse(rawResults);

    if (!Array.isArray(parsedResults)) {
      return [];
    }

    return parsedResults
      .filter(isSpeedResult)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 20);
  } catch {
    return [];
  }
}

function isSpeedResult(value: unknown): value is SpeedResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as SpeedResult;
  return (
    typeof result.id === 'string' &&
    typeof result.createdAt === 'string' &&
    typeof result.downloadMbps === 'number' &&
    typeof result.uploadMbps === 'number' &&
    typeof result.pingMs === 'number' &&
    typeof result.jitterMs === 'number' &&
    typeof result.serverHost === 'string' &&
    typeof result.serverUrl === 'string'
  );
}

function isBlockedMixedContent(serverUrl: string): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    location.protocol === 'https:' &&
    new URL(serverUrl).protocol === 'http:'
  );
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateResultId(): string {
  return Math.floor(10_000_000 + Math.random() * 90_000_000).toString();
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function getTestErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'OpenSpeedTest server could not be reached. Check the URL, CORS, HTTPS, and network access.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Speed test failed. Check the OpenSpeedTest server and try again.';
}
