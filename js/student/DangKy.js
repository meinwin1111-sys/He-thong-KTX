function openStudentRegistration() {
    const dialog = document.createElement('dialog');
    dialog.className = 'student-register-dialog sr-full-profile';
    dialog.setAttribute('aria-labelledby', 'student-register-title');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const field = (name, label, type = 'text', attributes = '', required = true) => `<div class="sr-profile-field"><label for="sr-${name}">${label}${required ? ' <span>*</span>' : ''}</label><div class="${type === 'password' ? 'sr-password' : ''}"><input id="sr-${name}" name="${name}" type="${type}" ${required ? 'required' : ''} ${attributes}>${type === 'password' ? `<button type="button" data-toggle="sr-${name}" aria-label="Hiện ${label.toLowerCase()}" aria-pressed="false"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>` : ''}</div></div>`;
    dialog.innerHTML = `<section class="sr-form-panel">
        <button type="button" data-close class="sr-close" aria-label="Đóng đăng ký"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <h2 id="student-register-title">Đăng ký tài khoản Sinh viên</h2>
        <p class="sr-subtitle">Nhập thông tin cá nhân để tạo hồ sơ. Các trường có dấu * là bắt buộc.</p>
        <p class="sr-demo-note">Bản demo lưu tài khoản trên trình duyệt, chưa xác thực Gmail. Chỉ sử dụng mật khẩu thử nghiệm.</p>
        <form><div class="sr-profile-columns"><div>
            ${field('name', 'Họ và tên', 'text', 'maxlength="100" autocomplete="name"')}
            ${field('code', 'Mã sinh viên', 'text', 'maxlength="30" autocomplete="off"')}
            ${field('birthday', 'Ngày sinh', 'date', `max="${today}" autocomplete="bday"`)}
            <div class="sr-profile-field"><label for="sr-gender">Giới tính <span>*</span></label><select id="sr-gender" name="gender" required><option value="">Chọn giới tính</option><option>Nam</option><option>Nữ</option><option>Khác</option></select></div>
            ${field('phone', 'Số điện thoại', 'tel', 'maxlength="20" autocomplete="tel" placeholder="0901234567 hoặc +84901234567"')}
        </div><div>
            ${field('email', 'Gmail', 'email', 'maxlength="254" autocomplete="username" placeholder="ten@gmail.com"')}
            ${field('school', 'Trường', 'text', 'maxlength="150" autocomplete="organization"')}
            ${field('className', 'Lớp', 'text', 'maxlength="50"')}
            ${field('address', 'Địa chỉ', 'text', 'maxlength="250" autocomplete="street-address"', false)}
            ${field('password', 'Mật khẩu', 'password', 'minlength="8" maxlength="128" autocomplete="new-password"')}
            ${field('confirm', 'Xác nhận mật khẩu', 'password', 'minlength="8" maxlength="128" autocomplete="new-password"')}
            <small>Mật khẩu tối thiểu 8 ký tự.</small>
        </div></div><p data-error class="sr-error" role="alert"></p>
        <div class="sr-actions"><button type="button" data-close class="sr-back">Quay lại Login</button><button type="submit" class="sr-submit">Đăng ký</button></div>
        </form></section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => dialog.close(); });
    dialog.querySelectorAll('[data-toggle]').forEach(button => {
        button.onclick = () => {
            const input = dialog.querySelector(`#${button.dataset.toggle}`);
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(visible));
            button.setAttribute('aria-label', `${visible ? 'Ẩn' : 'Hiện'} ${input.name === 'confirm' ? 'mật khẩu nhập lại' : 'mật khẩu demo'}`);
            button.querySelector('i').className = visible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
        };
    });
    dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        try {
            const email = StudentAuth.register(Object.fromEntries(new FormData(event.target)));
            dialog.close();
            document.getElementById('loginEmail').value = email;
            document.getElementById('loginEmail').dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginPassword').focus();
            showToast('Đăng ký tài khoản thành công');
        } catch (error) {
            dialog.querySelector('[data-error]').textContent = error instanceof DOMException ? 'Không thể lưu tài khoản. Hãy cho phép lưu trữ trình duyệt rồi thử lại.' : error.message;
        }
    };
    dialog.showModal();
}
