(function (root) {
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);

    function parseVnd(value) {
        if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
        if (typeof value !== "string") return null;
        const raw = value.trim();
        if (!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(raw)) return null;
        const normalized = raw.replace(/\./g, "");
        const amount = Number(normalized);
        return Number.isSafeInteger(amount) ? amount : null;
    }

    function formatVnd(value) {
        const amount = Number(value);
        if (!Number.isSafeInteger(amount)) return "—";
        return `${amount.toLocaleString("vi-VN")} đ`;
    }

    function exceedsBalance(amount, balance) {
        return !Number.isSafeInteger(amount) || amount <= 0
            || !Number.isSafeInteger(balance) || balance < 0 || amount > balance;
    }

    function refundReasonRequired(amount, suggested, reason) {
        return Number(amount) !== Number(suggested) && !String(reason || "").trim();
    }

    function invoicePersonLabel(invoice) {
        const name = String(invoice?.HoTen || invoice?.TenSinhVien || "").trim();
        const id = String(invoice?.MaSinhVien || "").trim();
        return name && id ? `${name} (${id})` : (name || id || "Theo phòng/hợp đồng");
    }

    function threeDigitsToWords(value) {
        const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
        const hundred = Math.floor(value / 100);
        const ten = Math.floor((value % 100) / 10);
        const unit = value % 10;
        const words = [];
        if (hundred) words.push(`${digits[hundred]} trăm`);
        else if (ten) words.push("không trăm");
        if (ten > 1) {
            words.push(`${digits[ten]} mươi`);
            if (unit === 1) words.push("mốt");
            else if (unit === 5) words.push("lăm");
            else if (unit) words.push(digits[unit]);
        } else if (ten === 1) {
            words.push("mười");
            if (unit === 5) words.push("lăm");
            else if (unit) words.push(digits[unit]);
        } else if (unit) {
            if (hundred) words.push("lẻ");
            words.push(digits[unit]);
        }
        return words.join(" ");
    }

    function amountInWords(value) {
        if (!Number.isSafeInteger(value) || value < 0) return "";
        if (value === 0) return "Không đồng";
        const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ"];
        const groups = [];
        let remaining = value;
        while (remaining > 0) {
            groups.push(remaining % 1000);
            remaining = Math.floor(remaining / 1000);
        }
        if (groups.length > units.length) return "";
        const words = [];
        for (let index = groups.length - 1; index >= 0; index--) {
            if (!groups[index]) continue;
            const part = threeDigitsToWords(groups[index]);
            words.push([part, units[index]].filter(Boolean).join(" "));
        }
        const result = words.join(" ").replace(/\s+/g, " ").trim();
        return `${result.charAt(0).toLocaleUpperCase("vi-VN")}${result.slice(1)} đồng`;
    }

    const utils = Object.freeze({
        escapeHtml, parseVnd, formatVnd, exceedsBalance,
        refundReasonRequired, invoicePersonLabel, amountInWords
    });
    root.AdminWorkflowUtils = utils;
    if (typeof module !== "undefined" && module.exports) module.exports = utils;
})(typeof window !== "undefined" ? window : globalThis);
