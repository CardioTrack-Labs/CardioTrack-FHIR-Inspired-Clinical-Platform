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
  assigned_doctor_id?: number;
  assigned_doctor?: User;
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
  recorded_at: string;
  is_abnormal: boolean;
  notes?: string;
}

export interface Condition {
  id: number;
  patientId: number;
  icd10Code?: string;
  icd10_code?: string;
  description: string;
  status: 'active' | 'resolved' | 'chronic';
  onset_date: string;
  diagnosed_by?: User;
  diagnosedBy?: User;
}

export interface Medication {
  id: number;
  patientId: number;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'discontinued';
  prescribed_by?: User;
  prescribedBy?: User;
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

export interface Report {
  id: number;
  patient_id: number;
  title: string;
  report_type: 'ECG' | 'Lab' | 'Imaging' | 'Discharge' | string;
  file_url: string;
  uploaded_by?: User;
  report_date: string;
  created_at?: string;
}


