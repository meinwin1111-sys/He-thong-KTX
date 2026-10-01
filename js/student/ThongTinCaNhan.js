// Student: ThongTinCaNhan
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const formatDate = value => value ? date(String(value).slice(0, 10)) : 'Chưa cập nhật';
    const demoProfile = () => card('Hồ sơ sinh viên', fields([
        ['Mã sinh viên', data.profile.code], ['Họ tên', data.profile.name],
        ['Ngày sinh', data.profile.birthday ? date(data.profile.birthday) : 'Chưa cập nhật'],
        ['Giới tính', data.profile.gender], ['Số điện thoại', data.profile.phone],
        ['Gmail', data.profile.email], ['Trường', data.profile.school],
        ['Lớp', data.profile.className], ['Địa chỉ', data.profile.address]
    ]));

    ui.pages.profile = {
        title: 'Thông tin cá nhân',
        render: () => backendStudent()
            ? card('Hồ sơ sinh viên', '<div data-profile-content role="status">Đang tải hồ sơ từ máy chủ...</div>')
            : demoProfile(),
        async load(root) {
            if (!backendStudent()) return;
            const content = root.querySelector('[data-profile-content]');
            try {
                const response = await ApiClient.fetch('/api/student/profile');
                const profile = await response.json();
                if (!root.isConnected) return;
                const attributes = fields([
                    ['Mã sinh viên', profile.MaSinhVien],
                    ['Họ tên', profile.HoTen],
                    ['Ngày sinh', formatDate(profile.NgaySinh)],
                    ['Giới tính', profile.GioiTinh || 'Chưa cập nhật'],
                    ['Số điện thoại', profile.SoDienThoai || 'Chưa cập nhật'],
                    ['Gmail đăng nhập', profile.Email],
                    ['Email trường', profile.EmailTruong || 'Chưa cập nhật'],
                    ['Trường / lớp', 'Chưa có dữ liệu trong hệ thống'],
                    ['Địa chỉ', profile.DiaChi || 'Chưa cập nhật']
                ]);
                content.removeAttribute('role');
                content.innerHTML = attributes;
            } catch (error) {
                if (root.isConnected) {
                    content.setAttribute('role', 'alert');
                    content.textContent = error.message || 'Không thể tải hồ sơ Sinh viên.';
                }
            }
        }
    };
})();
