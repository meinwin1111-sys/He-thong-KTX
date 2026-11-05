(function (root) {
    const IDENTITY_ERROR = "Số CCCD/Hộ chiếu phải là CCCD gồm đúng 12 chữ số hoặc hộ chiếu 6–12 ký tự chữ hoa và số, có ít nhất một chữ cái.";

    function validateStudentIdentity(value) {
        const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
        const citizenId = /^\d{12}$/.test(normalized);
        const passport = /^[A-Z0-9]{6,12}$/.test(normalized) && /[A-Z]/.test(normalized);
        return {
            valid: citizenId || passport,
            value: normalized,
            type: citizenId ? "CCCD" : passport ? "PASSPORT" : null,
            message: citizenId || passport ? "" : IDENTITY_ERROR
        };
    }

    function maskStudentIdentity(value) {
        const identity = typeof value === "string" ? value.trim() : "";
        if (!identity) return "—";
        if (/^\d{12}$/.test(identity)) return `${identity.slice(0, 4)}****${identity.slice(-4)}`;
        if (identity.length <= 4) return "*".repeat(identity.length);
        return `${identity.slice(0, 2)}****${identity.slice(-2)}`;
    }

    function maskStudentIdentitiesInText(value, knownIdentities = []) {
        let text = String(value ?? "");
        const identities = [...new Set((Array.isArray(knownIdentities) ? knownIdentities : [])
            .filter(identity => typeof identity === "string")
            .map(identity => identity.trim())
            .filter(Boolean))]
            .sort((left, right) => right.length - left.length);
        for (const identity of identities) {
            const escaped = identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            text = text.replace(new RegExp(`(?<![A-Z0-9-])${escaped}(?![A-Z0-9-])`, "gi"), match =>
                maskStudentIdentity(match)
            );
        }
        return text;
    }

    const api = Object.freeze({
        IDENTITY_ERROR,
        validateStudentIdentity,
        maskStudentIdentity,
        maskStudentIdentitiesInText
    });
    root.StudentIdentity = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
