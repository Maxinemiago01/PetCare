import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { Pet, today } from '../../models';
import { PetService } from '../../services/pet.service';
import { ImageService } from '../../services/image.service';
import { errorMessage } from '../../services/errors';

@Component({
  selector: 'app-pet-form',
  standalone: true,
  imports: [FormsModule, RouterLink, IonIcon, IonSpinner],
  templateUrl: './pet-form.page.html',
})
export class PetFormPage implements OnInit, OnDestroy {
  id = '';
  pet: Omit<Pet, 'id'> = {
    name: '',
    species: 'Dog',
    breed: '',
    sex: 'Unknown',
    birthday: '',
    weightKg: null,
    allergies: '',
    notes: '',
    imageUrl: '',
    imagePublicId: '',
    createdAt: '',
    updatedAt: '',
  };
  loading = false;
  saving = false;
  preparing = false;
  error = '';
  photoError = '';
  photo: Blob | null = null;
  previewUrl = '';
  today = today();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pets: PetService,
    private images: ImageService,
  ) {}
  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (this.id) void this.load();
  }
  ngOnDestroy(): void {
    this.clearPreview();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const { id, ...pet } = await this.pets.getPet(this.id);
      this.pet = pet;
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  async choosePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.preparing = true;
    this.photoError = '';
    try {
      const prepared = await this.images.prepare(file);
      this.clearPreview();
      this.photo = prepared;
      this.previewUrl = URL.createObjectURL(prepared);
    } catch (error) {
      this.photoError = errorMessage(error);
    } finally {
      this.preparing = false;
      input.value = '';
    }
  }

  removePhoto(): void {
    this.clearPreview();
    this.photo = null;
    this.pet.imageUrl = '';
    this.pet.imagePublicId = '';
  }

  private clearPreview(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = '';
  }

  async save(form: NgForm): Promise<void> {
    if (form.invalid || this.saving || this.preparing) return;
    this.error = '';
    if (!this.pet.name.trim()) {
      this.error = 'Please enter your pet’s name.';
      return;
    }
    this.saving = true;
    try {
      if (this.photo) {
        Object.assign(this.pet, await this.images.upload(this.photo));
        this.photo = null;
        this.clearPreview();
      }
      const now = new Date().toISOString();
      const saved = await this.pets.savePet(
        {
          ...this.pet,
          name: this.pet.name.trim(),
          breed: this.pet.breed.trim(),
          allergies: this.pet.allergies.trim(),
          notes: this.pet.notes.trim(),
          weightKg:
            this.pet.weightKg === null || this.pet.weightKg === undefined
              ? null
              : Number(this.pet.weightKg),
          createdAt: this.pet.createdAt || now,
          updatedAt: now,
        },
        this.id || undefined,
      );
      await this.router.navigate(['/app/pets', saved.id], { replaceUrl: true });
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.saving = false;
    }
  }
}
