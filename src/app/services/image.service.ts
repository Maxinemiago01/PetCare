import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImageService {
  constructor(private http: HttpClient) {}

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

  async upload(photo: Blob): Promise<{ imageUrl: string; imagePublicId: string }> {
    const data = new FormData();
    data.append('file', photo, 'pet-profile.jpg');
    data.append('upload_preset', environment.cloudinary.uploadPreset);
    const response = await firstValueFrom(
      this.http.post<{ secure_url: string; public_id: string }>(
        `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/image/upload`,
        data,
      ),
    );
    return { imageUrl: response.secure_url, imagePublicId: response.public_id };
  }
}
