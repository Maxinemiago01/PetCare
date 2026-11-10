import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pet, PetRecord } from '../models';
import { AuthService } from './auth.service';
import { CareNotificationsService } from './care-notifications.service';
import { ImageService } from './image.service';

@Injectable({ providedIn: 'root' })
export class PetService {
  private readonly baseUrl = `${environment.supabase.url}/rest/v1`;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private images: ImageService,
    private careNotifications: CareNotificationsService,
  ) {}

  async getPets(): Promise<Pet[]> {
    const pets = await this.list<Pet>('pets', { order: 'name.asc,id.asc' });
    for (const pet of pets) pet.imageUrl = await this.images.getUrl(pet.imagePath);
    return pets;
  }

  async getPet(id: string): Promise<Pet> {
    const headers = await this.headers();
    const pets = await firstValueFrom(
      this.http.get<Pet[]>(`${this.baseUrl}/pets`, {
        headers,
        params: { id: `eq.${id}`, limit: '1' },
      }),
    );
    if (!pets[0]) throw new Error('This pet profile could not be found.');
    pets[0].imageUrl = await this.images.getUrl(pets[0].imagePath);
    return pets[0];
  }

  async savePet(pet: Omit<Pet, 'id'>, id?: string): Promise<Pet> {
    // Signed photo URLs expire. Only the permanent path belongs in the database.
    const { imageUrl, ...data } = pet;
    const saved = await this.save<Pet>('pets', data, id);
    saved.imageUrl = imageUrl;
    return saved;
  }

  async getRecords(petId?: string): Promise<PetRecord[]> {
    return this.list<PetRecord>('pet_records', {
      order: 'date.desc,id.asc',
      ...(petId ? { petId: `eq.${petId}` } : {}),
    });
  }

  async saveRecord(record: Omit<PetRecord, 'id'>, id?: string): Promise<PetRecord> {
    const owner = this.auth.uid;
    const saved = await this.save<PetRecord>('pet_records', record, id);
    if (owner === this.auth.uid) await this.careNotifications.save(owner, saved);
    return saved;
  }

  async deleteRecord(id: string): Promise<void> {
    const owner = this.auth.uid;
    await this.remove('pet_records', id);
    if (owner === this.auth.uid) await this.careNotifications.remove(owner, 'recordId', id);
  }

  async deletePet(id: string): Promise<void> {
    const owner = this.auth.uid;
    // The database foreign key removes the pet's records in the same transaction.
    await this.remove('pets', id);
    if (owner === this.auth.uid) await this.careNotifications.remove(owner, 'petId', id);
  }

  refreshCareNotifications(): void {
    const owner = this.auth.uid;
    if (owner) void this.careNotifications.refresh(owner, () => this.getRecords());
  }

  private async headers(): Promise<{ apikey: string; Authorization: string; Prefer: string }> {
    return {
      apikey: environment.supabase.publishableKey,
      Authorization: `Bearer ${await this.auth.getToken()}`,
      Prefer: 'return=representation',
    };
  }

  private async list<T>(table: string, params: Record<string, string>): Promise<T[]> {
    const headers = await this.headers();
    const items: T[] = [];
    let offset = 0;
    let page: T[];
    do {
      page = await firstValueFrom(
        this.http.get<T[]>(`${this.baseUrl}/${table}`, {
          headers,
          params: {
            ...params,
            owner_id: `eq.${this.auth.uid}`,
            limit: '100',
            offset: String(offset),
          },
        }),
      );
      items.push(...page);
      offset += page.length;
    } while (page.length === 100);
    return items;
  }

  private async save<T>(table: string, data: object, id?: string): Promise<T> {
    const headers = await this.headers();
    const body = { ...data, owner_id: this.auth.uid };
    let saved: T[];
    if (id)
      saved = await firstValueFrom(
        this.http.patch<T[]>(`${this.baseUrl}/${table}`, body, {
          headers,
          params: { id: `eq.${id}` },
        }),
      );
    else
      saved = await firstValueFrom(
        this.http.post<T[]>(`${this.baseUrl}/${table}`, body, { headers }),
      );
    if (!saved[0]) throw new Error('This item no longer exists or you do not have access to it.');
    return saved[0];
  }

  private async remove(table: string, id: string): Promise<void> {
    const headers = await this.headers();
    const removed = await firstValueFrom(
      this.http.delete<{ id: string }[]>(`${this.baseUrl}/${table}`, {
        headers,
        params: { id: `eq.${id}` },
      }),
    );
    if (!removed.length)
      throw new Error('This item no longer exists or you do not have access to it.');
  }
}
