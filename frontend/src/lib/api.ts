// src/lib/api.ts — CardioTrack API Client
import { User, Patient, Observation, Condition, Medication } from '../types/fhir';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'ct_access_token',
  REFRESH_TOKEN: 'ct_refresh_token',
  USER: 'ct_user',
};

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

interface AuthResponse {
  user: User;
  tokens: TokenResponse;
}

class CardioTrackApiClient {
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  getCurrentUser(): User | null {
    const uStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (!uStr) return null;
    try {
      return JSON.parse(uStr) as User;
    } catch (e) {
      return null;
    }
  }

  setSession(tokens: TokenResponse, user: User) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        this.clearSession();
        // Notify router via custom event or callback
        const event = new CustomEvent('ct-unauthorized');
        window.dispatchEvent(event);
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json() as T;
      }
      return await response.text() as unknown as T;
    } catch (error) {
      console.error(`API request failed [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  }

  // ── Authentication Endpoints ────────────────────────────────────
  async login(email: string, password: string): Promise<User> {
    this.clearSession();
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res && res.tokens && res.user) {
      this.setSession(res.tokens, res.user);
      return res.user;
    }
    throw new Error('Invalid response from server');
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (e) {
        console.warn('Backend logout failed:', e);
      }
    }
    this.clearSession();
  }

  // ── Patient Endpoints ───────────────────────────────────────────
  async getPatients(filters: { name?: string; mrn?: string; doctor_id?: number } = {}): Promise<Patient[]> {
    const queryParams = new URLSearchParams();
    if (filters.name) queryParams.append('name', filters.name);
    if (filters.mrn) queryParams.append('mrn', filters.mrn);
    if (filters.doctor_id) queryParams.append('doctor_id', String(filters.doctor_id));

    const qs = queryParams.toString();
    const endpoint = `/patients${qs ? '?' + qs : ''}`;
    return await this.request<Patient[]>(endpoint);
  }

  async getPatient(id: number): Promise<Patient> {
    return await this.request<Patient>(`/patients/${id}`);
  }

  // Returns the patient profile for the currently authenticated patient user.
  // Uses GET /patients/me — no doctor/admin role required.
  async getMyPatientProfile(): Promise<Patient> {
    return await this.request<Patient>('/patients/me');
  }

  // ── Clinical Data Endpoints ─────────────────────────────────────
  async getObservations(patientId: number): Promise<Observation[]> {
    return await this.request<Observation[]>(`/patients/${patientId}/observations`);
  }

  async createObservation(patientId: number, type: string, value: number, unit: string, notes: string = ''): Promise<Observation> {
    return await this.request<Observation>(`/patients/${patientId}/observations`, {
      method: 'POST',
      body: JSON.stringify({ type, value, unit, notes }),
    });
  }

  async getConditions(patientId: number): Promise<Condition[]> {
    return await this.request<Condition[]>(`/patients/${patientId}/conditions`);
  }

  async createCondition(patientId: number, icd10Code: string, description: string, onsetDate: string, status: string = 'active'): Promise<Condition> {
    return await this.request<Condition>(`/patients/${patientId}/conditions`, {
      method: 'POST',
      body: JSON.stringify({ icd10_code: icd10Code, description, onset_date: onsetDate, status }),
    });
  }

  async getMedications(patientId: number): Promise<Medication[]> {
    return await this.request<Medication[]>(`/patients/${patientId}/medications`);
  }

  async createMedication(patientId: number, name: string, dosage: string, frequency: string, startDate: string, endDate: string = '', status: string = 'active'): Promise<Medication> {
    return await this.request<Medication>(`/patients/${patientId}/medications`, {
      method: 'POST',
      body: JSON.stringify({ name, dosage, frequency, start_date: startDate, end_date: endDate, status }),
    });
  }
}

export const ctApi = new CardioTrackApiClient();
