import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CareNotificationsService } from './care-notifications.service';

interface Session {
  uid: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'petcare-supabase-session';
  private readonly authUrl = `${environment.supabase.url}/auth/v1`;
  private readonly headers = { apikey: environment.supabase.publishableKey };
  private session: Session | null = this.readSession();
  private refreshing: Promise<string> | null = null;
  private generation = 0;

  constructor(
    private http: HttpClient,
    private careNotifications: CareNotificationsService,
  ) {}

  get isLoggedIn(): boolean {
    return !!this.session;
  }
  get uid(): string {
    return this.session?.uid || '';
  }
  get email(): string {
    return this.session?.email || '';
  }
  get firstName(): string {
    return this.email.split('@')[0].split(/[._-]/)[0] || 'pet parent';
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(
        `${this.authUrl}/token?grant_type=password`,
        { email: email.trim(), password },
        { headers: this.headers },
      ),
    );
    this.saveResponse(response);
  }

  async register(email: string, password: string): Promise<void> {
    const settings = await firstValueFrom(
      this.http.get<{ mailer_autoconfirm: boolean }>(`${this.authUrl}/settings`, {
        headers: this.headers,
      }),
    );
    // Demo accounts use made-up addresses, so sign-up must not send verification emails.
    if (!settings.mailer_autoconfirm) {
      throw new Error('Turn off Confirm email in Supabase Authentication to enable demo accounts.');
    }
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(
        `${this.authUrl}/signup`,
        { email: email.trim(), password },
        { headers: this.headers },
      ),
    );
    this.saveResponse(response);
  }

  async logout(): Promise<void> {
    const accessToken = this.session?.accessToken;
    this.clearSession();
    if (accessToken) {
      try {
        await firstValueFrom(
          this.http.post(
            `${this.authUrl}/logout?scope=local`,
            {},
            {
              headers: { ...this.headers, Authorization: `Bearer ${accessToken}` },
            },
          ),
        );
      } catch {
        /* The local session is cleared even when the network is unavailable. */
      }
    }
  }

  async getToken(): Promise<string> {
    if (!this.session) throw new Error('Your session ended. Please log in again.');
    if (this.session.expiresAt > Date.now() + 60000) return this.session.accessToken;
    if (!this.refreshing)
      this.refreshing = this.refreshToken().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async refreshToken(): Promise<string> {
    const generation = this.generation;
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(
          `${this.authUrl}/token?grant_type=refresh_token`,
          { refresh_token: this.session!.refreshToken },
          { headers: this.headers },
        ),
      );
      if (!this.session || generation !== this.generation)
        throw new Error('Your session ended. Please log in again.');
      this.saveResponse(response);
      return this.session.accessToken;
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        [400, 401, 403].includes(error.status) &&
        generation === this.generation
      )
        this.clearSession();
      throw error;
    }
  }

  private clearSession(): void {
    this.generation++;
    this.session = null;
    sessionStorage.removeItem(this.storageKey);
    void this.careNotifications.clear();
  }

  private saveResponse(response: AuthResponse): void {
    if (!response.access_token || !response.refresh_token || !response.user?.id) {
      throw new Error('Sign-in did not return a session. Please try logging in again.');
    }
    this.generation++;
    this.session = {
      uid: response.user.id,
      email: response.user.email || '',
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
    };
    sessionStorage.setItem(this.storageKey, JSON.stringify(this.session));
  }

  private readSession(): Session | null {
    try {
      const saved: Session = JSON.parse(sessionStorage.getItem(this.storageKey) || 'null');
      if (
        saved?.uid &&
        saved.email &&
        saved.accessToken &&
        saved.refreshToken &&
        Number.isFinite(saved.expiresAt)
      )
        return saved;
    } catch {
      sessionStorage.removeItem(this.storageKey);
    }
    return null;
  }
}
