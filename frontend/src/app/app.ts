import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
  protected readonly showChrome = signal(true);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authSyncStorageKey = 'barberia.auth.sync';

  constructor(private readonly authService: AuthService, private readonly router: Router) {
    if (isPlatformBrowser(this.platformId)) {
      this.authService.loadSession().subscribe();
      globalThis.addEventListener('focus', this.handleWindowFocus);
      globalThis.addEventListener('storage', this.handleStorageSync);
    }

    this.showChrome.set(!this.shouldHideChrome(this.router.url));

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.showChrome.set(!this.shouldHideChrome(event.urlAfterRedirects));
        this.broadcastAuthEvent(event.urlAfterRedirects);
      });
  }

  private shouldHideChrome(url: string): boolean {
    const path = this.extractPath(url);
    return path === '/login' || path === '/registro' || path.startsWith('/admin');
  }

  private extractPath(url: string): string {
    return (url.split('?')[0] || '').split('#')[0] || '/';
  }

  private readonly handleWindowFocus = () => {
    this.authService.loadSession(true).subscribe();
  };

  private readonly handleStorageSync = (event: StorageEvent) => {
    if (event.key !== this.authSyncStorageKey) {
      return;
    }

    this.authService.loadSession(true).subscribe();
  };

  private broadcastAuthEvent(url: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) {
      return;
    }

    const params = new URLSearchParams(url.slice(queryIndex + 1));
    const isSecurityLogoutDone = params.get('security') === 'done';
    const isVerifiedSuccess = params.get('verified') === '1';

    if (!isSecurityLogoutDone && !isVerifiedSuccess) {
      return;
    }

    globalThis.localStorage.setItem(this.authSyncStorageKey, String(Date.now()));
  }
}
