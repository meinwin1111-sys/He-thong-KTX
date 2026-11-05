// Exposes the student's authenticated API session and optional development-only demo auth.
(() => {
    const accountsKey = 'ktx.student.mock.accounts.v1';
    const sessionKey = 'ktx.student.mock.session.v1';
    const cleanupKey = 'ktx.student.phase2.storage-cleanup.v1';
    const students = [
        { code: 'SV001', name: 'Nguyễn Văn An', email: 'student@ktx.com' },
        { code: 'SV003', name: 'Lê Minh Quân', email: 'quan.sv@ktx.com' },
        { code: 'SV005', name: 'Hoàng Đức Nam', email: 'nam.sv@ktx.com' }
    ];
    const normalize = email => String(email).trim().toLowerCase();
    const demoAuthEnabled = () => window.KTX_CONFIG?.allowStudentDemoAuth === true;
    function cleanLegacyStorage() {
        try {
            if (localStorage.getItem(cleanupKey) === '1') return;
            localStorage.removeItem(accountsKey);
            localStorage.removeItem(sessionKey);
            for (let index = localStorage.length - 1; index >= 0; index--) {
                const key = localStorage.key(index);
                if (key?.startsWith('ktx.student.residence.') || key?.startsWith('ktx.billing.demo.')) {
                    localStorage.removeItem(key);
                }
            }
            localStorage.setItem(cleanupKey, '1');
        } catch (error) {
            console.error("Không thể xóa dữ liệu đăng nhập Student cũ khỏi trình duyệt:", error.name || "StorageError");
        }
    }
    cleanLegacyStorage();
    function clearStudentBrowserData() {
        localStorage.removeItem(accountsKey);
        localStorage.removeItem(sessionKey);
        for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (key?.startsWith('ktx.student.') || key?.startsWith('ktx.billing.demo.')) {
                localStorage.removeItem(key);
            }
        }
        for (let index = sessionStorage.length - 1; index >= 0; index--) {
            const key = sessionStorage.key(index);
            if (key?.startsWith('ktx.student.') || key === sessionKey) sessionStorage.removeItem(key);
        }
    }

    const sharedDates = () => window.AdminWorkflowUtils;
    function parseDate(value) {
        const iso = sharedDates()?.date(String(value || ''), 'parse');
        if (!iso) return null;
        const [year, month, day] = iso.split('-').map(Number);
        return { year, month, day, iso };
    }
    function formatDateInput(value) {
        return sharedDates()?.filterDateInput(value)
            || String(value || '').replace(/[^\d/]/g, '').slice(0, 10);
    }
    function bindDateInput(input, { birth = false } = {}) {
        input.maxLength = 10;
        input.inputMode = 'numeric';
        input.dataset.adminDate = 'true';
        if (birth) input.dataset.dateBirth = 'true';
        else delete input.dataset.dateBirth;
        sharedDates()?.bindDateInputs(document.body);
    }

    window.StudentDate = Object.freeze({
        parse: parseDate,
        formatInput: formatDateInput,
        bindInput: bindDateInput,
        normalizeInput(value) {
            return sharedDates()?.normalizeDateInput(value) || null;
        },
        formatIso(value) {
            const formatted = sharedDates()?.date(String(value || ''), 'format');
            if (!formatted) throw new Error('Ngày không hợp lệ.');
            return formatted;
        },
        birthDateToIso(value) {
            const validation = sharedDates()?.validateDateInput(value, { minYear: 1900 });
            if (validation) throw new Error(validation);
            const parsed = parseDate(value);
            if (!parsed) throw new Error('Ngày sinh phải đúng định dạng dd/mm/yyyy.');
            const today = new Date();
            const todayParts = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
            let age = todayParts.year - parsed.year;
            if (todayParts.month < parsed.month ||
                (todayParts.month === parsed.month && todayParts.day < parsed.day)) age--;
            if (parsed.iso > `${todayParts.year}-${String(todayParts.month).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}` || parsed.year < 1900 || age < 15 || age > 100) {
                throw new Error('Sinh viên phải từ 15 đến 100 tuổi và ngày sinh không được ở tương lai.');
            }
            return parsed.iso;
        },
        futureDateToIso(value) {
            const validation = sharedDates()?.validateDateInput(value, { minYear: 1900 });
            if (validation) throw new Error(validation);
            const parsed = parseDate(value);
            if (!parsed) throw new Error('Ngày phải đúng định dạng dd/mm/yyyy.');
            const today = new Date();
            const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (parsed.iso <= isoToday) throw new Error('Ngày kết thúc đề xuất phải sau ngày hôm nay.');
            return parsed.iso;
        },
        earlyCheckoutDateToIso(value) {
            const validation = sharedDates()?.validateDateInput(value, { minYear: 1900 });
            if (validation) throw new Error(validation);
            const parsed = parseDate(value);
            if (!parsed) throw new Error('Ngày phải đúng định dạng dd/mm/yyyy.');
            const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
            if (parsed.iso < todayVN) throw new Error('Ngày kết thúc đề xuất phải từ hôm nay trở đi.');
            return parsed.iso;
        }
    });

    function accounts() {
        if (!demoAuthEnabled()) return [];
        const saved = JSON.parse(localStorage.getItem(accountsKey) || '[]');
        if (!Array.isArray(saved)) throw new Error('Dữ liệu tài khoản demo không hợp lệ.');
        return saved.filter(a => a && a.role === 'STUDENT' && typeof a.password === 'string' && typeof a.email === 'string').map(a => ({ ...students.find(s => s.code === a.code), ...a }));
    }
    window.StudentAuth = {
        students,
        isStudentEmail(email) {
            if (!demoAuthEnabled()) return false;
            try { return accounts().some(a => normalize(a.email) === normalize(email)); }
            catch { return false; } // Storage failure must not block the Admin API branch.
        },
        login(email, password) {
            if (!demoAuthEnabled()) throw new Error('Đăng nhập demo chỉ khả dụng khi được bật trong cấu hình phát triển.');
            const account = accounts().find(a => a.email === normalize(email) && a.password === password);
            if (!account) throw new Error('Email hoặc mật khẩu Student không đúng, hoặc bạn chưa đăng ký.');
            const profile = account;
            const session = { code: profile.code, email: profile.email, role: 'STUDENT', expiresAt: Date.now() + 86400000 };
            sessionStorage.setItem(sessionKey, JSON.stringify(session));
            return session;
        },
        session() {
            const backendUser = window.ApiClient?.getStudentSession()?.user;
            if (backendUser?.studentId) {
                return {
                    id: backendUser.id,
                    code: backendUser.studentId,
                    email: backendUser.email,
                    name: backendUser.fullName || backendUser.studentId,
                    phone: backendUser.phone || '',
                    role: 'STUDENT',
                    isBackend: true
                };
            }
            try {
                if (!demoAuthEnabled()) return null;
                const session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
                const student = accounts().find(s => s.code === session?.code && s.email === session?.email);
                if (!student || session.role !== 'STUDENT' || session.expiresAt <= Date.now()) return null;
                const { password, ...profile } = student;
                return profile;
            } catch { return null; }
        },
        logout() {
            if (window.ApiClient?.getStudentSession()) window.ApiClient.clearStudentSession();
            clearStudentBrowserData();
        }
    };
})();
