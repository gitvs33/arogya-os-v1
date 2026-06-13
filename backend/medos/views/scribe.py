"""Care Scribe views — voice-to-note transcription."""
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt

from ..models import ClinicalNote, Encounter
from ..care_scribe import transcribe_and_generate, CareScribeError
from ..subscriptions import require_feature
from .base import get_hospital_from_user

logger = logging.getLogger(__name__)


@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_feature('scribe')
def care_scribe_transcribe(request):
    """Transcribe audio and generate a structured clinical note."""
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return Response(
            {'error': 'audio file is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    encounter_id = request.data.get('encounter_id')
    if not encounter_id:
        return Response(
            {'error': 'encounter_id is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        hospital = get_hospital_from_user(request.user)
        encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
    except Encounter.DoesNotExist:
        return Response(
            {'error': 'Encounter not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    specialty = request.data.get('specialty', 'general')

    try:
        audio_data = audio_file.read()
        result = transcribe_and_generate(
            audio_data=audio_data,
            filename=audio_file.name,
            specialty=specialty,
        )
    except CareScribeError as exc:
        return Response(
            {'error': str(exc)},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        logger.exception('Care Scribe error')
        return Response(
            {'error': f'Internal error: {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    note = ClinicalNote.objects.create(
        encounter=encounter,
        created_by=request.user if request.user.is_authenticated else None,
        specialty=result['specialty'],
        transcript=result['transcript'],
        note_text=result['note_text'],
        status='DRAFT',
    )

    return Response({
        'id': note.id,
        'note_text': note.note_text,
        'transcript': note.transcript,
        'specialty': note.specialty,
        'status': note.status,
        'created_at': note.created_at.isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_feature('scribe')
def care_scribe_confirm(request, note_id):
    """Confirm (finalize) a draft clinical note."""
    try:
        note = ClinicalNote.objects.get(id=note_id, status='DRAFT')
    except ClinicalNote.DoesNotExist:
        return Response(
            {'error': 'Draft note not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    edited_note = request.data.get('edited_note')
    if edited_note:
        note.note_text = edited_note

    note.status = 'CONFIRMED'
    note.save()

    return Response({
        'id': note.id,
        'note_text': note.note_text,
        'status': note.status,
        'structured_note': note.structured_note,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('scribe')
def care_scribe_list(request, encounter_id):
    """List all clinical notes for an encounter."""
    notes = ClinicalNote.objects.filter(encounter_id=encounter_id)
    return Response([{
        'id': n.id,
        'specialty': n.specialty,
        'note_text': n.note_text,
        'status': n.status,
        'created_at': n.created_at.isoformat(),
        'updated_at': n.updated_at.isoformat(),
    } for n in notes])
