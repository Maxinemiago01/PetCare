import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly storageUrl = `${environment.supabase.url}/storage/v1`;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  async prepare(file: File): Promise<Blob> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw new Error('Please choose a JPG, PNG, or WebP photo.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Please choose a photo smaller than 10 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this photo.');
      context.fillStyle = '#fffaf3';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare this photo.'))),
          'image/jpeg',
          0.82,
        );
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('photo')) throw error;
      throw new Error('We could not read this photo. Please choose another image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async upload(photo: Blob): Promise<string> {
    const path = `${this.auth.uid}/${crypto.randomUUID()}.jpg`;
    const headers = {
      ...(await this.headers()),
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    };
    await firstValueFrom(
      this.http.post(
        `${this.storageUrl}/object/${environment.supabase.photoBucket}/${path}`,
        photo,
        { headers },
      ),
    );
    return path;
  }

  async getUrl(path: string): Promise<string> {
    if (!path) return '';
    const headers = await this.headers();
    const safePath = path.split('/').map(encodeURIComponent).join('/');
    try {
      const response = await firstValueFrom(
        this.http.post<{ signedURL: string }>(
          `${this.storageUrl}/object/sign/${environment.supabase.photoBucket}/${safePath}`,
          { expiresIn: 3600 },
          { headers },
        ),
      );
      return `${this.storageUrl}${response.signedURL}`;
    } catch (error) {
      // A removed photo should not prevent opening the pet's care records.
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 404 || String(error.error?.statusCode) === '404')
      )
        return '';
      throw error;
    }
  }

  private async headers(): Promise<{ apikey: string; Authorization: string }> {
    return {
      apikey: environment.supabase.publishableKey,
      Authorization: `Bearer ${await this.auth.getToken()}`,
    };
  }
}
