import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface Session {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthResponse {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private session: Session | null = this.readSession();
  private refreshing: Promise<string> | null = null;
  private generation = 0;
  private readonly authUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:';

  constructor(private http: HttpClient) {}

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
    await this.authenticate('signInWithPassword', email, password);
  }

  async register(email: string, password: string): Promise<void> {
    await this.authenticate('signUp', email, password);
  }

  private async authenticate(action: string, email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.authUrl}${action}?key=${environment.firebase.apiKey}`, {
        email: email.trim(),
        password,
        returnSecureToken: true,
      }),
    );
    this.generation++;
    this.session = {
      uid: response.localId,
      email: response.email,
      idToken: response.idToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + Number(response.expiresIn) * 1000,
    };
    this.saveSession();
  }

  async resetPassword(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.authUrl}sendOobCode?key=${environment.firebase.apiKey}`, {
        requestType: 'PASSWORD_RESET',
        email: email.trim(),
      }),
    );
  }

  logout(): void {
    this.generation++;
    this.session = null;
    sessionStorage.removeItem('petcare-session');
  }

  async getToken(): Promise<string> {
    if (!this.session) throw new Error('Your session ended. Please log in again.');
    if (this.session.expiresAt > Date.now() + 60000) return this.session.idToken;
    if (!this.refreshing)
      this.refreshing = this.refreshToken().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async refreshToken(): Promise<string> {
    const generation = this.generation;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.session!.refreshToken,
    });
    try {
      const response = await firstValueFrom(
        this.http.post<{
          id_token: string;
          refresh_token: string;
          expires_in: string;
        }>(
          `https://securetoken.googleapis.com/v1/token?key=${environment.firebase.apiKey}`,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      if (!this.session || generation !== this.generation)
        throw new Error('Your session ended. Please log in again.');
      this.session.idToken = response.id_token;
      this.session.refreshToken = response.refresh_token;
      this.session.expiresAt = Date.now() + Number(response.expires_in) * 1000;
      this.saveSession();
      return response.id_token;
    } catch (error) {
      // A temporary connection error should not sign the user out.
      if ((error as { status?: number }).status === 400 && generation === this.generation)
        this.logout();
      throw error;
    }
  }

  private readSession(): Session | null {
    try {
      const saved: Session = JSON.parse(sessionStorage.getItem('petcare-session') || 'null');
      if (
        saved?.uid &&
        saved.email &&
        saved.idToken &&
        saved.refreshToken &&
        Number.isFinite(saved.expiresAt)
      )
        return saved;
    } catch {
      sessionStorage.removeItem('petcare-session');
    }
    return null;
  }

  private saveSession(): void {
    sessionStorage.setItem('petcare-session', JSON.stringify(this.session));
  }
}
