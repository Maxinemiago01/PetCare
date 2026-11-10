export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birthday: string;
  weightKg: number | null;
  allergies: string;
  notes: string;
  imageUrl: string;
  imagePath: string;
  createdAt: string;
  updatedAt: string;
}

export type RecordCategory = 'vaccination' | 'medical' | 'health';

export interface PetRecord {
  id: string;
  petId: string;
  category: RecordCategory;
  title: string;
  date: string;
  nextDate: string;
  veterinarian: string;
  weightKg: number | null;
  notes: string;
  createdAt: string;
}

export const recordLabels: Record<RecordCategory, string> = {
  vaccination: 'Vaccination',
  medical: 'Medical visit',
  health: 'Health note',
};

export function today(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function petAge(birthday: string): string {
  if (!birthday) return 'Birthday not added';
  const birth = new Date(`${birthday}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months < 1) return 'Less than a month old';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} old`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} old`;
}
