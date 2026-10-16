// Student: PhongCuaToi
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const demoRoom = () => '<p class="st-demo">Hồ sơ phòng demo gắn với tài khoản đang đăng nhập, không phải phân phòng thật.</p>' +
        card('Thông tin phòng', fields([
            ['Số phòng', data.room.number], ['Khu/Tòa', data.room.building],
            ['Loại phòng', data.room.type], ['Sức chứa tối đa', `${data.room.capacity} người`],
            ['Số người hiện đang ở', `${data.room.members.length} người (bao gồm bạn)`],
            ['Trạng thái phòng', data.room.status]
        ])) + card('Bạn cùng phòng', table(['Họ tên', 'Mã sinh viên', 'Lớp', 'Trường'],
            data.room.members.filter(member => member.code !== data.profile.code)
                .map(member => `<tr><td>${esc(member.name)}</td><td>${esc(member.code)}</td><td>${esc(member.className)}</td><td>${esc(member.school)}</td></tr>`).join('')));

    ui.pages.room = {
        title: 'Phòng của tôi',
        render: () => backendStudent()
            ? '<section data-room-content><p class="st-muted" role="status">Đang tải thông tin phòng...</p></section>'
            : demoRoom(),
        async load(root) {
            if (!backendStudent()) return;
            const content = root.querySelector('[data-room-content]');
            try {
                const response = await ApiClient.fetch('/api/student/room');
                const result = await response.json();
                if (!root.isConnected) return;
                if (!result.room) {
                    content.innerHTML = '<article class="st-card"><h2>Thông tin phòng</h2><p class="st-empty-state" role="status">Bạn chưa được xếp phòng.</p><p class="st-muted">Vui lòng chờ Ban quản lý sắp xếp phòng hoặc liên hệ quản lý ký túc xá để được hỗ trợ.</p></article>';
                    return;
                }
                const room = result.room;
                const members = Array.isArray(result.members) ? result.members : [];
                content.innerHTML = card('Thông tin phòng', fields([
                    ['Số phòng', room.TenPhong], ['Khu/Tòa', room.Khu],
                    ['Loại phòng', room.LoaiPhong],
                    ['Sức chứa tối đa', `${room.SucChuaToiDa} người`],
                    ['Số người hiện đang ở', `${room.SoSinhVienHienTai} người`],
                    ['Trạng thái phòng', room.TrangThaiPhong],
                    ['Giá phòng/tháng', money(Number(room.GiaPhong || 0))]
                ])) + card('Bạn cùng phòng', members.filter(member => member.MaSinhVien !== window.StudentAuth.session().code).length
                    ? table(['Họ tên', 'Mã sinh viên'],
                    members.filter(member => member.MaSinhVien !== window.StudentAuth.session().code)
                        .map(member => `<tr><td>${esc(member.HoTen)}</td><td>${esc(member.MaSinhVien)}</td></tr>`).join(''))
                    : '<p class="st-muted">Chưa có bạn cùng phòng.</p>');
            } catch (error) {
                if (root.isConnected) content.innerHTML = `<p class="st-notice" role="alert">${esc(error.message || 'Không thể tải thông tin phòng.')}</p>`;
            }
        }
    };
})();
