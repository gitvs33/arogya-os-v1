"""Transaction feed — build merged payment/refund lists for the billing dashboard."""
from ..models import Payment, RefundRequest


def fetch_transaction_feed(hospital, limit=50):
    """Return a merged, sorted list of payment and refund transactions.

    Each entry contains ``id``, ``type`` (``'payment'`` or ``'refund'``),
    ``invoice_number``, ``patient_name``, ``amount``, ``payment_method``,
    ``status``, and ``timestamp``.
    """
    transactions = []

    for p in Payment.objects.filter(hospital=hospital).select_related(
        'invoice', 'patient'
    ).order_by('-transaction_time')[:limit]:
        transactions.append({
            'id': str(p.id),
            'type': 'payment',
            'invoice_number': p.invoice.invoice_number if p.invoice else '',
            'patient_name': str(p.patient) if p.patient else '',
            'amount': float(p.amount),
            'payment_method': p.payment_method,
            'status': p.status,
            'timestamp': p.transaction_time.isoformat(),
        })

    for r in RefundRequest.objects.filter(hospital=hospital).select_related(
        'invoice', 'patient'
    ).order_by('-created_at')[:limit]:
        transactions.append({
            'id': str(r.id),
            'type': 'refund',
            'invoice_number': r.invoice.invoice_number if r.invoice else '',
            'patient_name': str(r.patient) if r.patient else '',
            'amount': float(r.amount),
            'payment_method': '',
            'status': r.status,
            'timestamp': r.created_at.isoformat(),
        })

    transactions.sort(key=lambda t: t['timestamp'], reverse=True)
    return transactions[:limit]
