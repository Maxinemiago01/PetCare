import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { Pet, PetRecord, recordLabels, today } from '../../models';
import { PetService } from '../../services/pet.service';
import { errorMessage } from '../../services/errors';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [DatePipe, RouterLink, IonIcon, IonSpinner],
  templateUrl: './reminders.page.html',
})
export class RemindersPage implements OnInit {
  pets: Pet[] = [];
  records: PetRecord[] = [];
  loading = true;
  error = '';
  savingId = '';
  today = today();
  labels = recordLabels;
  constructor(private petService: PetService) {}
  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const [pets, records] = await Promise.all([
        this.petService.getPets(),
        this.petService.getRecords(),
      ]);
      this.pets = pets;
      this.records = records
        .filter((record) => record.nextDate && pets.some((pet) => pet.id === record.petId))
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  petName(id: string): string {
    return this.pets.find((pet) => pet.id === id)?.name || 'Your pet';
  }
  get overdueCount(): number {
    return this.records.filter((record) => record.nextDate < this.today).length;
  }

  async markDone(record: PetRecord): Promise<void> {
    if (this.savingId) return;
    this.savingId = record.id;
    this.error = '';
    try {
      const { id, ...data } = record;
      await this.petService.saveRecord({ ...data, nextDate: '' }, id);
      this.records = this.records.filter((item) => item.id !== id);
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.savingId = '';
    }
  }
}
