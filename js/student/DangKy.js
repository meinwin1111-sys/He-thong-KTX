function openStudentRegistration() {
    const dialog = document.createElement('dialog');
    dialog.className = 'student-register-dialog sr-full-profile';
    dialog.setAttribute('aria-labelledby', 'student-register-title');
    dialog.setAttribute('aria-describedby', 'student-register-description');
    const closeOnEscape = event => {
        if (event.key === 'Escape' && dialog.open) {
            event.preventDefault();
            dialog.close();
        }
    };
    document.addEventListener('keydown', closeOnEscape, true);
    const field = (name, label, type = 'text', attributes = '', required = true) => `<div class="sr-profile-field"><label for="sr-${name}">${label}${required ? ' <span>*</span>' : ''}</label><div class="${type === 'password' ? 'sr-password' : ''}"><input id="sr-${name}" name="${name}" type="${type}" ${required ? 'required' : ''} ${attributes}>${type === 'password' ? `<button type="button" data-toggle="sr-${name}" aria-label="Hiện ${label.toLowerCase()}" aria-pressed="false"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>` : ''}</div></div>`;
    dialog.innerHTML = `<div class="sr-layout">
        <aside class="sr-intro">
            <h2>Ký túc xá – Ngôi nhà thứ hai của bạn</h2>
            <p>Không gian học tập, sinh hoạt và kết nối trong khuôn viên ký túc xá.</p>
            <img class="sr-campus" src="${window.KTX_IMAGE_PATHS?.dormitory || 'files/ky-tuc-xa.webp'}" alt="Khu ký túc xá với tòa nhà và cây xanh" loading="lazy">
        </aside>
        <section class="sr-form-panel">
        <button type="button" data-close class="sr-close" aria-label="Đóng đăng ký"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <h2 id="student-register-title">Đăng ký tài khoản Sinh viên</h2>
        <p id="student-register-description" class="sr-subtitle">Nhập thông tin cá nhân để tạo hồ sơ. Các trường có dấu * là bắt buộc.</p>
        <form><div class="sr-profile-columns"><div>
            ${field('name', 'Họ và tên', 'text', 'maxlength="100" autocomplete="name"')}
            ${field('code', 'Mã sinh viên', 'text', 'maxlength="20" autocomplete="off"')}
            ${field('birthday', 'Ngày sinh', 'text', 'inputmode="numeric" maxlength="10" placeholder="dd/mm/yyyy" autocomplete="bday"')}
            <div class="sr-profile-field"><label for="sr-gender">Giới tính <span>*</span></label><select id="sr-gender" name="gender" required><option value="">Chọn giới tính</option><option>Nam</option><option>Nữ</option><option>Khác</option></select></div>
            ${field('phone', 'Số điện thoại', 'tel', 'maxlength="20" autocomplete="tel" placeholder="0901234567 hoặc +84901234567"')}
        </div><div>
            ${field('email', 'Gmail', 'email', 'maxlength="100" autocomplete="username" placeholder="ten@gmail.com"')}
            ${field('school', 'Trường', 'text', 'maxlength="150" autocomplete="organization"')}
            ${field('className', 'Lớp', 'text', 'maxlength="50"')}
            ${field('address', 'Địa chỉ', 'text', 'maxlength="250" autocomplete="street-address"', false)}
            ${field('password', 'Mật khẩu', 'password', 'minlength="8" maxlength="72" autocomplete="new-password"')}
            ${field('confirm', 'Xác nhận mật khẩu', 'password', 'minlength="8" maxlength="72" autocomplete="new-password"')}
            <small>Mật khẩu tối thiểu 8 ký tự.</small>
        </div></div><p data-error class="sr-error" role="alert"></p>
        <div class="sr-actions"><button type="button" data-close class="sr-back">Quay lại Login</button><button type="submit" class="sr-submit">Đăng ký</button></div>
        </form></section></div>`;
    document.body.appendChild(dialog);
    StudentDate.bindInput(dialog.querySelector('#sr-birthday'));
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        dialog.close();
    });
    dialog.querySelector('.sr-campus')?.addEventListener('error', event => {
        event.currentTarget.hidden = true;
    }, { once: true });
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
        document.removeEventListener('keydown', closeOnEscape, true);
        dialog.remove();
    });
    dialog.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => dialog.close(); });
    dialog.querySelectorAll('[data-toggle]').forEach(button => {
        button.onclick = () => {
            const input = dialog.querySelector(`#${button.dataset.toggle}`);
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(visible));
            button.setAttribute('aria-label', `${visible ? 'Ẩn' : 'Hiện'} ${input.name === 'confirm' ? 'mật khẩu nhập lại' : 'mật khẩu'}`);
            button.querySelector('i').className = visible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
        };
    });
    dialog.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        try {
            const input = Object.fromEntries(new FormData(event.target));
            const student = {};
            for (const key of ['name', 'code', 'gender', 'phone', 'email', 'school', 'className', 'address']) {
                student[key] = String(input[key] || '').trim();
            }
            if (['name', 'code', 'gender', 'phone', 'email', 'school', 'className'].some(key => !student[key])) {
                throw new Error('Vui lòng nhập đầy đủ các trường bắt buộc.');
            }
            student.email = student.email.toLowerCase();
            student.code = student.code.toUpperCase();
            if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(student.email)) {
                throw new Error('Vui lòng nhập Gmail hợp lệ (ten@gmail.com).');
            }
            student.phone = student.phone.replace(/[\s.-]/g, '');
            if (!/^(?:0|\+84)[35789]\d{8}$/.test(student.phone)) {
                throw new Error('Số điện thoại phải là số di động Việt Nam hợp lệ (10 số hoặc +84).');
            }
            if (student.phone.startsWith('+84')) student.phone = `0${student.phone.slice(3)}`;
            if (!['Nam', 'Nữ', 'Khác'].includes(student.gender)) throw new Error('Vui lòng chọn giới tính hợp lệ.');
            const password = String(input.password || '');
            if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
                throw new Error('Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte khi mã hóa.');
            }
            if (password !== input.confirm) throw new Error('Mật khẩu nhập lại không khớp.');

            const response = await ApiClient.fetch('/api/student/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    MaSinhVien: student.code,
                    HoTen: student.name,
                    NgaySinh: StudentDate.birthDateToIso(input.birthday),
                    GioiTinh: student.gender,
                    SoDienThoai: student.phone,
                    Email: student.email,
                    DiaChi: student.address,
                    Truong: student.school,
                    Lop: student.className,
                    MatKhau: password
                })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || 'Không thể gửi đăng ký. Vui lòng thử lại.');
            }
            dialog.close();
            if (typeof showRegistrationSuccessMessage === 'function') {
                showRegistrationSuccessMessage(student.email);
            }
        } catch (error) {
            dialog.querySelector('[data-error]').textContent = error.message || 'Không thể gửi đăng ký. Vui lòng thử lại.';
        }
    };
    dialog.showModal();
    dialog.querySelector('#sr-name').focus();
}
