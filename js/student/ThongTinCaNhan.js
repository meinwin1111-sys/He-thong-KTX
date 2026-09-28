// Student: ThongTinCaNhan
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    ui.pages.profile = { title: 'Thông tin cá nhân', render: () => card('Hồ sơ sinh viên', fields([['Mã sinh viên', data.profile.code], ['Họ tên', data.profile.name], ['Ngày sinh', data.profile.birthday ? date(data.profile.birthday) : 'Chưa cập nhật'], ['Giới tính', data.profile.gender], ['Số điện thoại', data.profile.phone], ['Gmail', data.profile.email], ['Trường', data.profile.school], ['Lớp', data.profile.className], ['Địa chỉ', data.profile.address]])) };
})();
