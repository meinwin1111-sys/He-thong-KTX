function qrTlv(id, value) {
    const length = Buffer.byteLength(value, "ascii");
    if (length > 99) throw new RangeError("QR field exceeds the EMVCo length limit.");
    return `${id}${String(length).padStart(2, "0")}${value}`;
}

function crc16CcittFalse(value) {
    let crc = 0xFFFF;
    for (const byte of Buffer.from(value, "ascii")) {
        crc ^= byte << 8;
        for (let bit = 0; bit < 8; bit++) {
            crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
}

function createVietQrPayload({ bankBin, accountNumber, amount, paymentContent }) {
    if (!/^\d{6}$/.test(bankBin)
        || !/^\d{6,19}$/.test(accountNumber)
        || !Number.isFinite(amount) || amount <= 0
        || typeof paymentContent !== "string"
        || !/^[A-Za-z0-9 ._-]{1,25}$/.test(paymentContent)) {
        throw new TypeError("Invalid VietQR payment data.");
    }

    const bankAccount = qrTlv("00", bankBin) + qrTlv("01", accountNumber);
    const napasAccount = qrTlv("00", "A000000727")
        + qrTlv("01", bankAccount)
        + qrTlv("02", "QRIBFTTA");
    const amountText = amount.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    const additionalData = qrTlv("08", paymentContent);
    const payload = qrTlv("00", "01")
        + qrTlv("01", "11")
        + qrTlv("38", napasAccount)
        + qrTlv("53", "704")
        + qrTlv("54", amountText)
        + qrTlv("58", "VN")
        + qrTlv("62", additionalData)
        + "6304";
    return payload + crc16CcittFalse(payload);
}

module.exports = { createVietQrPayload, crc16CcittFalse };
