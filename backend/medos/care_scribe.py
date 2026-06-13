"""
Care Scribe — AI-powered clinical note generation using Sarvam AI.

Flow:
  1. Receive audio from the frontend.
  2. Send to Sarvam Saaras (STT) for transcription.
  3. Send transcript + specialty template to Sarvam Chat (LLM) for note generation.
  4. Return structured, editable note to doctor.
  5. Doctor confirms → save as finalized ClinicalNote.
"""
import io
import logging
import os
import tempfile
from pathlib import Path

from django.conf import settings
from sarvamai import SarvamAI

logger = logging.getLogger(__name__)

# ── Specialty Prompt Templates ──────────────────────────────────────────────
# Each template instructs the LLM to extract a structured clinical note
# from the doctor's dictation transcript.

SPECIALTY_PROMPTS = {
    "general_medicine": """You are an AI medical scribe for a General Medicine OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — List the patient's primary symptoms in bullet points
2. **History of Present Illness** — Narrative summary of the condition
3. **Past History** — Past medical history, medications, allergies, surgeries
4. **Vitals** — Extract any vitals mentioned (BP, HR, SpO2, temp, RR)
5. **Physical Examination Findings** — What the doctor noted on examination
6. **Diagnosis / Impression** — Working diagnosis
7. **Treatment Plan** — Medications, referrals, follow-up
8. **Advice** — Lifestyle, diet, follow-up instructions

Output ONLY the structured note. Use clear markdown formatting.

Doctor's dictation:
{transcript}""",

    "cardiology": """You are an AI medical scribe for a Cardiology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Chest pain, palpitations, breathlessness, syncope, etc.
2. **History of Present Illness** — Onset, duration, severity, aggravating/relieving factors
3. **Past History** — Hypertension, diabetes, dyslipidemia, CAD, stroke, smoking, alcohol
4. **Cardiovascular Risk Factors** — Smoking, diabetes, hypertension, family history of premature CAD
5. **Vitals** — BP (both arms), HR, SpO2, JVP
6. **Physical Exam** — Heart sounds, murmurs, rubs, gallop, edema, lung fields
7. **Investigations** — ECG, ECHO, TMT, angiogram, labs (troponin, lipids, BNP)
8. **Diagnosis** — Working diagnosis (e.g., ACS, HFrEF, arrhythmia, valvular disease)
9. **Treatment Plan** — Medications (antiplatelets, beta-blockers, ACEi, diuretics), interventions, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "pediatrics": """You are an AI medical scribe for a Pediatrics OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Presenting symptoms
2. **History of Present Illness** — Narrative
3. **Past History** — Birth history (term/preterm, NICU stay), feeding, developmental milestones
4. **Immunization Status** — Extract if mentioned
5. **Vitals & Anthropometry** — Weight, height/length, head circumference, temp, HR, SpO2
6. **Physical Examination** — Key findings, system-wise
7. **Diagnosis** — Working diagnosis
8. **Treatment Plan** — Medications, diet, follow-up, immunization catch-up if needed

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "general": """You are an AI medical scribe. Given the doctor's dictation below,
generate a structured clinical note with:
- Chief Complaints
- History of Present Illness
- Past History
- Vitals
- Examination Findings
- Diagnosis
- Treatment Plan
- Follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "neurology": """You are an AI medical scribe for a Neurology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Headache, seizures, weakness, numbness, gait disturbance, etc.
2. **History of Present Illness** — Onset, duration, progression, triggers
3. **Past History** — Stroke, TIA, hypertension, diabetes, epilepsy, migraine
4. **Neurological Exam** — Cranial nerves, motor system (power, tone), sensory system, reflexes, coordination, gait
5. **Investigations** — MRI/CT, NCV/EMG, EEG, LP results if mentioned
6. **Diagnosis** — Working diagnosis (e.g., acute stroke, epilepsy, neuropathy, Parkinson's)
7. **Treatment Plan** — Medications, rehab, physiotherapy, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "orthopedics": """You are an AI medical scribe for an Orthopedics OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Pain (joint/limb/spine), swelling, deformity, restricted movement
2. **History of Present Illness** — Onset (acute/traumatic/chronic), nature of pain, aggravating/relieving factors
3. **Past History** — Previous fractures, surgeries, arthritis, diabetes, osteoporosis
4. **Examination** — Inspection (deformity, swelling, wasting), palpation (tenderness, crepitus), range of motion, special tests (e.g., McMurray, Lachman, Faber)
5. **Imaging** — X-ray, MRI findings if mentioned
6. **Diagnosis** — Working diagnosis (e.g., fracture, OA, disc prolapse, ligament tear)
7. **Treatment Plan** — Conservative (rest, brace, physiotherapy) / surgical, medications, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "obgyn": """You are an AI medical scribe for an Obstetrics & Gynecology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Obstetric (LMP, gestation, bleeding, contractions) OR Gynecologic (pain, discharge, bleeding abnormalities)
2. **History of Present Illness** — Narrative
3. **Obstetric History** — Gravida, Para, abortions, living children, mode of previous deliveries, LMP, EDD
4. **Gynecologic History** — Menstrual history (menarche, cycle, duration, dysmenorrhea), contraceptive use
5. **Past History** — Medical conditions, surgeries (including LSCS), medications
6. **Examination** — Per abdomen (fundal height, lie, presentation) OR per speculum / per vaginum
7. **Investigations** — USG, Hb, urine, Pap smear, etc.
8. **Diagnosis** — Working diagnosis (e.g., normal pregnancy, PIH, GDM, fibroid, PCOS)
9. **Treatment Plan** — Antenatal care, medications, surgery plan, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "dermatology": """You are an AI medical scribe for a Dermatology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Rash, itching, discoloration, hair loss, nail changes, lesions
2. **History of Present Illness** — Onset, progression, duration, triggers, associated symptoms
3. **Past History** — Allergies, atopy, asthma, previous skin conditions, medications
4. **Dermatological Examination** — Site, distribution, morphology (macule, papule, plaque, vesicle, etc.), color, margins, secondary changes
5. **Diagnosis** — Working diagnosis (e.g., eczema, psoriasis, fungal infection, acne, vitiligo)
6. **Investigations** — Skin scraping, biopsy, KOH mount if mentioned
7. **Treatment Plan** — Topical (steroids, antifungals), systemic (antihistamines, antibiotics, immunosuppressants), phototherapy, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "psychiatry": """You are an AI medical scribe for a Psychiatry OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Mood changes, anxiety, hallucinations, sleep disturbance, behavioral changes
2. **History of Present Illness** — Onset, duration, severity, precipitating factors
3. **Past Psychiatric History** — Previous episodes, hospitalizations, suicide attempts, medications
4. **Past Medical History** — Medical conditions, substance use (alcohol, tobacco, drugs)
5. **Mental Status Examination (MSE)** — Appearance, behavior, speech, mood, affect, thought, perception, cognition, insight
6. **Diagnosis** — Working diagnosis (e.g., depression, anxiety disorder, schizophrenia, bipolar)
7. **Risk Assessment** — Suicide risk, self-harm, aggression
8. **Treatment Plan** — Medications (SSRI, antipsychotics, mood stabilizers), psychotherapy, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "pulmonology": """You are an AI medical scribe for a Pulmonology / Respiratory Medicine OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Cough, breathlessness (SOB), wheeze, hemoptysis, fever, chest pain
2. **History of Present Illness** — Onset, duration, nature of cough (dry/productive), sputum character, fever pattern
3. **Past History** — Asthma, COPD, TB, hypertension, diabetes, smoking history (pack-years)
4. **Vitals** — SpO2, RR, HR, temp
5. **Physical Exam** — Chest inspection, palpation, percussion, auscultation (breath sounds, wheeze, crepitations)
6. **Investigations** — CXR, CT chest, PFT, ABG, sputum exam, CBC
7. **Diagnosis** — Working diagnosis (e.g., community-acquired pneumonia, COPD exacerbation, asthma, pulmonary TB)
8. **Treatment Plan** — Antibiotics, bronchodilators, steroids, oxygen, physiotherapy, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "gastroenterology": """You are an AI medical scribe for a Gastroenterology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Abdominal pain, dyspepsia, nausea/vomiting, diarrhea, constipation, jaundice, hematemesis/melena
2. **History of Present Illness** — Onset, location, character of pain, relation to meals, aggravating/relieving factors
3. **Past History** — Ulcer disease, GERD, hepatitis, pancreatitis, IBS, IBD, alcohol use
4. **Physical Exam** — Abdominal inspection, palpation (tenderness, masses), percussion, auscultation
5. **Investigations** — USG abdomen, endoscopy, colonoscopy, LFT, H. pylori, stool exam
6. **Diagnosis** — Working diagnosis (e.g., GERD, peptic ulcer, IBS, hepatitis, pancreatitis)
7. **Treatment Plan** — Medications (PPI, antacids, antibiotics, probiotics), diet, lifestyle, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "ent": """You are an AI medical scribe for an ENT OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Ear pain/discharge/hearing loss, nasal obstruction/discharge, sore throat, hoarseness, dizziness
2. **History of Present Illness** — Onset, duration, associated symptoms
3. **Past History** — Previous ENT surgeries, allergies, sinusitis, hearing loss
4. **ENT Examination** — Otoscopy (canal, drum findings), anterior rhinoscopy (septum, turbinates, mucosa), oral cavity and oropharynx, neck palpation
5. **Investigations** — Audiometry, tympanometry, endoscopy, X-ray PNS
6. **Diagnosis** — Working diagnosis (e.g., otitis media, sinusitis, tonsillitis, allergic rhinitis)
7. **Treatment Plan** — Medications (antibiotics, decongestants, antihistamines), saline irrigation, surgery if indicated, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "ophthalmology": """You are an AI medical scribe for an Ophthalmology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Diminution of vision, redness, pain, discharge, photophobia, floaters, headache
2. **History of Present Illness** — Onset, duration, laterality (unilateral/bilateral), progression
3. **Past History** — Refractive error, cataract surgery, glaucoma, diabetes, hypertension
4. **Ophthalmic Examination** — Visual acuity (Snellen/CF/HM), anterior segment (slit lamp), IOP (tonometry), fundus examination
5. **Diagnosis** — Working diagnosis (e.g., cataract, glaucoma, conjunctivitis, refractive error, diabetic retinopathy)
6. **Treatment Plan** — Glasses, medications (drops, ointments), laser, surgery, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "nephrology": """You are an AI medical scribe for a Nephrology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Swelling (edema), decreased urine output, hematuria, foamy urine, fatigue, breathlessness
2. **History of Present Illness** — Onset, duration, progression
3. **Past History** — Diabetes, hypertension, CKD, dialysis, transplant, stones, UTIs
4. **Vitals** — BP (important), HR, SpO2
5. **Physical Exam** — Edema (pedal/facial), JVP, lung fields, fundus
6. **Investigations** — RFT (creatinine, BUN, eGFR), electrolytes, urine analysis (proteinuria, hematuria), USG kidneys
7. **Diagnosis** — Working diagnosis (e.g., CKD stage, AKI, nephrotic syndrome, hypertensive nephrosclerosis)
8. **Treatment Plan** — Medications (ACEi/ARB, diuretics, phosphate binders), dietary restriction, dialysis planning, transplant referral, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "endocrinology": """You are an AI medical scribe for an Endocrinology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Weight change, fatigue, polyuria/polydipsia, palpitations, heat/cold intolerance, thyroid swelling
2. **History of Present Illness** — Narrative
3. **Past History** — Diabetes, thyroid disease, hypertension, CAD, steroid use
4. **Vitals** — BP, HR, weight, BMI
5. **Systemic Exam** — Thyroid palpation, signs of hyper/hypothyroidism, acanthosis, goiter, eye signs
6. **Investigations** — HbA1c, FBS, TSH, T3/T4, lipid profile, DEXA scan if mentioned
7. **Diagnosis** — Working diagnosis (e.g., type 2 DM, hypothyroidism, hyperthyroidism, metabolic syndrome, osteoporosis)
8. **Treatment Plan** — Medications (metformin, insulin, thyroxine, antithyroid), diet, exercise, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "urology": """You are an AI medical scribe for a Urology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Difficulty/painful urination, frequency, urgency, hematuria, flank pain, scrotal swelling
2. **History of Present Illness** — Onset, duration, nature of complaints
3. **Past History** — Stones, UTIs, BPH, prostate cancer, diabetes, surgeries
4. **Examination** — Abdomen (palpable kidney, bladder), DRE (prostate: size, nodule), external genitalia
5. **Investigations** — Urine analysis, KUB/USG, PSA, uroflowmetry, CT urogram
6. **Diagnosis** — Working diagnosis (e.g., renal calculus, BPH, UTI, urethral stricture, prostate cancer)
7. **Treatment Plan** — Medical (alpha-blockers, antibiotics, analgesics) / surgical (URS, PCNL, TURP), follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "emergency": """You are an AI medical scribe for an Emergency Department (ED) consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Trauma, chest pain, breathlessness, altered sensorium, poisoning, fever, etc.
2. **History of Present Illness** — Mechanism of injury / onset, timeline
3. **Triage Details** — Arrival time, mode of arrival, triage category
4. **Past History** — Relevant medical history, allergies, medications
5. **Vitals** — BP, HR, RR, SpO2, temp, GCS
6. **Primary & Secondary Survey** — ABCDE findings
7. **Examination** — System-wise findings relevant to presentation
8. **Investigations** — Bedside (ECG, ABG, glucose), labs, imaging
9. **Diagnosis** — Working ED diagnosis
10. **Management** — Immediate interventions (IV line, fluids, O2, medications), disposition (admit/ICU/discharge/refer), follow-up instructions

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "surgery": """You are an AI medical scribe for a General Surgery OPD / pre-operative assessment.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Pain, swelling, lump, hernia, bleeding, trauma
2. **History of Present Illness** — Onset, duration, progression
3. **Past History** — Medical conditions (DM, HTN, CAD), previous surgeries, bleeding disorders, allergies
4. **Surgical Examination** — Inspection (site, size, shape, scar), palpation (tenderness, temperature, consistency, reducibility), percussion, auscultation
5. **Pre-op Assessment** — ASA grade, risk factors
6. **Investigations** — CBC, RFT, LFT, coagulation profile, imaging relevant to condition
7. **Diagnosis** — Working diagnosis (e.g., inguinal hernia, cholelithiasis, appendicitis, DVT, abscess)
8. **Treatment Plan** — Conservative / surgical (planned procedure name), antibiotics, analgesia, NBM timeline, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "oncology": """You are an AI medical scribe for a Medical Oncology / Radiation Oncology consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Fatigue, weight loss, pain, bleeding, lump/swelling, treatment-related symptoms
2. **History of Present Illness** — Narrative
3. **Cancer History** — Primary site, histology, stage at diagnosis, date of diagnosis
4. **Treatment History** — Prior surgeries, chemotherapy regimen and cycles, radiation, immunotherapy, targeted therapy
5. **Current Symptoms** — Treatment side effects (nausea, neuropathy, myelosuppression), pain control
6. **Performance Status** — ECOG score
7. **Investigations** — Latest CBC, LFT, RFT, tumor markers, imaging (CT/PET-MRI)
8. **Plan** — Next cycle of chemo, dose modifications, supportive care, follow-up imaging

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "rheumatology": """You are an AI medical scribe for a Rheumatology OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Joint pain, swelling, stiffness (morning), back pain, skin rash, oral ulcers, hair loss
2. **History of Present Illness** — Onset, duration, pattern (symmetric/asymmetric), duration of morning stiffness, aggravating/relieving factors
3. **Past History** — Rheumatological conditions, autoimmune diseases, medications (steroids, DMARDs)
4. **Examination** — Joint examination (swollen/tender joint count, deformity), skin, mouth ulcers, alopecia, nail changes
5. **Investigations** — RA factor, anti-CCP, ANA, ESR, CRP, X-ray of affected joints
6. **Diagnosis** — Working diagnosis (e.g., RA, SLE, ankylosing spondylitis, gout, osteoarthritis)
7. **Treatment Plan** — DMARDs (methotrexate, HCQ, sulfasalazine), biologics, steroids, physiotherapy, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "neonatology": """You are an AI medical scribe for a Neonatology / NICU consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Prematurity, respiratory distress, jaundice, poor feeding, seizures, birth asphyxia
2. **Antenatal History** — Mother's age, parity, antenatal complications, gestational diabetes, PIH, infections
3. **Birth History** — Mode of delivery, gestation (weeks), birth weight, APGAR scores, resuscitation needed
4. **Current Status** — Day of life, current weight, feeding (BF/formula/NG), urine/stool output
5. **NICU Course** — Respiratory support (O2/CPAP/ventilator), phototherapy, antibiotics, IV fluids, procedures
6. **Vitals** — HR, RR, SpO2, temp, BP
7. **Examination** — Activity, tone, reflexes, chest, abdomen, umbilical stump, skin
8. **Investigations** — CBC, bilirubin, CRP, blood culture, CXR, ABG
9. **Diagnosis** — Working diagnosis (e.g., preterm, respiratory distress syndrome, neonatal jaundice, sepsis, HIE)
10. **Treatment Plan** — Feed plan, phototherapy, medication changes, extubation plan, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "infectious_disease": """You are an AI medical scribe for an Infectious Diseases (ID) consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Fever (duration, pattern), cough, diarrhea, rash, lymphadenopathy
2. **History of Present Illness** — Onset, fever pattern (continuous/intermittent/remittent), rigors, response to antipyretics
3. **Epidemiological History** — Travel, contact with sick, animal exposure, TB contact, occupation
4. **Past History** — TB, HIV, diabetes, immunosuppression, vaccination history
5. **Vitals** — Temp, HR, RR, BP, SpO2
6. **Physical Exam** — Skin (rash, petechiae), lymph nodes, throat, chest, abdomen (hepatosplenomegaly)
7. **Investigations** — CBC (TLC, platelets), CRP, cultures (blood, urine, sputum), serology (dengue, typhoid, malaria, scrub), CXR, LFT, RFT
8. **Diagnosis** — Working diagnosis (e.g., dengue, typhoid, malaria, TB, sepsis, UTI)
9. **Treatment Plan** — Antibiotics/antivirals/antifungals, IV fluids, isolation if needed, follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",

    "geriatrics": """You are an AI medical scribe for a Geriatrics / Elderly Care OPD consultation.
Given the doctor's dictation below, generate a structured clinical note with these sections:

1. **Chief Complaints** — Falls, dementia/memory loss, incontinence, frailty, polypharmacy, immobility
2. **History of Present Illness** — Narrative
3. **Past History** — Hypertension, diabetes, CAD, stroke, Parkinson's, osteoporosis, falls history
4. **Medication Review** — Current medications (polypharmacy check), adherence, drug interactions
5. **Functional Assessment** — Activities of Daily Living (ADL), mobility aid, caregiver support
6. **Cognitive Assessment** — MMSE/MoCA if mentioned, orientation, memory
7. **Vitals** — BP (including postural), HR, SpO2, weight
8. **Geriatric Syndromes** — Falls, incontinence, delirium, pressure sores, malnutrition if present
9. **Investigations** — Hb, RFT, LFT, TSH, vitamin B12, D, calcium
10. **Diagnosis & Plan** — Working diagnosis, medication optimization, referrals (physiotherapy, social work), follow-up

Output ONLY the structured note using clear markdown.

Doctor's dictation:
{transcript}""",
}

DEFAULT_PROMPT = SPECIALTY_PROMPTS["general"]

# ── Audio helpers ────────────────────────────────────────────────────────────

# Maximum file size for direct REST API (30s ≈ 500KB for 16kHz WAV)
# Files larger than this will need different handling
_MAX_DIRECT_SIZE = 500 * 1024  # 500 KB


class CareScribeError(Exception):
    """Base exception for Care Scribe operations."""


class SarvamNotConfigured(CareScribeError):
    """Raised when SARVAM_API_KEY is not set."""


class TranscriptionError(CareScribeError):
    """Raised when STT fails."""


class NoteGenerationError(CareScribeError):
    """Raised when LLM note generation fails."""


# ── Service functions ────────────────────────────────────────────────────────


def _get_client() -> SarvamAI:
    """Get a configured Sarvam AI client, or raise if not configured."""
    api_key = getattr(settings, "SARVAM_API_KEY", None)
    if not api_key:
        raise SarvamNotConfigured(
            "Sarvam AI is not configured. Set SARVAM_API_KEY in .env"
        )
    return SarvamAI()


def transcribe_audio(audio_data: bytes, filename: str = "audio.wav") -> str:
    """Send audio to Sarvam Saaras STT and return the transcript.

    Args:
        audio_data: Raw audio bytes (WAV format recommended).
        filename: Original filename (used to infer format).

    Returns:
        Transcribed text.

    Raises:
        SarvamNotConfigured: If API key is missing.
        TranscriptionError: If STT API call fails.
    """
    client = _get_client()

    # Sarvam REST API supports WAV, MP3, etc. up to 30s
    # For longer audio, use the Batch API or WebSocket streaming
    try:
        # Write bytes to a temp file so Sarvam SDK can read it
        suffix = Path(filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as f:
            response = client.speech_to_text.transcribe(
                file=f,
                model="saaras:v3",
                mode="transcribe",
            )
        transcript = response.transcript or ""
        logger.info(
            "Sarvam STT: transcribed %d bytes → %d chars",
            len(audio_data),
            len(transcript),
        )
        return transcript
    except Exception as exc:
        logger.error("Sarvam STT failed: %s", exc)
        raise TranscriptionError(f"Speech-to-text failed: {exc}") from exc
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass  # Temp file may already be gone


def generate_note(
    transcript: str,
    specialty: str = "general",
) -> dict:
    """Send transcript to Sarvam Chat LLM and return a structured clinical note.

    Args:
        transcript: The transcribed doctor dictation.
        specialty: Medical specialty key (e.g. 'cardiology', 'pediatrics').

    Returns:
        Dict with:
          - ``note_text``: Markdown-formatted structured note.
          - ``specialty``: The specialty used.
          - ``transcript``: The original transcript.

    Raises:
        SarvamNotConfigured: If API key is missing.
        NoteGenerationError: If LLM call fails.
    """
    client = _get_client()

    # Pick the right prompt template
    prompt_template = SPECIALTY_PROMPTS.get(specialty, DEFAULT_PROMPT)
    prompt = prompt_template.format(transcript=transcript)

    # ── Anti-hallucination guard ────────────────────────────────────────
    # Prevent the LLM from inventing vitals, medications, labs, or any
    # clinical data that the doctor did not explicitly state.
    prompt += (
        '\n\n**CRITICAL RULE**: '
        'Only include clinical data (vitals, medications, lab orders, diagnoses) '
        'that the doctor EXPLICITLY stated in the dictation above. '
        'If the doctor did not mention vitals, write "Not recorded" for vitals. '
        'If the doctor did not prescribe medications, write "None" under Treatment Plan. '
        'Do NOT invent, infer, or fabricate any numbers, values, or prescriptions. '
        'Accuracy over completeness — it is better to leave a section blank '
        'than to include information the doctor never said.'
    )

    try:
        response = client.chat.completions(
            model="sarvam-30b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise medical scribe. "
                    "CRITICAL: Never invent or fabricate any clinical data. "
                    "Only include vitals, medications, labs, or diagnoses "
                    "that the doctor explicitly stated. Write 'Not recorded' "
                    "for missing sections rather than making up values. "
                    "Output only the structured note. Be concise.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=4096,
            reasoning_effort="low",
        )
        msg = response.choices[0].message
        note_text = msg.content or msg.reasoning_content or ""
        logger.info(
            "Sarvam Chat: generated %d-char note for specialty=%s (finish=%s)",
            len(note_text),
            specialty,
            response.choices[0].finish_reason,
        )
        if not note_text.strip():
            # Fallback: try without reasoning_effort
            response2 = client.chat.completions(
                model="sarvam-30b",
                messages=[
                    {"role": "system", "content": "You are a precise medical scribe. CRITICAL: Never invent or fabricate clinical data. Only include what the doctor stated. Write 'Not recorded' for missing sections. Be concise."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=4096,
            )
            note_text = response2.choices[0].message.content or ""
        return {
            "note_text": note_text.strip(),
            "specialty": specialty,
            "transcript": transcript,
        }
    except Exception as exc:
        logger.error("Sarvam Chat failed: %s", exc)
        raise NoteGenerationError(f"Note generation failed: {exc}") from exc


def transcribe_and_generate(
    audio_data: bytes,
    filename: str = "audio.wav",
    specialty: str = "general",
) -> dict:
    """Full pipeline: STT → LLM → structured note.

    Args:
        audio_data: Raw audio bytes.
        filename: Original filename.
        specialty: Medical specialty.

    Returns:
        Dict with ``note_text``, ``transcript``, ``specialty``.
    """
    transcript = transcribe_audio(audio_data, filename)
    if not transcript.strip():
        raise TranscriptionError("Transcription returned empty text.")
    result = generate_note(transcript, specialty)
    return result
