(function () {
    const TOKEN_KEY = "ktx.accessToken";
    const USER_KEY = "ktx.currentUser";
    const STUDENT_TOKEN_KEY = "ktx.student.accessToken";
    const STUDENT_USER_KEY = "ktx.student.currentUser";
    const NGROK_HOST_SUFFIXES = [".ngrok-free.dev", ".ngrok-free.app", ".ngrok.app", ".ngrok.io"];
    const configuredApiBaseUrl = window.KTX_CONFIG && window.KTX_CONFIG.apiBaseUrl;
    const API_BASE_URL = typeof configuredApiBaseUrl === "string" && configuredApiBaseUrl.trim()
        ? configuredApiBaseUrl.trim().replace(/\/+$/, "")
        : window.location.origin;
    let unauthorizedNotified = false;

    class ApiError extends Error {
        constructor(message, status) {
            super(message);
            this.name = "ApiError";
            this.status = status;
        }
    }

    function readSession() {
        const token = sessionStorage.getItem(TOKEN_KEY);
        const storedUser = sessionStorage.getItem(USER_KEY);
        if (!token || !storedUser) return null;

        try {
            const user = JSON.parse(storedUser);
            if (!user || user.role !== "Quản lý") throw new Error("Invalid session user");
            return { token, user };
        } catch {
            clearSession();
            return null;
        }
    }

    function clearSession() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
    }

    function readStudentSession() {
        const token = sessionStorage.getItem(STUDENT_TOKEN_KEY);
        const storedUser = sessionStorage.getItem(STUDENT_USER_KEY);
        if (!token || !storedUser) return null;

        try {
            const user = JSON.parse(storedUser);
            if (!user || user.role !== "Sinh viên" || !user.studentId) throw new Error("Invalid student session");
            return { token, user };
        } catch {
            clearStudentSession();
            return null;
        }
    }

    function clearStudentSession() {
        sessionStorage.removeItem(STUDENT_TOKEN_KEY);
        sessionStorage.removeItem(STUDENT_USER_KEY);
    }

    function errorMessage(status, body) {
        if (body && typeof body.message === "string" && body.message.trim()) {
            return body.message;
        }
        if (status === 400 || status === 422) return "Dữ liệu gửi lên không hợp lệ.";
        if (status === 401) return "Vui lòng đăng nhập lại.";
        if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
        if (status === 404) return "Không tìm thấy dữ liệu yêu cầu.";
        if (status === 409) return "Dữ liệu bị trùng hoặc xung đột.";
        if (status >= 500) return "Máy chủ gặp lỗi. Vui lòng thử lại sau.";
        return "Không thể hoàn thành yêu cầu.";
    }

    async function readErrorBody(response) {
        try {
            return await response.clone().json();
        } catch {
            return null;
        }
    }

    async function apiFetch(input, options) {
        const requestOptions = options || {};
        const url = new URL(input, API_BASE_URL);
        const headers = new Headers(requestOptions.headers || {});
        const session = readSession() || readStudentSession();
        const isApi = url.origin === API_BASE_URL && url.pathname.startsWith("/api/");
        const isLogin = url.pathname === "/api/login";

        if (isApi && NGROK_HOST_SUFFIXES.some(suffix => url.hostname.endsWith(suffix))) {
            headers.set("ngrok-skip-browser-warning", "true");
        }

        if (isApi && !isLogin && session) {
            headers.set("Authorization", `Bearer ${session.token}`);
        }

        let response;
        try {
            response = await window.fetch(url.href, { ...requestOptions, headers });
        } catch (error) {
            if (error.name === "AbortError") throw error;
            throw new ApiError("Không thể kết nối đến máy chủ. Vui lòng thử lại.", 0);
        }

        if (response.status === 401 && isApi && !isLogin) {
            const hadSession = Boolean(session);
            if (session?.user.role === "Sinh viên") clearStudentSession();
            else clearSession();
            if (hadSession && !unauthorizedNotified) {
                unauthorizedNotified = true;
                window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("api:unauthorized", {
                        detail: { role: session.user.role }
                    }));
                }, 0);
            }
        }

        if (!response.ok) {
            const body = await readErrorBody(response);
            throw new ApiError(errorMessage(response.status, body), response.status);
        }
        return response;
    }

    window.ApiClient = Object.freeze({
        baseUrl: API_BASE_URL,
        fetch: apiFetch,
        getSession: readSession,
        setSession(token, user) {
            if (!token || !user || user.role !== "Quản lý") {
                throw new Error("Chỉ tài khoản Quản lý mới được tạo phiên quản trị.");
            }
            clearStudentSession();
            sessionStorage.setItem(TOKEN_KEY, token);
            sessionStorage.setItem(USER_KEY, JSON.stringify(user));
            unauthorizedNotified = false;
        },
        getStudentSession: readStudentSession,
        setStudentSession(token, user) {
            if (!token || !user || user.role !== "Sinh viên" || !user.studentId) {
                throw new Error("Tài khoản Sinh viên cần có JWT và hồ sơ liên kết hợp lệ.");
            }
            clearSession();
            sessionStorage.setItem(STUDENT_TOKEN_KEY, token);
            sessionStorage.setItem(STUDENT_USER_KEY, JSON.stringify(user));
            unauthorizedNotified = false;
        },
        clearStudentSession,
        clearSession,
    });
})();
