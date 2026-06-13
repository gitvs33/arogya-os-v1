import client from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Ward {
  id: string;
  name: string;
  ward_type: string;
  ward_type_label?: string;
  bed_charge_per_day: string;
  floor: string;
  is_active: boolean;
  total_beds?: number;
  available_beds?: number;
  occupied_beds?: number;
  created_at: string;
  updated_at: string;
}

export interface BedPatient {
  id: string;
  name: string;
  gender: string;
  age: number | null;
  phone: string;
}

export interface BedEncounter {
  id: string;
  encounter_type: string;
  clinical_acuity: string;
  admitted_at: string;
  days_admitted: number;
  diagnosis: string;
  doctor_name: string;
}

export interface BedInfo {
  id: string;
  bed_number: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  status_label: string;
  notes: string;
  patient: BedPatient | null;
  encounter: BedEncounter | null;
}

export interface WardBedMap {
  id: string;
  name: string;
  ward_type: string;
  ward_type_label: string;
  bed_charge_per_day: string;
  floor: string;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  beds: BedInfo[];
}

export interface DailyRound {
  id: string;
  encounter: string;
  encounter_patient_name?: string;
  round_date: string;
  conducted_by: string;
  conducted_by_name?: string;
  prescription: string | null;
  prescription_id?: string | null;
  notes: string;
  status: 'draft' | 'finalised';
  created_at: string;
  updated_at: string;
}

export interface NursingNote {
  id: string;
  encounter: string;
  recorded_by: string;
  recorded_by_name?: string;
  note: string;
  created_at: string;
}

export interface MedicationAdministration {
  id: string;
  encounter: string;
  medication: string;
  drug_name?: string;
  administered_by: string;
  administered_by_name?: string;
  administered_at: string;
  dose_given: string;
  route: string;
  notes: string;
  created_at: string;
}

export interface BillingAccrual {
  id: string;
  encounter: string;
  accrual_type: string;
  description: string;
  date: string;
  amount: string;
  is_invoiced: boolean;
  created_at: string;
}

export interface DischargeReadiness {
  can_discharge: boolean;
  blocks: Array<{ type: string; message: string }>;
  encounter_id: string;
  patient_name: string;
}

export interface NursingStationData {
  pending_medications: Array<{
    bed_number: string;
    patient_name: string;
    patient_id: string;
    encounter_id: string;
    medication_id: string;
    drug_name: string;
    dosage: string;
    route: string;
    frequency: string;
  }>;
  vitals_due: Array<{
    bed_number: string;
    patient_name: string;
    patient_id: string;
    encounter_id: string;
    last_recorded: string;
    needs_vitals: boolean;
  }>;
  alerts: Array<{
    bed_number: string;
    patient_name: string;
    patient_id: string;
    encounter_id: string;
    alert_id: string;
    severity: string;
    message: string;
    created_at: string;
  }>;
}

// ─── API Functions ──────────────────────────────────────────────────────────

// ── Wards ───────────────────────────────────────────────────────────────────

export async function listWards(): Promise<Ward[]> {
  const { data } = await client.get('/wards/');
  return data.results || data;
}

export async function getWard(id: string): Promise<Ward> {
  const { data } = await client.get(`/wards/${id}/`);
  return data;
}

export async function createWard(ward: Partial<Ward>): Promise<Ward> {
  const { data } = await client.post('/wards/', ward);
  return data;
}

export async function updateWard(id: string, ward: Partial<Ward>): Promise<Ward> {
  const { data } = await client.patch(`/wards/${id}/`, ward);
  return data;
}

// ── Bed Map ─────────────────────────────────────────────────────────────────

export async function getBedMap(wardId?: string): Promise<WardBedMap[]> {
  const params = wardId ? { ward_id: wardId } : {};
  const { data } = await client.get('/bed-map/', { params });
  return data;
}

export async function getWardBedMap(wardId: string): Promise<WardBedMap> {
  const { data } = await client.get(`/wards/${wardId}/bed_map/`);
  return data;
}

// ── Beds ────────────────────────────────────────────────────────────────────

export async function listBeds(params?: { ward?: string; status?: string }): Promise<BedInfo[]> {
  const { data } = await client.get('/beds/', { params });
  return data.results || data;
}

export async function assignBed(bedId: string, encounterId: string): Promise<BedInfo> {
  const { data } = await client.post(`/beds/${bedId}/assign/`, { encounter_id: encounterId });
  return data;
}

export async function releaseBed(bedId: string): Promise<void> {
  await client.post(`/beds/${bedId}/release/`);
}

// ── Daily Rounds ────────────────────────────────────────────────────────────

export async function listDailyRounds(params?: { encounter?: string; status?: string }): Promise<DailyRound[]> {
  const { data } = await client.get('/daily-rounds/', { params });
  return data.results || data;
}

export async function createDailyRound(encounterId: string, notes?: string): Promise<DailyRound> {
  const { data } = await client.post('/daily-rounds/', {
    encounter: encounterId,
    notes: notes || '',
  });
  return data;
}

export async function finaliseRound(
  roundId: string,
  prescription?: {
    medications: Array<{
      drug_name: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      quantity?: number;
      instructions?: string;
    }>;
    notes?: string;
  },
  notes?: string,
): Promise<DailyRound> {
  const { data } = await client.post(`/daily-rounds/${roundId}/finalise/`, {
    prescription,
    notes,
  });
  return data;
}

// ── Nursing Station ─────────────────────────────────────────────────────────

export async function getNursingStation(wardId?: string): Promise<NursingStationData> {
  const params = wardId ? { ward_id: wardId } : {};
  const { data } = await client.get('/nursing-station/', { params });
  return data;
}

export async function recordVitalsFromNursingStation(
  encounterId: string,
  vitals: {
    systolic_bp?: number;
    diastolic_bp?: number;
    heart_rate?: number;
    temperature?: number;
    oxygen_saturation?: number;
    respiratory_rate?: number;
  },
): Promise<any> {
  const { data } = await client.post('/nursing-station/record-vitals/', {
    encounter_id: encounterId,
    ...vitals,
  });
  return data;
}

// ── Nursing Notes ───────────────────────────────────────────────────────────

export async function listNursingNotes(encounterId: string): Promise<NursingNote[]> {
  const { data } = await client.get('/nursing-notes/', {
    params: { encounter: encounterId },
  });
  return data.results || data;
}

export async function createNursingNote(encounterId: string, note: string): Promise<NursingNote> {
  const { data } = await client.post('/nursing-notes/', {
    encounter: encounterId,
    note,
  });
  return data;
}

// ── Medication Administration ───────────────────────────────────────────────

export async function listMedicationAdministrations(encounterId: string): Promise<MedicationAdministration[]> {
  const { data } = await client.get('/medication-administrations/', {
    params: { encounter: encounterId },
  });
  return data.results || data;
}

export async function administerMedication(
  encounterId: string,
  medicationId: string,
  doseGiven: string,
  route?: string,
  notes?: string,
): Promise<MedicationAdministration> {
  const { data } = await client.post('/medication-administrations/', {
    encounter: encounterId,
    medication: medicationId,
    dose_given: doseGiven,
    route: route || '',
    notes: notes || '',
  });
  return data;
}

// ── Discharge ───────────────────────────────────────────────────────────────

export async function checkDischargeReadiness(encounterId: string): Promise<DischargeReadiness> {
  const { data } = await client.get('/discharge/readiness/', {
    params: { encounter_id: encounterId },
  });
  return data;
}

export async function executeDischarge(
  encounterId: string,
  dischargeData: {
    discharge_diagnosis: string;
    condition_at_discharge?: string;
    follow_up_instructions?: string;
    discharge_medications?: string;
  },
): Promise<any> {
  const { data } = await client.post('/discharge/execute/', {
    encounter_id: encounterId,
    ...dischargeData,
  });
  return data;
}

// ── Transfer ────────────────────────────────────────────────────────────────

export async function transferPatient(
  encounterId: string,
  destinationBedId: string,
  reason?: string,
): Promise<BedInfo> {
  const { data } = await client.post('/transfer/', {
    encounter_id: encounterId,
    destination_bed_id: destinationBedId,
    reason: reason || '',
  });
  return data;
}

// ── Billing Accruals ────────────────────────────────────────────────────────

export async function listBillingAccruals(encounterId: string): Promise<BillingAccrual[]> {
  const { data } = await client.get('/billing-accruals/', {
    params: { encounter: encounterId },
  });
  return data.results || data;
}
