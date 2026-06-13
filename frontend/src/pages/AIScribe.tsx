import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { encountersApi } from '../api/encounters';
import type { ExtractionResult, ExtractedMedication, ExtractedLabTest } from '../api/encounters';
import {
  Mic, Circle, Square, Plus, Settings2, FileText, ChevronDown, Check, X, Stethoscope, Edit2, Search, User, Globe
} from 'lucide-react';
import { TEMPLATES, getTemplateFields } from './ScribeTemplates';
import DrugAutocomplete from '../components/DrugAutocomplete';
import LabPanelSelector from '../components/LabPanelSelector';

/* ────────────────────────────────────────────────
   AI Scribe Page
   ──────────────────────────────────────────────── */

const AIScribe = () => {
  const [activeTemplate, setActiveTemplate] = useState('cardiology');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [generatedNote, setGeneratedNote] = useState<any>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionConfirmed, setExtractionConfirmed] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [manualMedications, setManualMedications] = useState<any[]>([]);
  const [showMedicationPopup, setShowMedicationPopup] = useState(false);

  // Manual lab tests
  const [manualLabs, setManualLabs] = useState<any[]>([]);
  const [showLabPopup, setShowLabPopup] = useState(false);
  const [labForm, setLabForm] = useState({
    panel_id: '',
    panel_name: '',
    price: 0,
    category: '',
    priority: 'ROUTINE',
  });
  const [medForm, setMedForm] = useState({
    drug_name: '', dosage: '', frequency: '', duration: '', quantity: 1, unit_price: 0
  });

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English (India)');
  
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);
  
  const LANGUAGES = [
    'English (India)', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 
    'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 
    'Odia', 'Assamese', 'Urdu'
  ];

  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Fetch encounters to attach notes to
  const { data: encounters, isLoading } = useQuery({
    queryKey: ['encounters'],
    queryFn: () => client.get('/encounters/').then(res => res.data.results || res.data)
  });

  const encounterList = Array.isArray(encounters) ? encounters : [];
  const encounter = encounterList.find(e => e.id === selectedEncounterId) || encounterList[0];

  // Auto-select first encounter if none selected
  useEffect(() => {
    if (!selectedEncounterId && encounterList.length > 0) {
      setSelectedEncounterId(encounterList[0].id);
    }
  }, [encounterList, selectedEncounterId]);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (!event.target.closest('.lang-selector-container')) {
        setIsLangOpen(false);
      }
      if (!event.target.closest('.encounter-selector-container')) {
        setIsEncounterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStop;

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setTranscript('');
      setGeneratedNote(null);
    } catch (err) {
      console.error('Failed to start recording', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleStop = async () => {
    if (!encounter) {
      alert('No encounter selected to attach note to.');
      return;
    }
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('encounter_id', encounter.id);
    formData.append('specialty', activeTemplate);

    setIsProcessing(true);
    try {
      const res = await client.post('/care-scribe/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTranscript(res.data.transcript);
      setGeneratedNote(res.data.note_text);
      setNoteId(res.data.id);
    } catch (err: any) {
      console.error('Failed to transcribe', err);
      alert(err.response?.data?.error || 'Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!noteId) return;
    try {
      await client.post(`/care-scribe/${noteId}/confirm/`, {
        edited_note: generatedNote
      });

      // Auto-trigger extraction preview
      if (selectedEncounterId) {
        setExtractionLoading(true);
        try {
          const res = await encountersApi.extractOrders(selectedEncounterId, { confirm: false });
          // Replace AI suggested medications & lab tests with doctor's manual selections
          const manualMedsMapped = manualMedications.map(m => ({ ...m, matched: true }));
          const manualLabsMapped = manualLabs.map(l => ({ ...l, matched: true }));
          setExtraction({ 
            ...res.data, 
            medications: manualMedsMapped,
            lab_orders: manualLabsMapped,
          });
        } catch {
          // Extraction is optional — don't block the flow
          console.log('Extraction preview not available');
        } finally {
          setExtractionLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to confirm note', err);
      alert('Failed to save note');
    }
  };

  const handleConfirmExtraction = async () => {
    if (!selectedEncounterId || !extraction) return;
    setExtractionLoading(true);
    try {
      let createdMeds = 0;
      let createdLabs = 0;

      let draftPrescriptionId = null;

      // Create matched medications
      for (const med of extraction.medications) {
        if (!med.matched || !med.drug_name) continue;
        const res = await encountersApi.addMedication(selectedEncounterId, {
          drug_name: med.drug_name,
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          duration: med.duration || '',
          quantity: med.quantity || 1,
          inventory_item_id: med.inventory_item_id || null,
        });
        if (!draftPrescriptionId && res.data.prescription) draftPrescriptionId = res.data.prescription;
        createdMeds++;
      }

      // Create matched lab orders
      for (const lab of extraction.lab_orders) {
        if (!lab.matched || !lab.test_panel_id) continue;
        const res = await encountersApi.addLabOrder(selectedEncounterId, {
          test_panel: lab.test_panel_id,
        });
        if (!draftPrescriptionId && res.data.prescription) draftPrescriptionId = res.data.prescription;
        createdLabs++;
      }

      // Submit the DRAFT prescription so it shows in pharmacy/lab
      if (draftPrescriptionId) {
        await encountersApi.submitPrescription(selectedEncounterId, draftPrescriptionId);
      }

      setExtraction(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          created_medication_count: createdMeds,
          created_lab_order_count: createdLabs,
        };
      });
      setExtractionConfirmed(true);
    } catch (err) {
      console.error('Failed to create manual orders', err);
      alert('Failed to create medication/lab orders');
    } finally {
      setExtractionLoading(false);
    }
  };

  const handleDismissExtraction = () => {
    setExtraction(null);
    setExtractionConfirmed(false);
  };

  const handleRegenerate = async () => {
    if (!transcript || !encounter) return;
    setIsRegenerating(true);
    try {
      // Re-use stored audio chunks if available
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('encounter_id', encounter.id);
        formData.append('specialty', activeTemplate);

        const res = await client.post('/care-scribe/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setTranscript(res.data.transcript);
        setGeneratedNote(res.data.note_text);
        setNoteId(res.data.id);
      } else {
        alert('No audio data available. Please record again.');
      }
    } catch (err: any) {
      console.error('Failed to regenerate', err);
      alert(err.response?.data?.error || 'Failed to regenerate note');
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading patient data...</div>;
  }

  if (!encounter) {
    return (
      <div className="p-8 text-center text-gray-500">
        No active encounters found. Please create an encounter first.
      </div>
    );
  }

  // Helper to parse generated markdown note into sections
  const parseNoteToFields = (markdown: string) => {
    const fields = getTemplateFields(activeTemplate);
    
    const extracted: Record<string, string> = {};
    if (markdown) {
      let currentSection = fields[0]?.key || 'chief_complaint';
      extracted[currentSection] = '';
      
      const lines = markdown.split('\n');
      for (const line of lines) {
        // match "* **Header**" or "**Header**:" or "### Header"
        const headerMatch = line.match(/^[\*\s#]*\**\s*([A-Z][a-zA-Z\s]+?)\s*\**\s*:?\s*$/);
        
        // If it looks like a header, and isn't a "Not recorded" line
        if (headerMatch && headerMatch[1].length < 40 && !line.toLowerCase().includes('not recorded')) {
          const header = headerMatch[1].trim();
          const field = fields.find(f => header.toLowerCase().includes(f.match.toLowerCase()));
          
          if (field) {
            currentSection = field.key;
          } else if (header.toLowerCase().includes('history') || header.toLowerCase().includes('risk factor') || header.toLowerCase().includes('symptom')) {
            currentSection = fields.find(f => f.key.includes('history'))?.key || currentSection;
          } else if (header.toLowerCase().includes('exam') || header.toLowerCase().includes('vital')) {
            currentSection = fields.find(f => f.key.includes('exam'))?.key || currentSection;
          } else if (header.toLowerCase().includes('diagnosis') || header.toLowerCase().includes('assessment') || header.toLowerCase().includes('investigation')) {
            currentSection = fields.find(f => f.key.includes('assess') || f.key.includes('diag'))?.key || currentSection;
          } else if (header.toLowerCase().includes('plan') || header.toLowerCase().includes('treatment')) {
            currentSection = fields.find(f => f.key.includes('plan'))?.key || currentSection;
          }
          if (!extracted[currentSection]) extracted[currentSection] = '';
        } else {
          // It's a content line
          if (line.trim() && line.trim().toLowerCase() !== 'not recorded.' && line.trim().toLowerCase() !== 'none.') {
            extracted[currentSection] += line + '\n';
          }
        }
      }
    }

    return fields.map(f => ({
      ...f,
      value: extracted[f.key] ? extracted[f.key].replace(/^\*\s*/gm, '• ').trim() : ''
    }));
  };

  const formFields = parseNoteToFields(generatedNote || '');

  return (
    <>
      <style>{`
        .scribe-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Header ── */
        .scribe-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .scribe-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }
        .scribe-subtitle {
          font-size: 0.875rem;
          color: #6B7280;
          margin-top: 4px;
        }
        .header-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .rec-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #E5E7EB;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .rec-indicator.active {
          color: #DC2626;
          border-color: #FECACA;
          background: #FEF2F2;
        }
        .rec-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #DC2626;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }

        /* ── Patient Card ── */
        .patient-card {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .patient-info-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .patient-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #FFF7ED;
          color: #E8871E;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.1rem;
        }
        .patient-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
        }
        .patient-meta {
          font-size: 0.8rem;
          color: #6B7280;
          margin-top: 2px;
        }
        .patient-details-grid {
          display: flex;
          gap: 32px;
          margin-left: 32px;
          padding-left: 32px;
          border-left: 1px solid #E5E7EB;
        }
        .detail-item {
          display: flex;
          flex-direction: column;
        }
        .detail-label {
          font-size: 0.75rem;
          color: #9CA3AF;
        }
        .detail-value {
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-top: 2px;
        }
        .btn-emr {
          padding: 8px 16px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          background: #fff;
          font-size: 0.875rem;
          font-weight: 500;
          color: #0A6253;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        /* ── Main Layout ── */
        .scribe-grid {
          display: grid;
          grid-template-columns: 350px 1fr 300px;
          gap: 20px;
          height: calc(100vh - 240px);
        }

        .panel {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .panel-header {
          padding: 16px;
          border-bottom: 1px solid #F3F4F6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #FDFDFD;
        }
        .panel-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── Transcription Panel ── */
        .transcript-body {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #F9FAFB;
        }
        .msg-doc {
          font-size: 0.9rem;
          color: #1F2937;
          line-height: 1.5;
        }
        .controls-area {
          padding: 20px;
          border-top: 1px solid #E5E7EB;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #fff;
        }
        .record-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #fff;
          transition: transform 0.2s;
        }
        .record-btn.start { background: #DC2626; }
        .record-btn.stop { background: #1F2937; }
        .record-btn:active { transform: scale(0.95); }

        .note-body {
          flex: 1;
          overflow-y: auto;
          padding: 0 16px;
        }
        .form-row {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px solid #F3F4F6;
        }
        .form-row:last-child {
          border-bottom: none;
        }
        .form-label-col {
          width: 140px;
          flex-shrink: 0;
          padding-top: 4px;
        }
        .form-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #4B5563;
        }
        .form-label-sub {
          font-size: 0.65rem;
          color: #9CA3AF;
          margin-top: 2px;
          display: block;
        }
        .form-val-col {
          flex: 1;
          position: relative;
          min-width: 0;
        }
        .form-val-edit {
          font-size: 0.82rem;
          color: #111827;
          line-height: 1.5;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid transparent;
          min-height: 28px;
          outline: none;
          white-space: pre-wrap;
          transition: all 0.2s;
        }
        .form-val-edit:hover {
          background: #F9FAFB;
        }
        .form-val-edit:focus {
          background: #fff;
          border-color: #0A6253;
          box-shadow: 0 0 0 2px rgba(10,98,83,0.1);
        }
        .form-val-edit.empty {
          color: #D1D5DB;
        }
        .edit-icon-btn {
          position: absolute;
          right: 0;
          top: 6px;
          color: #9CA3AF;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        }
        .form-row:hover .edit-icon-btn {
          opacity: 1;
        }
        .pill-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          background: #F0FDF4;
          color: #166534;
          margin-right: 6px;
          margin-bottom: 4px;
        }
        .note-footer {
          padding: 16px;
          border-top: 1px solid #E5E7EB;
          display: flex;
          justify-content: space-between;
          background: #FDFDFD;
        }
        .btn-primary {
          background: #0A6253;
          color: #fff;
          border: none;
          padding: 8px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        /* ── Right Sidebar ── */
        .sidebar-section {
          padding: 16px;
          border-bottom: 1px solid #E5E7EB;
        }
        .sidebar-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 12px;
        }
        .template-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          color: #4B5563;
        }
        .template-item.active {
          background: #E8F5F0;
          color: #0A6253;
          font-weight: 600;
        }
        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.85rem;
          color: #4B5563;
        }
      `}</style>

      <div className="scribe-container">
        <div className="scribe-header">
          <div>
            <h1 className="scribe-title">AI Scribe</h1>
            <p className="scribe-subtitle">AI-powered clinical documentation with specialty templates</p>
          </div>
          <div className="header-controls">
            <div className={`rec-indicator ${isRecording ? 'active' : ''}`}>
              {isRecording ? <div className="rec-dot" /> : <Mic size={14} />}
              {isRecording ? 'Recording' : 'Ready'} {formatTime(recordingTime)}
            </div>
            <div className="relative lang-selector-container z-50">
              <button 
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <Globe size={16} className="text-[#0A6253]" />
                {selectedLang}
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isLangOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50 py-2 z-50 transition-all opacity-100 scale-100">
                  <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                    Select Language
                  </div>
                  <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        onClick={() => { setSelectedLang(lang); setIsLangOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${selectedLang === lang ? 'text-[#0A6253] font-bold bg-emerald-50/50' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {lang}
                        {selectedLang === lang && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="patient-card">
          <div className="patient-info-left">
            <div className="patient-avatar">
              {encounter.patient_name?.[0] || 'P'}
            </div>
            <div>
              <div className="patient-name">{encounter.patient_name}</div>
              <div className="patient-meta">
                MRN: {encounter.patient || 'Unknown'}
              </div>
            </div>
            <div className="patient-details-grid">
              <div className="detail-item">
                <span className="detail-label">Visit Type</span>
                <span className="detail-value">{encounter.encounter_type || 'Consultation'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date & Time</span>
                <span className="detail-value">{new Date(encounter.created_at).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Doctor</span>
                <span className="detail-value">{encounter.doctor}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative encounter-selector-container z-40">
              <button 
                onClick={() => setIsEncounterOpen(!isEncounterOpen)}
                className="flex items-center justify-between gap-3 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-[#0A6253] transition-all min-w-[280px] shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <User size={16} className="text-[#0A6253]" />
                  <span className="truncate">
                    {encounter ? `${encounter.patient_name} — ${encounter.encounter_type} (${new Date(encounter.created_at).toLocaleDateString()})` : 'Select Encounter'}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${isEncounterOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isEncounterOpen && (
                <div className="absolute right-0 top-full mt-2 w-full min-w-[300px] bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50 py-2 z-50 transition-all opacity-100 scale-100">
                  <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                    Active Encounters
                  </div>
                  <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                    {encounterList.map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setSelectedEncounterId(e.id); setIsEncounterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${selectedEncounterId === e.id ? 'text-[#0A6253] font-bold bg-emerald-50/50' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <span className="truncate pr-4 flex flex-col">
                          <span>{e.patient_name}</span>
                          <span className="text-xs text-gray-400 font-normal">{e.encounter_type} • {new Date(e.created_at).toLocaleDateString()}</span>
                        </span>
                        {selectedEncounterId === e.id && <Check size={16} className="flex-shrink-0 text-[#0A6253]" />}
                      </button>
                    ))}
                    {encounterList.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">No active encounters</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="btn-emr whitespace-nowrap">
              Open in EMR
            </button>
          </div>
        </div>

        <div className="scribe-grid">
          {/* Left: Transcription */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                Live Transcription
                {isRecording && <span className="w-2 h-2 rounded-full bg-green-500 ml-2"></span>}
              </span>
            </div>
            <div className="transcript-body">
              {transcript ? (
                <div className="msg-doc whitespace-pre-wrap">{transcript}</div>
              ) : (
                <div className="text-gray-400 text-center mt-10 text-sm">
                  {isRecording ? 'Listening...' : 'Press record to start transcription'}
                </div>
              )}
            </div>
            <div className="controls-area">
              {isProcessing && <div className="mb-4 text-sm text-blue-600">Processing audio...</div>}
              {!isRecording ? (
                <button className="record-btn start" onClick={startRecording} disabled={isProcessing}>
                  <Mic size={24} />
                </button>
              ) : (
                <button className="record-btn stop" onClick={stopRecording}>
                  <Square size={20} />
                </button>
              )}
              <div className="text-xs text-gray-500 mt-2">
                {!isRecording ? 'Start Recording' : 'Stop Recording'}
              </div>
            </div>
          </div>

          {/* Middle: AI Generated Note */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">AI Generated Note</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100">
                  <span className="text-gray-400">Template</span>
                  <span className="font-medium text-gray-800">
                    {TEMPLATES.find(t => t.id === activeTemplate)?.name || 'General'}
                  </span>
                  <ChevronDown size={14} />
                </div>
                {generatedNote && (
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium border border-green-200 flex items-center gap-1">
                    Confidence <span className="bg-green-100 text-green-800 px-1.5 rounded text-[10px]">High</span>
                  </span>
                )}
              </div>
            </div>
            <div className="note-body">
              <div className="flex flex-col">
                {formFields.map((field) => {
                  const isEmpty = !field.value;
                  const isSuggestion = ['assessment', 'plan'].includes(field.key);
                  return (
                    <div key={field.key} className="form-row">
                      <div className="form-label-col">
                        <span className="form-label">{field.label}</span>
                        {isSuggestion && field.key !== 'plan' && <span className="form-label-sub">(AI Suggestion)</span>}
                        {field.key === 'plan' && <span className="form-label-sub">(Manual)</span>}
                      </div>
                      <div className="form-val-col">
                        {field.key === 'plan' ? (
                          <div className="flex flex-col gap-2 w-full mt-1">
                            {manualMedications.map((m, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded text-sm">
                                <div>
                                  <span className="font-medium text-gray-900">{m.drug_name}</span>
                                  <span className="text-gray-500 ml-2">{m.dosage} {m.frequency} x {m.duration} (Qty: {m.quantity})</span>
                                </div>
                                <button onClick={() => setManualMedications(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            {manualMedications.length === 0 && (
                              <div className="text-gray-400 text-sm italic">No medications added yet.</div>
                            )}
                            <button
                              onClick={() => setShowMedicationPopup(true)}
                              className="mt-2 text-sm text-teal-700 font-medium flex items-center gap-1 hover:text-teal-800"
                            >
                              <Plus size={16} /> Add Medication
                            </button>
                          </div>
                        ) : field.key === 'lab_tests' ? (
                          <div className="flex flex-col gap-2 w-full mt-1">
                            {manualLabs.map((lab, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded text-sm">
                                <div>
                                  <span className="font-medium text-gray-900">{lab.panel_name}</span>
                                  <span className="text-gray-500 ml-2">{lab.category} · ₹{lab.price}</span>
                                  {lab.priority !== 'ROUTINE' && (
                                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      lab.priority === 'STAT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>{lab.priority}</span>
                                  )}
                                </div>
                                <button onClick={() => setManualLabs(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            {manualLabs.length === 0 && (
                              <div className="text-gray-400 text-sm italic">No lab tests added yet.</div>
                            )}
                            <button
                              onClick={() => setShowLabPopup(true)}
                              className="mt-2 text-sm text-purple-700 font-medium flex items-center gap-1 hover:text-purple-800"
                            >
                              <Plus size={16} /> Add Lab Test
                            </button>
                          </div>
                        ) : (
                          <>
                            <div 
                              className={`form-val-edit ${isEmpty ? 'empty' : ''}`}
                              contentEditable
                              suppressContentEditableWarning
                            >
                              {field.value || ''}
                            </div>
                            <Edit2 size={14} className="edit-icon-btn" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-center py-2 text-xs text-gray-400 bg-[#FDFDFD]">
              AI suggestions. Please review and confirm before saving.
            </div>
            <div className="note-footer">
              <button className="px-5 py-2 text-sm text-gray-600 font-medium hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                Clear
              </button>
              <div className="flex gap-3">
                <button
                  className="px-5 py-2 text-sm text-teal-700 font-medium hover:bg-teal-50 flex items-center gap-2 rounded-lg transition-colors border border-transparent disabled:opacity-50"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !transcript}
                >
                  {isRegenerating ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : <Settings2 size={16} />}
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleConfirm}
                  disabled={!noteId}
                  style={{ opacity: noteId ? 1 : 0.5 }}
                >
                  Review & Sign
                </button>
              </div>
            </div>
          </div>

          {/* Right: Settings & Templates */}
          <div className="panel">
            <div className="sidebar-section">
              <div className="sidebar-title flex justify-between items-center">
                Templates
                <span className="text-xs text-teal-700 font-medium bg-teal-50 px-2 py-1 rounded-full cursor-pointer hover:bg-teal-100">View all</span>
              </div>
              <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2">
                {TEMPLATES.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setActiveTemplate(t.id)}
                    className={`template-item ${activeTemplate === t.id ? 'active' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={14} /> {t.name}
                    </span>
                    {activeTemplate === t.id && <Check size={14} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section border-b-0 flex-1">
              <div className="sidebar-title">AI Scribe Settings</div>
              <div className="toggle-row">
                <span>Auto punctuation</span>
                <input type="checkbox" defaultChecked className="accent-teal-700 w-4 h-4" />
              </div>
              <div className="toggle-row">
                <span>Medical terms enhancement</span>
                <input type="checkbox" defaultChecked className="accent-teal-700 w-4 h-4" />
              </div>
              <div className="toggle-row">
                <span>Suggest plan</span>
                <input type="checkbox" defaultChecked className="accent-teal-700 w-4 h-4" />
              </div>
              <div className="toggle-row">
                <span>Auto summary</span>
                <input type="checkbox" className="accent-teal-700 w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Medication Modal ─────────────────────────────────────── */}
      {showMedicationPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="font-semibold text-gray-900">Add Medication</h3>
              <button onClick={() => setShowMedicationPopup(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search Drug (Hospital Catalog)</label>
                <DrugAutocomplete
                  value={medForm.drug_name}
                  onChange={(val) => setMedForm(p => ({ ...p, drug_name: val }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                  <input 
                    type="text" 
                    value={medForm.dosage} 
                    onChange={e => setMedForm(p => ({ ...p, dosage: e.target.value }))}
                    placeholder="e.g. 500mg"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                  <input 
                    type="text" 
                    value={medForm.frequency} 
                    onChange={e => setMedForm(p => ({ ...p, frequency: e.target.value }))}
                    placeholder="e.g. 1-0-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                  <input 
                    type="text" 
                    value={medForm.duration} 
                    onChange={e => setMedForm(p => ({ ...p, duration: e.target.value }))}
                    placeholder="e.g. 5 days"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total Quantity</label>
                  <input 
                    type="number" 
                    value={medForm.quantity} 
                    onChange={e => setMedForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
                <button 
                  onClick={() => setShowMedicationPopup(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!medForm.drug_name) return alert('Please enter a drug name');
                    setManualMedications(prev => [...prev, { ...medForm, matched: true }]);
                    setShowMedicationPopup(false);
                    setMedForm({ drug_name: '', dosage: '', frequency: '', duration: '', quantity: 1, unit_price: 0 });
                  }}
                  className="px-4 py-2 text-sm bg-teal-700 text-white rounded-lg hover:bg-teal-800 font-medium"
                >
                  Add to Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Add Lab Test Modal ──────────────────────────────────────── */}
      {showLabPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="font-semibold text-gray-900">Add Lab Test</h3>
              <button onClick={() => setShowLabPopup(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search Lab Test (Hospital Catalog)</label>
                <LabPanelSelector
                  value={labForm.panel_id}
                  onChange={(id) => {
                    setLabForm(p => ({ ...p, panel_id: id }));
                  }}
                  onPanelSelect={(panel) => {
                    setLabForm(p => ({ ...p, panel_id: panel.id, panel_name: panel.name, price: panel.price || 0, category: panel.category }));
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={labForm.priority}
                    onChange={e => setLabForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
                <button 
                  onClick={() => setShowLabPopup(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!labForm.panel_id) return alert('Please select a lab test');
                    setManualLabs(prev => [...prev, {
                      panel_id: labForm.panel_id,
                      panel_name: labForm.panel_name,
                      price: labForm.price,
                      category: labForm.category,
                      priority: labForm.priority,
                      matched: true,
                    }]);
                    setShowLabPopup(false);
                    setLabForm({ panel_id: '', panel_name: '', price: 0, category: '', priority: 'ROUTINE' });
                  }}
                  className="px-4 py-2 text-sm bg-purple-700 text-white rounded-lg hover:bg-purple-800 font-medium"
                >
                  Add to Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ── Extraction Review Modal ──────────────────────────────────── */}
      {extraction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {extractionConfirmed
                  ? '✓ Orders Created'
                  : 'Review Extracted Orders'}
              </h2>
              <button
                onClick={() => setExtraction(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {extractionConfirmed ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <p className="text-green-700 font-medium">
                    Created {extraction.created_medication_count} medication(s) and{' '}
                    {extraction.created_lab_order_count} lab order(s) from the note.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Orders are now in the Pharmacy and Lab queues.
                  </p>
                  <button
                    onClick={handleDismissExtraction}
                    className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Medications found */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {extraction.medications.length}
                      </span>
                      Medications Found
                    </h3>
                    {extraction.medications.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No medications detected in the note.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Drug</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Dosage</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Frequency</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Duration</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Qty</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extraction.medications.map((m, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="px-3 py-2 w-64">
                                <DrugAutocomplete
                                  value={m.drug_name}
                                  onChange={(val) => {
                                    setExtraction((prev: any) => {
                                      if (!prev) return prev;
                                      const newMeds = [...prev.medications];
                                      newMeds[i] = { ...newMeds[i], drug_name: val, matched: true };
                                      return { ...prev, medications: newMeds };
                                    });
                                  }}
                                  disabled={extractionLoading}
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-600">{m.dosage}</td>
                              <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                              <td className="px-3 py-2 text-gray-600">{m.duration || '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{m.quantity}</td>
                              <td className="px-3 py-2">
                                {m.matched ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    In Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700" title="Not found in DrugInventory — will be added as free-text">
                                    Not in Stock
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Lab tests found */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                        {extraction.lab_orders.length}
                      </span>
                      Lab Tests Found
                    </h3>
                    {extraction.lab_orders.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No lab tests detected in the note.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Test</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Price</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extraction.lab_orders.map((l, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="px-3 py-2 font-medium text-gray-900">{l.test_name}</td>
                              <td className="px-3 py-2 text-gray-600">₹{l.price}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  Available
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleDismissExtraction}
                      className="px-5 py-2 text-sm text-gray-600 font-medium hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                    >
                      Skip — Manual Entry
                    </button>
                    <button
                      onClick={handleConfirmExtraction}
                      disabled={extractionLoading}
                      className="bg-teal-700 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {extractionLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Creating...
                        </>
                      ) : (
                        `Create ${extraction.medications.filter(m => m.matched).length} Meds & ${extraction.lab_orders.length} Labs`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AIScribe;
