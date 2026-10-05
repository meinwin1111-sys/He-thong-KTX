function createApiAuthenticationMiddleware({ jwt, getSecret }) {
    return (req, res, next) => {
        if ((req.method === "GET" && req.path === "/health")
            || (req.method === "POST" && (req.path === "/login" || req.path === "/student/register" || req.path === "/payments/bank-transfer/notify"))) {
            return next();
        }

        const jwtSecret = getSecret();
        if (!jwtSecret) {
            return res.status(503).json({ message: "Xác thực API chưa được cấu hình." });
        }

        const authorization = req.get("authorization") || "";
        const [scheme, token] = authorization.split(" ");
        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({ message: "Vui lòng đăng nhập để tiếp tục." });
        }

        try {
            const payload = jwt.verify(token, jwtSecret);
            if (typeof payload === "string" || !/^\d+$/.test(String(payload.sub || ""))) {
                return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
            }
            if (payload.role === "Sinh viên") {
                const studentId = typeof payload.studentId === "string" ? payload.studentId.trim() : "";
                const allowedStudentRequest = (req.method === "GET"
                    && (/^\/HoaDon(?:\/[^/]+)?$/.test(req.path)
                        || req.path === "/payments/history"
                        || req.path === "/payments/qr"
                        || req.path === "/noi-quy"
                        || req.path === "/lien-he"
                        || /^\/student\/(?:profile|room|contracts|requests)$/.test(req.path)))
                    || (req.method === "POST" && (req.path === "/payments/create"
                        || req.path === "/student/requests"
                        || req.path === "/change-password"));
                if (!studentId || studentId.length > 20) {
                    return res.status(403).json({ message: "Tài khoản Sinh viên chưa được liên kết với hồ sơ hợp lệ." });
                }
                if (!allowedStudentRequest) {
                    return res.status(403).json({ message: "Sinh viên chỉ được xem hóa đơn, lịch sử và gửi yêu cầu thanh toán của mình." });
                }
                req.auth = { accountId: Number(payload.sub), role: payload.role, studentId };
                return next();
            }
            if (payload.role !== "Quản lý") {
                return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này." });
            }

            req.auth = { accountId: Number(payload.sub), role: payload.role };
            return next();
        } catch (error) {
            const message = error.name === "TokenExpiredError"
                ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                : "Phiên đăng nhập không hợp lệ.";
            return res.status(401).json({ message });
        }
    };
}

module.exports = { createApiAuthenticationMiddleware };
