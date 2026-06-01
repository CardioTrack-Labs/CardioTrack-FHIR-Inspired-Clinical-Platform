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
  user?: User;
  date_of_birth: string;
  gender: string;
  medical_record_number: string;
  blood_type?: string;
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

export interface RiskAssessment {
  id?: number;
  patient_id?: number;
  score_type: string;
  score_value: number;
  risk_category: string;
  recommendation?: string;
  calculated_by?: User;
  calculated_at?: string;
}

