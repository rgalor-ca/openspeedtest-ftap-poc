import { Component, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cellularOutline,
  playOutline,
  refreshOutline,
  saveOutline,
  serverOutline,
  speedometerOutline,
  stopCircleOutline,
} from 'ionicons/icons';

const SERVER_STORAGE_KEY = 'openspeedtest-server-url';
const LOCAL_NETWORK_SERVER_URL = 'http://192.168.0.13:3000';
const ANDROID_EMULATOR_SERVER_URL = 'http://10.0.2.2:3000';
const MIN_STARTING_STATUS_MS = 5000;

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
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly serverUrl = signal(getInitialServerUrl());
  readonly activeTestUrl = signal('');
  readonly notice = signal('FTAP OpenSpeedTest POC server expected.');
  readonly noticeTone = signal<'medium' | 'success' | 'danger'>('medium');
  readonly testStatus = signal<'idle' | 'starting' | 'loading' | 'loaded' | 'error'>('idle');

  readonly trustedTestUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.activeTestUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  readonly testStatusLabel = computed(() => {
    switch (this.testStatus()) {
      case 'starting':
        return 'Starting speed test now';
      case 'loading':
        return 'Loading FTAP OpenSpeedTest POC';
      case 'loaded':
        return 'Speed test loaded';
      case 'error':
        return 'Speed test did not load';
      default:
        return 'No active test';
    }
  });
  readonly isTestLoading = computed(
    () => this.testStatus() === 'starting' || this.testStatus() === 'loading',
  );
  readonly startButtonLabel = computed(() =>
    this.testStatus() === 'idle' || this.testStatus() === 'error' ? 'Start test' : 'Restart test',
  );

  private loadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private statusTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private testStartedAt = 0;

  constructor(private readonly sanitizer: DomSanitizer) {
    addIcons({
      cellularOutline,
      playOutline,
      refreshOutline,
      saveOutline,
      serverOutline,
      speedometerOutline,
      stopCircleOutline,
    });
  }

  onServerUrlInput(event: Event): void {
    const detail = (event as CustomEvent<{ value?: string | number | null }>).detail;
    this.serverUrl.set(String(detail.value ?? ''));
  }

  startTest(): void {
    const testUrl = this.createOpenSpeedTestUrl();

    if (!testUrl) {
      this.noticeTone.set('danger');
      this.notice.set('Enter a valid FTAP OpenSpeedTest POC server URL that starts with http:// or https://.');
      this.testStatus.set('error');
      return;
    }

    this.clearLoadTimeout();
    this.clearStatusTransitionTimeout();
    this.testStartedAt = Date.now();
    this.testStatus.set('starting');
    this.activeTestUrl.set('');
    this.noticeTone.set('medium');
    this.notice.set('Starting speed test now.');
    this.statusTransitionTimeoutId = setTimeout(() => {
      if (this.testStatus() === 'starting') {
        this.testStatus.set('loading');
        this.notice.set('Loading FTAP OpenSpeedTest POC.');
        this.activeTestUrl.set(testUrl);
      }
    }, 1200);
    this.loadTimeoutId = setTimeout(() => {
      if (this.testStatus() === 'starting' || this.testStatus() === 'loading') {
        this.testStatus.set('error');
        this.noticeTone.set('danger');
        this.notice.set('FTAP OpenSpeedTest POC did not finish loading. Check the server URL and network access.');
      }
    }, 12000);
  }

  reloadTest(): void {
    const url = this.activeTestUrl();

    if (!url) {
      return;
    }

    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set('_reload', Date.now().toString());
    this.clearLoadTimeout();
    this.clearStatusTransitionTimeout();
    this.testStartedAt = Date.now();
    this.testStatus.set('loading');
    this.noticeTone.set('medium');
    this.notice.set('Reloading speed test.');
    this.loadTimeoutId = setTimeout(() => {
      if (this.testStatus() === 'loading') {
        this.testStatus.set('error');
        this.noticeTone.set('danger');
        this.notice.set('FTAP OpenSpeedTest POC did not finish reloading. Check the server URL and network access.');
      }
    }, 12000);
    this.activeTestUrl.set(parsedUrl.toString());
  }

  saveServer(): void {
    const normalizedUrl = this.normalizeServerUrl();

    if (!normalizedUrl) {
      this.noticeTone.set('danger');
      this.notice.set('Server URL was not saved because it is not a valid http:// or https:// URL.');
      return;
    }

    localStorage.setItem(SERVER_STORAGE_KEY, normalizedUrl);
    this.serverUrl.set(normalizedUrl);
    this.noticeTone.set('success');
    this.notice.set('Server URL saved on this device.');
  }

  stopTest(): void {
    this.clearLoadTimeout();
    this.clearStatusTransitionTimeout();
    this.activeTestUrl.set('');
    this.testStatus.set('idle');
    this.noticeTone.set('medium');
    this.notice.set('Test stopped.');
  }

  onTestFrameLoad(): void {
    if (this.testStatus() !== 'starting' && this.testStatus() !== 'loading') {
      return;
    }

    const elapsedMs = Date.now() - this.testStartedAt;
    const finishLoad = () => {
      this.clearLoadTimeout();
      this.clearStatusTransitionTimeout();
      this.testStatus.set('loaded');
      this.noticeTone.set('success');
      this.notice.set('FTAP OpenSpeedTest POC loaded. Basic speed test is running.');
    };

    if (this.testStatus() === 'starting' && elapsedMs < MIN_STARTING_STATUS_MS) {
      this.clearStatusTransitionTimeout();
      this.statusTransitionTimeoutId = setTimeout(finishLoad, MIN_STARTING_STATUS_MS - elapsedMs);
      return;
    }

    finishLoad();
  }

  private createOpenSpeedTestUrl(): string | null {
    const normalizedUrl = this.normalizeServerUrl();

    if (!normalizedUrl) {
      return null;
    }

    const testUrl = new URL(normalizedUrl);
    testUrl.searchParams.set('Run', '');
    testUrl.searchParams.set('_t', Date.now().toString());
    return testUrl.toString();
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

  private clearLoadTimeout(): void {
    if (!this.loadTimeoutId) {
      return;
    }

    clearTimeout(this.loadTimeoutId);
    this.loadTimeoutId = null;
  }

  private clearStatusTransitionTimeout(): void {
    if (!this.statusTransitionTimeoutId) {
      return;
    }

    clearTimeout(this.statusTransitionTimeoutId);
    this.statusTransitionTimeoutId = null;
  }
}

function getInitialServerUrl(): string {
  const savedUrl = localStorage.getItem(SERVER_STORAGE_KEY);

  if (Capacitor.getPlatform() === 'android' && (!savedUrl || savedUrl === LOCAL_NETWORK_SERVER_URL)) {
    return ANDROID_EMULATOR_SERVER_URL;
  }

  return savedUrl ?? LOCAL_NETWORK_SERVER_URL;
}
