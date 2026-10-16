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

    function parseDate(value) {
        const match = /^([0-3]\d)\/([01]\d)\/(\d{4})$/.exec(String(value || '').trim());
        if (!match) return null;
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date, iso };
    }

    function formatDateInput(value, caretPosition = String(value || '').length, { backspace = false, inputType = '' } = {}) {
        let source = String(value || '');
        let caret = Math.max(0, Math.min(Number(caretPosition) || 0, source.length));
        if (backspace && caret > 0 && source[caret - 1] === '/') {
            const slashIndex = caret - 1;
            const groups = source.split('/').slice(0, 3).map(group => group.replace(/\D/g, ''));
            const groupIndex = source.slice(0, slashIndex).split('/').length - 1;
            if (groupIndex < groups.length && groups[groupIndex]) {
                groups[groupIndex] = groups[groupIndex].slice(0, -1);
                const limits = [2, 2, 4];
                const formatted = groups.map((group, index) => group.slice(0, limits[index])).join('/');
                const selectionStart = groups.slice(0, groupIndex + 1).reduce((total, group) => total + group.length, groupIndex);
                return { value: formatted, selectionStart };
            }
        }

        const digitsBeforeCaret = source.slice(0, caret).replace(/\D/g, '').length;
        const digits = source.replace(/\D/g, '').slice(0, 8);
        const formatted = digits.length > 4
            ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
            : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
        const targetDigit = Math.min(digitsBeforeCaret, digits.length);
        let selectionStart = 0;
        let seenDigits = 0;
        while (selectionStart < formatted.length && seenDigits < targetDigit) {
            if (/\d/.test(formatted[selectionStart])) seenDigits++;
            selectionStart++;
        }
        if (/^insert/.test(inputType) && [2, 4].includes(targetDigit) && formatted[selectionStart] === '/') {
            selectionStart++;
        }
        return { value: formatted, selectionStart };
    }

    function bindDateInput(input) {
        let keepBackspaceFormat = false;
        input.addEventListener('input', event => {
            if (keepBackspaceFormat) {
                keepBackspaceFormat = false;
                return;
            }
            const result = formatDateInput(input.value, input.selectionStart, { inputType: event.inputType });
            if (input.value !== result.value) input.value = result.value;
            input.setSelectionRange(result.selectionStart, result.selectionStart);
        });
        input.addEventListener('keydown', event => {
            if (event.key !== 'Backspace' || input.selectionStart !== input.selectionEnd
                || input.value[input.selectionStart - 1] !== '/') return;
            event.preventDefault();
            const result = formatDateInput(input.value, input.selectionStart, { backspace: true });
            input.value = result.value;
            input.setSelectionRange(result.selectionStart, result.selectionStart);
            keepBackspaceFormat = true;
            input.dispatchEvent(new Event('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        });
        input.addEventListener('paste', event => {
            event.preventDefault();
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const pasted = event.clipboardData.getData('text');
            const value = input.value.slice(0, start) + pasted + input.value.slice(end);
            const result = formatDateInput(value, start + pasted.length, { inputType: 'insertFromPaste' });
            input.value = result.value;
            input.setSelectionRange(result.selectionStart, result.selectionStart);
            input.dispatchEvent(new Event('input', { bubbles: true, inputType: 'insertFromPaste' }));
        });
    }

    window.StudentDate = Object.freeze({
        parse: parseDate,
        formatInput: formatDateInput,
        bindInput: bindDateInput,
        birthDateToIso(value) {
            const parsed = parseDate(value);
            if (!parsed) throw new Error('Ngày sinh phải đúng định dạng dd/mm/yyyy.');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let age = today.getFullYear() - parsed.date.getFullYear();
            if (today.getMonth() < parsed.date.getMonth() ||
                (today.getMonth() === parsed.date.getMonth() && today.getDate() < parsed.date.getDate())) age--;
            if (parsed.date > today || age < 15 || age > 100) {
                throw new Error('Sinh viên phải từ 15 đến 100 tuổi và ngày sinh không được ở tương lai.');
            }
            return parsed.iso;
        },
        futureDateToIso(value) {
            const parsed = parseDate(value);
            if (!parsed) throw new Error('Ngày phải đúng định dạng dd/mm/yyyy.');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (parsed.date <= today) throw new Error('Ngày kết thúc đề xuất phải sau ngày hôm nay.');
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
