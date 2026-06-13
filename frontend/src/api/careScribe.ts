import client from './client';

export interface ClinicalNote {
  id: number;
  note_text: string;
  transcript: string;
  specialty: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DISCARDED';
  created_at: string;
  updated_at?: string;
}

/**
 * Upload audio and generate a structured clinical note via Sarvam AI.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  encounterId: string,
  specialty: string = 'general'
): Promise<ClinicalNote> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('encounter_id', encounterId);
  formData.append('specialty', specialty);

  // Use axios directly with form data (interceptors attach auth token)
  const response = await client.post('/care-scribe/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Confirm (finalize) a draft clinical note.
 */
export async function confirmNote(
  noteId: number,
  editedNote?: string
): Promise<ClinicalNote> {
  const response = await client.post(`/care-scribe/${noteId}/confirm/`, {
    edited_note: editedNote,
  });
  return response.data;
}

/**
 * List all clinical notes for an encounter.
 */
export async function listNotes(encounterId: string): Promise<ClinicalNote[]> {
  const response = await client.get(`/care-scribe/encounter/${encounterId}/`);
  return response.data;
}
