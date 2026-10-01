// Keeps demo accounts separate while exposing the student's authenticated API session.
(() => {
    const accountsKey = 'ktx.student.mock.accounts.v1';
    const sessionKey = 'ktx.student.mock.session.v1';
    const students = [
        { code: 'SV001', name: 'Nguyễn Văn An', email: 'student@ktx.com' },
        { code: 'SV003', name: 'Lê Minh Quân', email: 'quan.sv@ktx.com' },
        { code: 'SV005', name: 'Hoàng Đức Nam', email: 'nam.sv@ktx.com' }
    ];
    const normalize = email => String(email).trim().toLowerCase();
    function accounts() {
        const saved = JSON.parse(localStorage.getItem(accountsKey) || '[]');
        if (!Array.isArray(saved)) throw new Error('Dữ liệu tài khoản demo không hợp lệ.');
        return saved.filter(a => a && a.role === 'STUDENT' && typeof a.password === 'string' && typeof a.email === 'string').map(a => ({ ...students.find(s => s.code === a.code), ...a }));
    }
    window.StudentAuth = {
        students,
        isStudentEmail(email) {
            try { return accounts().some(a => normalize(a.email) === normalize(email)); }
            catch { return false; } // Storage failure must not block the Admin API branch.
        },
        login(email, password) {
            const account = accounts().find(a => a.email === normalize(email) && a.password === password);
            if (!account) throw new Error('Email hoặc mật khẩu Student không đúng, hoặc bạn chưa đăng ký.');
            const profile = account;
            const session = { code: profile.code, email: profile.email, role: 'STUDENT', expiresAt: Date.now() + 86400000 };
            localStorage.setItem(sessionKey, JSON.stringify(session));
            return session;
        },
        register(input) {
            const student = {};
            for (const key of ['name', 'code', 'birthday', 'gender', 'phone', 'email', 'school', 'className', 'address']) student[key] = String(input[key] || '').trim();
            if (['name', 'code', 'birthday', 'gender', 'phone', 'email', 'school', 'className'].some(key => !student[key])) throw new Error('Vui lòng nhập đầy đủ các trường bắt buộc.');
            student.email = normalize(student.email);
            student.code = student.code.toUpperCase();
            if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(student.email)) throw new Error('Vui lòng nhập Gmail hợp lệ (ten@gmail.com).');
            student.phone = student.phone.replace(/[\s.-]/g, '');
            if (!/^(?:0|\+84)[35789]\d{8}$/.test(student.phone)) throw new Error('Số điện thoại phải là số di động Việt Nam hợp lệ (10 số hoặc +84).');
            if (student.phone.startsWith('+84')) student.phone = `0${student.phone.slice(3)}`;
            if (!['Nam', 'Nữ', 'Khác'].includes(student.gender)) throw new Error('Vui lòng chọn giới tính hợp lệ.');
            const birthday = new Date(`${student.birthday}T00:00:00`);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(student.birthday) || !Number.isFinite(birthday.getTime()) || birthday > today || birthday.getFullYear() !== Number(student.birthday.slice(0, 4)) || birthday.getMonth() + 1 !== Number(student.birthday.slice(5, 7)) || birthday.getDate() !== Number(student.birthday.slice(8, 10))) throw new Error('Ngày sinh không hợp lệ hoặc lớn hơn ngày hiện tại.');
            const password = String(input.password || '');
            if (password.length < 8 || password.length > 128) throw new Error('Mật khẩu cần từ 8 đến 128 ký tự.');
            if (password !== input.confirm) throw new Error('Mật khẩu nhập lại không khớp.');
            const list = accounts();
            if (list.some(a => normalize(a.email) === student.email)) throw new Error('Gmail này đã được đăng ký.');
            if (list.some(a => a.code.toUpperCase() === student.code)) throw new Error('Mã sinh viên này đã được đăng ký.');
            list.push({ ...student, password, role: 'STUDENT' });
            localStorage.setItem(accountsKey, JSON.stringify(list));
            return student.email;
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
                const session = JSON.parse(localStorage.getItem(sessionKey) || 'null');
                const student = accounts().find(s => s.code === session?.code && s.email === session?.email);
                if (!student || session.role !== 'STUDENT' || session.expiresAt <= Date.now()) return null;
                const { password, ...profile } = student;
                return profile;
            } catch { return null; }
        },
        logout() {
            if (window.ApiClient?.getStudentSession()) {
                window.ApiClient.clearStudentSession();
                return;
            }
            localStorage.removeItem(sessionKey);
        }
    };
})();
