// Student: PhongCuaToi
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    ui.pages.room = { title: 'Phòng của tôi', render: () => '<p class="st-demo">Hồ sơ phòng demo gắn với tài khoản đang đăng nhập, không phải phân phòng thật.</p>' + card('Thông tin phòng', fields([['Số phòng', data.room.number], ['Khu/Tòa', data.room.building], ['Loại phòng', data.room.type], ['Sức chứa tối đa', `${data.room.capacity} người`], ['Số người hiện đang ở', `${data.room.members.length} người (bao gồm bạn)`], ['Trạng thái phòng', data.room.status]])) + card('Bạn cùng phòng', table(['Họ tên', 'Mã sinh viên', 'Lớp', 'Trường'], data.room.members.filter(m => m.code !== data.profile.code).map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.code)}</td><td>${esc(m.className)}</td><td>${esc(m.school)}</td></tr>`).join(''))) };
})();
