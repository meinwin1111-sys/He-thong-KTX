// Mock repository riêng của Student. Không đọc/ghi dữ liệu Admin hoặc gọi API.
window.StudentUI = {};
(() => {
    const today = new Date();
    const date = offset => {
        const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    };
    const data = {
        profile: { code: 'SV001', name: 'Nguyễn Văn An', birthday: '2005-08-15', gender: 'Nam', phone: '0901234567', email: 'an.sv@example.com', address: 'Hải Châu, Đà Nẵng' },
        room: { number: 'A101', type: 'Phòng 4 người', capacity: 4, members: [{ code: 'SV001', name: 'Nguyễn Văn An' }, { code: 'SV003', name: 'Lê Minh Quân' }, { code: 'SV005', name: 'Hoàng Đức Nam' }] },
        contract: { id: 'HD001', start: date(-165), end: date(15), status: 'Đang hiệu lực', fee: 1500000 },
        invoices: [
            { id: 'HĐ003', month: date(0).slice(0, 7), due: date(7), paid: false, items: [
                { id: 'HĐ003-01', code: 'ROOM', name: 'Tiền phòng', amount: 1500000, status: 'UNPAID' },
                { id: 'HĐ003-02', code: 'ELECTRICITY', name: 'Tiền điện', amount: 100000, status: 'UNPAID', note: 'Chỉ số 120 → 150' },
                { id: 'HĐ003-03', code: 'WATER', name: 'Tiền nước', amount: 50000, status: 'UNPAID' },
                { id: 'HĐ003-04', code: 'INTERNET', name: 'Internet', amount: 30000, status: 'UNPAID' },
                { id: 'HĐ003-05', code: 'CLEANING', name: 'Vệ sinh', amount: 20000, status: 'UNPAID' }
            ] },
            { id: 'HĐ002', month: date(-32).slice(0, 7), due: date(-20), paid: true, items: [
                { id: 'HĐ002-01', code: 'ROOM', name: 'Tiền phòng', amount: 1500000, status: 'PAID' },
                { id: 'HĐ002-02', code: 'ELECTRICITY', name: 'Tiền điện', amount: 85000, status: 'PAID' },
                { id: 'HĐ002-03', code: 'WATER', name: 'Tiền nước', amount: 50000, status: 'PAID' }
            ] },
            { id: 'HĐ001', month: date(-64).slice(0, 7), due: date(-50), paid: false, items: [
                { id: 'HĐ001-01', code: 'ROOM', name: 'Tiền phòng', amount: 1500000, status: 'UNPAID' },
                { id: 'HĐ001-02', code: 'ELECTRICITY', name: 'Tiền điện', amount: 90000, status: 'UNPAID' },
                { id: 'HĐ001-03', code: 'WATER', name: 'Tiền nước', amount: 50000, status: 'UNPAID' },
                { id: 'HĐ001-04', code: 'PENALTY', name: 'Phí phạt/hư hỏng', amount: 100000, status: 'UNPAID', note: 'Hư khóa cửa phòng' }
            ] }
        ],
        payments: [
            { id: 'GD001', invoiceId: 'HĐ002', date: date(-22), amount: 1635000, method: 'Online · Ngân hàng (demo)', status: 'Thành công' }
        ],
        requests: [
            { id: 'YC003', type: 'Gia hạn hợp đồng', date: date(-1), content: 'Xin gia hạn lưu trú thêm 6 tháng.', status: 'Chờ duyệt', reply: '' },
            { id: 'YC002', type: 'Báo hỏng thiết bị', date: date(-5), content: 'Quạt trần chạy chậm và phát tiếng kêu.', status: 'Đã duyệt', reply: 'Đã chuyển bộ phận kỹ thuật kiểm tra.' },
            { id: 'YC001', type: 'Gia hạn hợp đồng', date: date(-10), content: 'Xin gia hạn hợp đồng học kỳ tiếp theo.', status: 'Từ chối', reply: 'Vui lòng bổ sung thời gian gia hạn cụ thể.' }
        ]
    };
    const session = window.StudentAuth?.session();
    if (session) {
        data.profile = { code: session.code, name: session.name || session.code, email: session.email,
            birthday: session.birthday || '', gender: session.gender || 'Chưa cập nhật',
            phone: session.phone || 'Chưa cập nhật', address: session.address || 'Chưa cập nhật',
            school: session.school || 'Chưa cập nhật', className: session.className || 'Chưa cập nhật' };
        // Mỗi tài khoản có hồ sơ lưu trú demo riêng; ngày hợp đồng không trôi khi tải lại.
        const key = `ktx.student.residence.v1.${encodeURIComponent(session.code)}`;
        let residence;
        try {
            const saved = JSON.parse(localStorage.getItem(key) || 'null');
            if (saved?.studentCode === session.code && typeof saved.roomNumber === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.start) && /^\d{4}-\d{2}-\d{2}$/.test(saved.end)) residence = saved;
        } catch { /* Không có dữ liệu hợp lệ: dùng hồ sơ demo mới. */ }
        if (!residence) {
            residence = { studentCode: session.code, roomNumber: `A-${session.code}`, start: date(-165), end: date(15) };
            try { localStorage.setItem(key, JSON.stringify(residence)); } catch { /* Vẫn cho phép xem demo trong bộ nhớ. */ }
        }
        data.room = {
            number: residence.roomNumber, building: 'Tòa A (demo)', type: 'Phòng 4 người', capacity: 4,
            members: [
                { code: session.code, name: data.profile.name, className: data.profile.className, school: data.profile.school },
                { code: `DEMO-01-${session.code}`, name: 'Trần Minh Anh (mẫu)', className: 'CNTT01', school: 'Đại học Kinh tế (mẫu)' },
                { code: `DEMO-02-${session.code}`, name: 'Nguyễn Hoàng Hải (mẫu)', className: 'QTKD02', school: 'Đại học Kinh tế (mẫu)' }
            ]
        };
        data.room.status = data.room.members.length >= data.room.capacity ? 'Đã đầy' : 'Còn chỗ';
        data.contract = { id: `HD-${session.code}`, studentCode: session.code, roomNumber: data.room.number,
            start: residence.start, end: residence.end, fee: 1500000 };
    }
    StudentUI.repository = {
        data,
        addRequest(type, content) {
            const request = { id: `YC${String(data.requests.length + 1).padStart(3, '0')}`, type, content, date: date(0), status: 'Chờ duyệt', reply: '' };
            data.requests.unshift(request);
            return request;
        }
    };
})();
