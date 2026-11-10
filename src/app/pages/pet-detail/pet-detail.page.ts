import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { Pet, PetRecord, RecordCategory, petAge, recordLabels, today } from '../../models';
import { PetService } from '../../services/pet.service';
import { errorMessage } from '../../services/errors';

@Component({
  selector: 'app-pet-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IonIcon, IonSpinner],
  templateUrl: './pet-detail.page.html',
})
export class PetDetailPage implements OnInit {
  @ViewChild('recordDialog') recordDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('deleteDialog') deleteDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('recordForm') recordForm!: NgForm;
  pet: Pet | null = null;
  records: PetRecord[] = [];
  loading = true;
  error = '';
  filter: 'all' | RecordCategory = 'all';
  labels = recordLabels;
  petAge = petAge;
  today = today();
  record = this.blankRecord();
  editingRecordId = '';
  private originalNextDate = '';
  recordError = '';
  saving = false;
  deleting = false;
  deleteRecordTarget: PetRecord | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pets: PetService,
  ) {}
  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      [this.pet, this.records] = await Promise.all([
        this.pets.getPet(id),
        this.pets.getRecords(id),
      ]);
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  get filteredRecords(): PetRecord[] {
    return this.records.filter(
      (record) => this.filter === 'all' || record.category === this.filter,
    );
  }
  count(category: RecordCategory): number {
    return this.records.filter((record) => record.category === category).length;
  }
  icon(category: RecordCategory): string {
    return category === 'vaccination'
      ? 'medical'
      : category === 'medical'
        ? 'document-text'
        : 'heart';
  }

  private blankRecord(): Omit<PetRecord, 'id'> {
    return {
      petId: '',
      category: 'vaccination',
      title: '',
      date: today(),
      nextDate: '',
      veterinarian: '',
      weightKg: null,
      notes: '',
      createdAt: '',
    };
  }

  openRecord(record?: PetRecord): void {
    this.today = today();
    this.editingRecordId = record?.id || '';
    this.originalNextDate = record?.nextDate || '';
    this.recordError = '';
    if (record) {
      const { id, ...data } = record;
      this.record = { ...data };
    } else this.record = { ...this.blankRecord(), petId: this.pet!.id };
    this.recordForm.resetForm(this.record);
    this.recordDialog.nativeElement.showModal();
  }

  get keepsOverdueDate(): boolean {
    return (
      !!this.record.nextDate &&
      this.record.nextDate === this.originalNextDate &&
      this.record.nextDate < this.today
    );
  }

  async saveRecord(form: NgForm): Promise<void> {
    if (form.invalid || this.saving) return;
    this.today = today();
    this.recordError = '';
    if (!this.record.title.trim()) {
      this.recordError = 'Please give this record a title.';
      return;
    }
    if (this.record.nextDate && this.record.nextDate < this.today && !this.keepsOverdueDate) {
      this.recordError = 'Choose today or a future date for the next reminder.';
      return;
    }
    // An existing overdue reminder may stay on the record when editing other fields.
    const invalidInput = this.recordDialog.nativeElement.querySelector<HTMLInputElement>(
      'input:invalid:not([name="nextDate"])',
    );
    if (invalidInput) {
      invalidInput.reportValidity();
      return;
    }
    if (this.record.nextDate && this.record.nextDate < this.record.date) {
      this.recordError = 'The next due date must be on or after the record date.';
      return;
    }
    this.saving = true;
    try {
      const saved = await this.pets.saveRecord(
        {
          ...this.record,
          petId: this.pet!.id,
          title: this.record.title.trim(),
          veterinarian: this.record.veterinarian.trim(),
          notes: this.record.notes.trim(),
          weightKg:
            this.record.category === 'health' && this.record.weightKg != null
              ? Number(this.record.weightKg)
              : null,
          createdAt: this.record.createdAt || new Date().toISOString(),
        },
        this.editingRecordId || undefined,
      );
      this.records = [...this.records.filter((record) => record.id !== saved.id), saved].sort(
        (a, b) => b.date.localeCompare(a.date),
      );
      this.recordDialog.nativeElement.close();
    } catch (error) {
      this.recordError = errorMessage(error);
    } finally {
      this.saving = false;
    }
  }

  confirmDelete(record?: PetRecord): void {
    this.deleteRecordTarget = record || null;
    this.deleteDialog.nativeElement.showModal();
  }

  preventBusyClose(event: Event, busy: boolean): void {
    if (busy) event.preventDefault();
  }

  async deleteItem(): Promise<void> {
    if (this.deleting || !this.pet) return;
    this.deleting = true;
    this.error = '';
    try {
      if (this.deleteRecordTarget) {
        await this.pets.deleteRecord(this.deleteRecordTarget.id);
        this.records = this.records.filter((record) => record.id !== this.deleteRecordTarget!.id);
      } else {
        await this.pets.deletePet(this.pet.id);
        await this.router.navigateByUrl('/app', { replaceUrl: true });
      }
      this.deleteDialog.nativeElement.close();
    } catch (error) {
      this.error = errorMessage(error);
      this.deleteDialog.nativeElement.close();
    } finally {
      this.deleting = false;
    }
  }
}
