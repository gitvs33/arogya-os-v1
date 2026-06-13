import { useState, useRef, useCallback } from 'react';
import { transcribeAudio, confirmNote, ClinicalNote } from '../api/careScribe';

interface Props {
  encounterId: string;
  isOpen: boolean;
  onClose: () => void;
  onNoteConfirmed?: () => void;
}

const SPECIALTIES = [
  { value: 'general', label: 'General Medicine' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'obgyn', label: 'Obstetrics & Gynecology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'pulmonology', label: 'Pulmonology / Respiratory' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'ent', label: 'ENT' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'nephrology', label: 'Nephrology' },
  { value: 'endocrinology', label: 'Endocrinology' },
  { value: 'urology', label: 'Urology' },
  { value: 'emergency', label: 'Emergency Medicine' },
  { value: 'surgery', label: 'General Surgery' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'rheumatology', label: 'Rheumatology' },
  { value: 'neonatology', label: 'Neonatology / NICU' },
  { value: 'infectious_disease', label: 'Infectious Diseases' },
  { value: 'geriatrics', label: 'Geriatrics' },
];

export default function CareScribeModal({ encounterId, isOpen, onClose, onNoteConfirmed }: Props) {
  const [step, setStep] = useState<'idle' | 'recording' | 'processing' | 'review' | 'done'>('idle');
  const [specialty, setSpecialty] = useState('general');
  const [error, setError] = useState('');
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [editedText, setEditedText] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError('');
    setRecordingDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });

        // Convert to WAV for Sarvam compatibility
        setStep('processing');
        try {
          const wavBlob = await convertToWav(audioBlob);
          const result = await transcribeAudio(wavBlob, encounterId, specialty);
          setNote(result);
          setEditedText(result.note_text);
          setStep('review');
        } catch (err: any) {
          setError(err.message || 'Transcription failed');
          setStep('idle');
        }
      };

      mediaRecorder.start();
      setStep('recording');

      // Track duration
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError('Microphone access denied. Please allow microphone permissions.');
      setStep('idle');
    }
  }, [encounterId, specialty]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const handleConfirm = async () => {
    if (!note) return;
    setIsSaving(true);
    setError('');

    try {
      const confirmed = await confirmNote(note.id, editedText !== note.note_text ? editedText : undefined);
      setNote(confirmed);
      setStep('done');
      onNoteConfirmed?.();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep('idle');
    setNote(null);
    setEditedText('');
    setError('');
    setRecordingDuration(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Care Scribe</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {step === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Record your consultation notes hands-free. The AI will transcribe and structure them into a clinical note.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={startRecording}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Recording
              </button>
            </div>
          )}

          {step === 'recording' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-lg font-medium text-gray-900">Recording...</span>
              </div>
              <p className="text-3xl font-mono text-gray-700">
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </p>
              <button
                onClick={stopRecording}
                className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Stop Recording
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12 space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600">Transcribing and generating clinical note...</p>
              <p className="text-xs text-gray-400">Using Sarvam AI (Saaras STT + Sarvam LLM)</p>
            </div>
          )}

          {step === 'review' && note && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">AI-generated draft — review and edit below</span>
                <span className="text-xs text-gray-400">Specialty: {specialty}</span>
              </div>

              {/* Transcript */}
              {note.transcript && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    Show transcript ({note.transcript.length} chars)
                  </summary>
                  <p className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-600 text-sm italic">
                    {note.transcript}
                  </p>
                </details>
              )}

              {/* Editable note */}
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={16}
              />

              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={isSaving}
                  className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Confirm & Save'}
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {step === 'done' && note && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">Clinical note saved!</p>
              <p className="text-sm text-gray-500">Status: <span className="text-green-600 font-medium">Confirmed</span></p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
          <span>Powered by Sarvam AI</span>
          {recordingDuration > 0 && step !== 'recording' && (
            <span>Duration: {Math.floor(recordingDuration / 60)}:{((recordingDuration) % 60).toString().padStart(2, '0')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Convert any audio blob to WAV format for Sarvam compatibility.
 * Uses AudioContext to decode and re-encode as 16-bit 16kHz mono WAV.
 */
async function convertToWav(blob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Convert to mono 16kHz PCM
    const sampleRate = 16000;
    const length = Math.round(audioBuffer.duration * sampleRate);
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = length * numChannels * bitsPerSample / 8;

    // Resample and mix to mono
    const inputData = audioBuffer.getChannelData(0); // Float32Array
    const outputData = new Float32Array(length);
    const ratio = inputData.length / length;

    for (let i = 0; i < length; i++) {
      const srcIndex = Math.min(Math.floor(i * ratio), inputData.length - 1);
      outputData[i] = inputData[srcIndex];
    }

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, outputData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Build WAV file
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    const pcmView = new Int16Array(buffer, 44);
    pcmView.set(pcmData);

    audioCtx.close();
    return new Blob([buffer], { type: 'audio/wav' });
  } catch {
    // Fallback: return original blob (might work if it's already WAV)
    return blob;
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
