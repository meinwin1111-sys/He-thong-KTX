# Bank transfer verification

`POST /api/payments/bank-transfer/notify` is the server-to-server notification endpoint for a trusted bank/payment-provider adapter. It does not accept a student JWT. It requires `PAYMENT_WEBHOOK_SECRET` to contain at least 32 characters and a lowercase or uppercase hexadecimal HMAC-SHA256 signature in `X-Payment-Signature`.

The signed UTF-8 message is the four request fields joined with line feeds, in this order:

1. `MaHoaDon` exactly as sent
2. `SoTien` formatted with exactly two decimal places
3. `MaThamChieuNgoai` exactly as sent
4. `NoiDungCK` exactly as sent

Example JSON shape (use test values only outside production):

```json
{
  "MaHoaDon": "HD2026100001",
  "SoTien": 50000,
  "MaThamChieuNgoai": "provider-transaction-reference",
  "NoiDungCK": "KTX HD2026100001"
}
```

The receiver validates the HMAC in constant time, rejects duplicate provider references, and compares the signed transfer amount and payment content with the exact outstanding invoice amount and the pending online payment. Only an exact match atomically marks the payment and invoice successful. A mismatch is recorded as rejected and leaves the invoice unpaid. Replayed successful notifications are idempotent.

The student-facing “Đã chuyển khoản thành công” action only reads the resulting status; it is not proof of payment. QR payments remain pending until this signed notification arrives. Cash payments remain pending until a manager confirms them through the invoice payment-history UI.

This endpoint defines the application-side verification contract; an actual provider integration must securely generate the signature and forward verified transfer events. Never put the webhook secret in frontend code or logs.
