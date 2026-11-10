import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { Pet, PetRecord, petAge, today } from '../../models';
import { PetService } from '../../services/pet.service';
import { errorMessage } from '../../services/errors';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IonIcon, IonSpinner],
  templateUrl: './home.page.html',
})
export class HomePage implements OnInit {
  pets: Pet[] = [];
  records: PetRecord[] = [];
  loading = true;
  error = '';
  search = '';
  filter = 'All pets';
  filters = ['All pets', 'Dogs', 'Cats', 'Other pets'];
  petAge = petAge;
  today = today();
  constructor(private petService: PetService) {}
  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      [this.pets, this.records] = await Promise.all([
        this.petService.getPets(),
        this.petService.getRecords(),
      ]);
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  get filteredPets(): Pet[] {
    return this.pets.filter((pet) => {
      const matchesSearch = `${pet.name} ${pet.breed} ${pet.species}`
        .toLowerCase()
        .includes(this.search.trim().toLowerCase());
      const matchesFilter =
        this.filter === 'All pets' ||
        (this.filter === 'Dogs' && pet.species === 'Dog') ||
        (this.filter === 'Cats' && pet.species === 'Cat') ||
        (this.filter === 'Other pets' && !['Dog', 'Cat'].includes(pet.species));
      return matchesSearch && matchesFilter;
    });
  }

  get reminders(): PetRecord[] {
    return this.records
      .filter((record) => record.nextDate && this.pets.some((pet) => pet.id === record.petId))
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  }

  get dueCount(): number {
    return this.reminders.filter((record) => record.nextDate <= this.today).length;
  }
  petName(id: string): string {
    return this.pets.find((pet) => pet.id === id)?.name || 'Your pet';
  }
}
