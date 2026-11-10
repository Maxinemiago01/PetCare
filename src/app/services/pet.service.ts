import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pet, PetRecord } from '../models';
import { AuthService } from './auth.service';

interface FirestoreValue {
  stringValue?: string;
  doubleValue?: number;
  nullValue?: null;
}
interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

@Injectable({ providedIn: 'root' })
export class PetService {
  private readonly baseUrl = `https://firestore.googleapis.com/v1/projects/${environment.firebase.projectId}/databases/(default)/documents`;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  async getPets(): Promise<Pet[]> {
    const pets = await this.list<Pet>('pets');
    return pets.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getPet(id: string): Promise<Pet> {
    const options = await this.options();
    const document = await firstValueFrom(
      this.http.get<FirestoreDocument>(`${this.userUrl()}/pets/${encodeURIComponent(id)}`, options),
    );
    return this.decode<Pet>(document);
  }

  async savePet(pet: Omit<Pet, 'id'>, id?: string): Promise<Pet> {
    return this.save<Pet>('pets', pet, id);
  }

  async getRecords(petId?: string): Promise<PetRecord[]> {
    const records = await this.list<PetRecord>('records');
    return records
      .filter((record) => !petId || record.petId === petId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveRecord(record: Omit<PetRecord, 'id'>, id?: string): Promise<PetRecord> {
    return this.save<PetRecord>('records', record, id);
  }

  async deleteRecord(id: string): Promise<void> {
    const options = await this.options();
    await firstValueFrom(
      this.http.delete(`${this.userUrl()}/records/${encodeURIComponent(id)}`, options),
    );
  }

  async deletePet(id: string): Promise<void> {
    const records = await this.getRecords(id);
    const options = await this.options();
    // Firestore does not cascade deletes. Remove the pet's records before its profile.
    for (const record of records) {
      await firstValueFrom(
        this.http.delete(`${this.userUrl()}/records/${encodeURIComponent(record.id)}`, options),
      );
    }
    await firstValueFrom(
      this.http.delete(`${this.userUrl()}/pets/${encodeURIComponent(id)}`, options),
    );
  }

  private userUrl(): string {
    return `${this.baseUrl}/users/${encodeURIComponent(this.auth.uid)}`;
  }

  private async options(): Promise<{ headers: { Authorization: string } }> {
    return { headers: { Authorization: `Bearer ${await this.auth.getToken()}` } };
  }

  private async list<T>(collection: string): Promise<T[]> {
    const options = await this.options();
    const items: T[] = [];
    let pageToken = '';
    do {
      const params = { pageSize: '100', pageToken };
      const response = await firstValueFrom(
        this.http.get<{ documents?: FirestoreDocument[]; nextPageToken?: string }>(
          `${this.userUrl()}/${collection}`,
          { ...options, params },
        ),
      );
      for (const document of response.documents || []) items.push(this.decode<T>(document));
      pageToken = response.nextPageToken || '';
    } while (pageToken);
    return items;
  }

  private async save<T>(collection: string, data: object, id?: string): Promise<T> {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null) fields[key] = { nullValue: null };
      else if (typeof value === 'number') fields[key] = { doubleValue: value };
      else fields[key] = { stringValue: String(value) };
    }
    const options = await this.options();
    let response: FirestoreDocument;
    if (id) {
      response = await firstValueFrom(
        this.http.patch<FirestoreDocument>(
          `${this.userUrl()}/${collection}/${encodeURIComponent(id)}?currentDocument.exists=true`,
          { fields },
          options,
        ),
      );
    } else {
      response = await firstValueFrom(
        this.http.post<FirestoreDocument>(`${this.userUrl()}/${collection}`, { fields }, options),
      );
    }
    return this.decode<T>(response);
  }

  private decode<T>(document: FirestoreDocument): T {
    const result: Record<string, unknown> = { id: document.name.split('/').pop() };
    for (const [key, value] of Object.entries(document.fields || {})) {
      result[key] = value.stringValue ?? value.doubleValue ?? null;
    }
    return result as T;
  }
}
