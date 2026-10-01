const { createHmac, timingSafeEqual } = require("node:crypto");

function paymentWebhookMessage(payload) {
    return [
        payload.MaHoaDon,
        Number(payload.SoTien).toFixed(2),
        payload.MaThamChieuNgoai,
        payload.NoiDungCK
    ].join("\n");
}

function createPaymentWebhookSignature(secret, payload) {
    return createHmac("sha256", secret)
        .update(paymentWebhookMessage(payload), "utf8")
        .digest("hex");
}

function verifyPaymentWebhookSignature(secret, payload, signature) {
    if (typeof secret !== "string" || !secret || typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) {
        return false;
    }
    const expected = Buffer.from(createPaymentWebhookSignature(secret, payload), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
}

module.exports = { createPaymentWebhookSignature, verifyPaymentWebhookSignature };
