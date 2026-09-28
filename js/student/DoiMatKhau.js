// Student: DoiMatKhau
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    ui.pages.password = { title: 'Đổi mật khẩu', render: () => card('Đổi mật khẩu (demo)', `<p class="st-muted">Chỉ kiểm tra giao diện, không lưu hay thay đổi mật khẩu thật. Hãy dùng mật khẩu giả khi thử.</p><form id="student-password-form"><label>Mật khẩu hiện tại<input type="password" name="current" required autocomplete="off" maxlength="128"></label><label>Mật khẩu mới<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="off"></label><label>Nhập lại mật khẩu mới<input type="password" name="confirm" required minlength="8" maxlength="128" autocomplete="off"></label><p class="st-muted">Mật khẩu mới tối thiểu 8 ký tự.</p><button class="st-button st-primary" type="submit">Xác nhận (demo)</button></form>`) };
})();
