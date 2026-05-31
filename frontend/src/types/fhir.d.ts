export interface User {
  id: number;
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'cardiologist' | 'admin';
  createdAt?: string;
}

export interface Patient {
  id: number;
  userId: number;
  dateOfBirth: string;
  gender: string;
  medicalRecordNumber: string;
  bloodType?: string;
  assignedDoctorId?: number;
  assignedDoctor?: User;
  createdAt?: string;
  updatedAt?: string;
}

export type ObservationType =
  | 'systolic_bp'
  | 'diastolic_bp'
  | 'heart_rate'
  | 'spo2'
  | 'glucose'
  | 'cholesterol';

export interface Observation {
  id: number;
  patientId: number;
  type: ObservationType;
  value: number;
  unit: string;
  recordedAt: string;
  isAbnormal: boolean;
  notes?: string;
}

export interface Condition {
  id: number;
  patientId: number;
  icd10Code: string;
  description: string;
  status: 'active' | 'resolved' | 'chronic';
  onsetDate: string;
}

export interface Medication {
  id: number;
  patientId: number;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'discontinued';
}

export interface HEARTScore {
  history: 0 | 1 | 2;
  ecg: 0 | 1 | 2;
  age: 0 | 1 | 2;
  riskFactors: 0 | 1 | 2;
  troponin: 0 | 1 | 2;
  total: number;
  category: 'low' | 'moderate' | 'high';
  recommendation: string;
}
