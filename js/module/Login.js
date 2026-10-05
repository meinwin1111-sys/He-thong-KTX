/* =========================
   MODULE: LOGIN
   Dùng cho Admin.html
========================= */


/* ---------- Helpers ---------- */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


function getMainContent() {
    return document.getElementById("main-content");
}


function getPageHeader() {
    return document.getElementById("page-header");
}


function hideSystemLayout() {
    const header = document.querySelector("header");
    const nav = document.querySelector("nav");

    if (header) header.style.display = "none";
    if (nav) nav.style.display = "none";

    const main = getMainContent();
    if (main) {
        main.className = "bg-[#f8fafc] p-0";
        main.style.height = "100vh";
        main.style.overflow = "hidden";
    }
}


function showSystemLayout() {
    const header = document.querySelector("header");
    const nav = document.querySelector("nav");

    if (header) header.style.display = "flex";
    if (nav) nav.style.display = "flex";

    const main = getMainContent();
    if (main) {
        main.className = "flex-1 p-6 bg-slate-50";
        main.style.height = "";
        main.style.overflow = "";
    }
}


/* ---------- LOGIN API ---------- */
async function authenticateLogin(email, password) {
    try {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedPassword = String(password || "");

        const response = await ApiClient.fetch(`${BASE_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                Email: normalizedEmail,
                MatKhau: normalizedPassword,
            }),
        });


        const data = await response.json();
        const account = data?.user;
        if (!data || typeof data !== "object"
            || typeof data.token !== "string" || !data.token.trim()
            || !account || typeof account !== "object"
            || account.MaTaiKhoan === undefined || account.MaTaiKhoan === null
            || !["Quản lý", "Sinh viên"].includes(account.VaiTro)) {
            return {
                success: false,
                message: "Email hoặc mật khẩu không đúng.",
                status: 0,
            };
        }
        return {
            success: true,
            token: data.token,
            user: {
                id: account.MaTaiKhoan,
                username: account.TenDangNhap || account.Email || "",
                email: account.Email || "",
                fullName: account.TenHienThi || "",
                phone: account.SoDienThoai || "",
                studentId: account.MaSinhVien || "",
                role: account.VaiTro,
            },
        };
    } catch (error) {
        const status = Number.isInteger(error?.status) ? error.status : 0;
        return {
            success: false,
            message: status === 401
                ? "Email hoặc mật khẩu không đúng."
                : status === 429
                    ? "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau."
                    : "Không thể đăng nhập. Vui lòng thử lại.",
            status,
        };
    }
}


/* ---------- Render Login ---------- */
function renderLoginModule() {
    const main = getMainContent();
    const pageHeader = getPageHeader();


    if (!main) {
        console.error("Không tìm thấy #main-content");
        return;
    }


    hideSystemLayout();


    if (pageHeader) {
        pageHeader.innerHTML = "";
        pageHeader.style.display = "none";
    }


    main.innerHTML = `
        <section id="module-login" aria-label="Đăng nhập hệ thống">
            <aside class="login-intro">
                <div class="login-brand"><span class="login-logo"><i class="fa-solid fa-hotel" aria-hidden="true"></i></span><span>Hệ thống Ký Túc Xá</span></div>
                <div class="login-intro-copy">
                    <h1>Hệ thống<br><span>Ký Túc Xá</span></h1>
                    <p>Quản lý thông tin sinh viên, phòng ở, dịch vụ và các tiện ích một cách hiệu quả, nhanh chóng và tiện lợi.</p>
                    <div class="login-features">
                        <div class="login-feature"><i class="fa-solid fa-users" aria-hidden="true"></i><div><h2>Quản lý sinh viên</h2><p>Thông tin, hồ sơ, lưu trú</p></div></div>
                        <div class="login-feature"><i class="fa-solid fa-house" aria-hidden="true"></i><div><h2>Quản lý phòng</h2><p>Trạng thái, phân bổ, tiện ích</p></div></div>
                        <div class="login-feature"><i class="fa-solid fa-building" aria-hidden="true"></i><div><h2>Dịch vụ tiện ích</h2><p>Hóa đơn, đăng ký, yêu cầu</p></div></div>
                        <div class="login-feature"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i><div><h2>An toàn &amp; Bảo mật</h2><p>Dữ liệu được bảo vệ</p></div></div>
                    </div>
                </div>
                <p class="login-tagline">Ký túc xá – Ngôi nhà thứ hai của bạn</p>
            </aside>
            <div class="login-form-panel">
                <div class="login-card">
                    <div class="login-card-heading">
                        <span class="login-logo"><i class="fa-solid fa-hotel" aria-hidden="true"></i></span>
                        <h2>Đăng nhập</h2>
                        <p>Chào mừng bạn trở lại Cổng thông tin Ký Túc Xá</p>
                    </div>
                    <form id="loginForm" novalidate>
                        <p id="registrationSuccess" class="login-success hidden" role="status" aria-live="polite"></p>
                        <div class="login-field">
                            <label for="loginEmail">Email</label>
                            <div class="login-input-wrap">
                                <i class="fa-regular fa-envelope login-input-icon" aria-hidden="true"></i>
                                <input type="email" id="loginEmail" name="email" placeholder="Nhập email" autocomplete="username" aria-describedby="loginEmailError" required>
                            </div>
                            <p id="loginEmailError" class="login-error hidden" aria-live="polite"></p>
                        </div>
                        <div class="login-field">
                            <label for="loginPassword">Mật khẩu</label>
                            <div class="login-input-wrap">
                                <i class="fa-solid fa-lock login-input-icon" aria-hidden="true"></i>
                                <input type="password" id="loginPassword" name="password" placeholder="Nhập mật khẩu" autocomplete="current-password" aria-describedby="loginPasswordError" required>
                                <button type="button" id="toggleLoginPassword" aria-label="Hiện hoặc ẩn mật khẩu"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
                            </div>
                            <p id="loginPasswordError" class="login-error hidden" aria-live="polite"></p>
                        </div>
                        <div class="login-options">
                            <label class="login-remember"><input type="checkbox" id="loginRemember"> Ghi nhớ đăng nhập</label>
                            <details class="login-forgot"><summary>Quên mật khẩu?</summary><p>Vui lòng liên hệ ban quản lý ký túc xá để được hỗ trợ.</p></details>
                        </div>
                        <button type="submit" class="login-submit">Đăng nhập</button>
                    </form>
                    <div class="login-register"><span>Chưa có tài khoản? <button type="button" onclick="openStudentRegistration()">Đăng ký ngay</button></span></div>
                </div>
            </div>
        </section>
    `;

    bindLoginEvents();
}

function showRegistrationSuccessMessage(email) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const message = document.getElementById("registrationSuccess");
    if (!emailInput || !passwordInput || !message) return;

    emailInput.value = email;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.value = "";
    message.textContent = "Đăng ký thành công, vui lòng đăng nhập.";
    message.classList.remove("hidden");

    const hideMessage = () => {
        message.textContent = "";
        message.classList.add("hidden");
        window.clearTimeout(message.hideTimer);
        emailInput.removeEventListener("input", hideMessage);
        passwordInput.removeEventListener("input", hideMessage);
    };
    window.clearTimeout(message.hideTimer);
    emailInput.addEventListener("input", hideMessage, { once: true });
    passwordInput.addEventListener("input", hideMessage, { once: true });
    message.hideTimer = window.setTimeout(hideMessage, 5000);
    passwordInput.focus();
}


/* ---------- Bind events ---------- */
function bindLoginEvents() {
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const togglePasswordBtn = document.getElementById("toggleLoginPassword");
    const emailError = document.getElementById("loginEmailError");
    const passwordError = document.getElementById("loginPasswordError");


    if (!form || !emailInput || !passwordInput || !emailError || !passwordError) return;


    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener("click", function () {
            const icon = this.querySelector("i");


            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                if (icon) {
                    icon.classList.remove("fa-eye");
                    icon.classList.add("fa-eye-slash");
                }
            } else {
                passwordInput.type = "password";
                if (icon) {
                    icon.classList.remove("fa-eye-slash");
                    icon.classList.add("fa-eye");
                }
            }
        });
    }


    function clearFieldError(input, errorElement) {
        if (!input || !errorElement) return;


        input.classList.remove("input-error");
        input.setAttribute("aria-invalid", "false");


        errorElement.textContent = "";
        errorElement.classList.add("hidden");
    }


    function showFieldError(input, errorElement, message) {
        if (!input || !errorElement) return;


        input.classList.add("input-error");
        input.setAttribute("aria-invalid", "true");


        errorElement.textContent = message;
        errorElement.classList.remove("hidden");
    }


    function markBothFieldsAsInvalid(message) {
        emailInput.classList.add("input-error");
        passwordInput.classList.add("input-error");
        emailInput.setAttribute("aria-invalid", "true");
        passwordInput.setAttribute("aria-invalid", "true");


        emailError.textContent = "";
        emailError.classList.add("hidden");


        passwordError.textContent = message || "Email hoặc mật khẩu không đúng";
        passwordError.classList.remove("hidden");
    }


    function validateLoginForm() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        let valid = true;


        clearFieldError(emailInput, emailError);
        clearFieldError(passwordInput, passwordError);


        if (!email) {
            showFieldError(emailInput, emailError, "Vui lòng nhập email");
            valid = false;
        } else if (!isValidEmail(email)) {
            showFieldError(emailInput, emailError, "Email không hợp lệ");
            valid = false;
        }


        if (!password) {
            showFieldError(passwordInput, passwordError, "Vui lòng nhập mật khẩu");
            valid = false;
        }


        if (!valid) {
            if (!email || !isValidEmail(email)) emailInput.focus();
            else passwordInput.focus();
        }
        return valid;
    }


    form.addEventListener("submit", async function (e) {
        e.preventDefault();


        const valid = validateLoginForm();
        if (!valid) return;


        const email = emailInput.value.trim();
        const password = passwordInput.value;


        clearFieldError(emailInput, emailError);
        clearFieldError(passwordInput, passwordError);

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Đang đăng nhập...";
        }


        const result = await authenticateLogin(email, password);


        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Đăng nhập";
        }


        if (!result.success || !result.user || !result.token) {
            if (result.status === 401 &&
                window.KTX_CONFIG?.allowStudentDemoAuth === true &&
                window.StudentAuth?.isStudentEmail(email)) {
                try {
                    StudentAuth.login(email, password);
                    window.location.assign("Student.html#home");
                    return;
                } catch (error) {
                    markBothFieldsAsInvalid(error.message);
                    return;
                }
            }
            markBothFieldsAsInvalid(result.message || "Không thể đăng nhập. Vui lòng thử lại.");
            return;
        }

        if (result.user.role === "Sinh viên") {
            try {
                ApiClient.setStudentSession(result.token, result.user);
            } catch (error) {
                markBothFieldsAsInvalid(error.message);
                return;
            }
            window.location.assign("Student.html#home");
            return;
        }

        if (result.user.role !== "Quản lý") {
            markBothFieldsAsInvalid("Vai trò tài khoản không được hỗ trợ.");
            return;
        }

        try {
            ApiClient.setSession(result.token, result.user);
        } catch (error) {
            markBothFieldsAsInvalid(error.message);
            return;
        }

        window.currentUser = result.user;


        clearFieldError(emailInput, emailError);
        clearFieldError(passwordInput, passwordError);


        setTimeout(() => {
            showSystemLayout();


            const pageHeader = getPageHeader();
            if (pageHeader) {
                pageHeader.style.display = "block";
            }


            if (typeof renderTrangChuModule === "function") {
                renderTrangChuModule();
            } else if (typeof switchPage === "function") {
                const firstNavItem = document.querySelector("#main-nav .nav-item");
                switchPage("Trang Chu", firstNavItem);
            } else {
                const main = getMainContent();
                if (main) {
                    main.innerHTML = `
                        <div class="bg-white p-8 rounded-lg shadow border">
                            <h2 class="text-2xl font-bold text-slate-900 mb-2">Đăng nhập thành công</h2>
                            <p class="text-slate-500">Chào mừng bạn đến với hệ thống quản lý ký túc xá.</p>
                        </div>
                    `;
                }
            }


            updateAdminHoverPopup();
            bindAdminHoverMenu();
        }, 800);
    });


    emailInput.addEventListener("input", function () {
        clearFieldError(emailInput, emailError);
        clearFieldError(passwordInput, passwordError);
    });


    passwordInput.addEventListener("input", function () {
        clearFieldError(emailInput, emailError);
        clearFieldError(passwordInput, passwordError);
    });
}


/* ---------- Expose global ---------- */
window.renderLoginModule = renderLoginModule;


/* ------- ĐĂNG XUẤT, TÀI KHOẢN, MẬT KHẨU ------- */


function getCurrentUser() {
    return window.currentUser || null;
}


function getUserInitials(name) {
    if (!name) return "A";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return words[words.length - 1].charAt(0).toUpperCase();
}


/* ---------- ADMIN MENU + POPUP ACCOUNT ---------- */
function updateAdminHoverPopup() {
    const user = getCurrentUser();
    if (!user) return;


    const avatar = document.getElementById("account-popup-avatar");
    const name = document.getElementById("account-popup-name");
    const role = document.getElementById("account-popup-role");
    const email = document.getElementById("account-popup-email");
    const phone = document.getElementById("account-popup-phone");
    const adminName = document.getElementById("admin-display-name");
    const adminAvatar = document.getElementById("admin-display-avatar");


    const initials = getUserInitials(user.fullName || user.email || "Q");


    if (avatar) avatar.innerHTML = '<i class="fa-solid fa-user text-2xl"></i>';
    if (name) name.textContent = user.fullName || "Quản trị viên";
    if (role) role.textContent = user.role || "Quản lý";
    if (email) email.textContent = user.email || "Chưa có email";
    if (phone) phone.textContent = user.phone || "Chưa có số điện thoại";
    if (adminName) adminName.textContent = user.fullName || "Quản trị viên";
    if (adminAvatar) adminAvatar.innerHTML = '<i class="fa-solid fa-user text-sm"></i>';
}


function toggleAdminMenu(event) {
    if (event) {
        event.stopPropagation();
    }


    const dropdown = document.getElementById("admin-dropdown");
    if (!dropdown) return;


    updateAdminHoverPopup();


    const isHidden = dropdown.classList.contains("hidden");


    if (isHidden) {
        dropdown.classList.remove("hidden");
    } else {
        dropdown.classList.add("hidden");
        closeAccountHoverPopup();
    }
}


function openAccountHoverPopup() {
    const popup = document.getElementById("account-hover-popup");
    if (!popup) return;


    updateAdminHoverPopup();
    popup.classList.remove("hidden");
}


function closeAccountHoverPopup() {
    const popup = document.getElementById("account-hover-popup");
    if (!popup) return;


    popup.classList.add("hidden");
}


function closeAdminDropdown() {
    const dropdown = document.getElementById("admin-dropdown");
    if (!dropdown) return;


    dropdown.classList.add("hidden");
}


function closeAdminMenu() {
    closeAdminDropdown();
    closeAccountHoverPopup();
}


function bindAdminHoverMenu() {
    const accountItem = document.getElementById("account-menu-item");
    const popup = document.getElementById("account-hover-popup");
    const dropdown = document.getElementById("admin-dropdown");


    if (
        !accountItem ||
        !popup ||
        !dropdown ||
        accountItem.dataset.bound === "true"
    )
        return;
    accountItem.dataset.bound = "true";


    accountItem.addEventListener("mouseenter", function () {
        if (dropdown.classList.contains("hidden")) return;
        openAccountHoverPopup();
    });


    accountItem.addEventListener("mouseleave", function (event) {
        const related = event.relatedTarget;
        if (related && popup.contains(related)) return;
        closeAccountHoverPopup();
    });


    popup.addEventListener("mouseenter", function () {
        if (dropdown.classList.contains("hidden")) return;
        openAccountHoverPopup();
    });


    popup.addEventListener("mouseleave", function () {
        closeAccountHoverPopup();
    });
}


/* ---------- LOGOUT ---------- */
function openLogoutConfirm() {
    closeAdminMenu();


    const modal = document.getElementById("logoutModal");
    if (!modal) return;


    modal.classList.remove("hidden");
    modal.classList.add("flex");
}


function closeLogoutConfirm() {
    const modal = document.getElementById("logoutModal");
    if (!modal) return;


    modal.classList.remove("flex");
    modal.classList.add("hidden");
}


function confirmLogout() {
    closeLogoutConfirm();
    closeAdminMenu();
    closeChangePasswordModal();


    window.currentUser = null;
    ApiClient.clearSession();


    if (typeof renderLoginModule === "function") {
        renderLoginModule();
    }
}


/* ---------- ACCOUNT PAGE ---------- */
function openAccountInfo() {
    closeAdminMenu();


    const user = getCurrentUser();
    if (!user) {
        if (typeof showToast === "function") {
            showToast("Bạn chưa đăng nhập.", "error");
        }
        return;
    }


    document
        .querySelectorAll(".nav-item")
        .forEach((nav) => nav.classList.remove("nav-active"));


    renderAccountPage();
}


function renderAccountPage() {
    const user = getCurrentUser();
    const main = document.getElementById("main-content");
    if (!main || !user) return;


    const initials = getUserInitials(user.fullName);


    main.innerHTML = `
        <section class="page-section active">
            <div class="flex justify-between items-start mb-6">
                <div class="w-full text-center">
                    <h2 class="text-4xl font-bold text-slate-900 mb-2">Thông tin tài khoản</h2>
                    <p class="text-slate-500">Xem và quản lý thông tin cá nhân của tài khoản đang đăng nhập</p>
                </div>
            </div>


            <div class="flex justify-center">
                <div class="w-full max-w-[420px] bg-white rounded-2xl shadow-md border border-slate-200 p-6">
                    <div class="flex flex-col items-center">
                        <div class="w-16 h-16 rounded-full bg-emerald-600 text-white text-4xl font-bold flex items-center justify-center mb-4">
                            ${initials}
                        </div>


                        <h3 class="text-[28px] font-bold text-slate-900 text-center mb-2">
                            ${user.fullName}
                        </h3>


                        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 mb-6">
                            ${user.role}
                        </span>
                    </div>


                    <div class="space-y-4">
                        <div class="border-b border-slate-200 pb-3">
                            <p class="text-[11px] text-slate-500 mb-1">Tên đăng nhập</p>
                            <p class="text-[14px] font-semibold text-slate-900">${user.username || user.email}</p>
                        </div>


                        <div class="border-b border-slate-200 pb-3">
                            <p class="text-[11px] text-slate-500 mb-1">Email</p>
                            <p class="text-[14px] font-semibold text-slate-900">${user.email}</p>
                        </div>


                        <div class="border-b border-slate-200 pb-3">
                            <p class="text-[11px] text-slate-500 mb-1">Số điện thoại</p>
                            <p class="text-[14px] font-semibold text-slate-900">${user.phone}</p>
                        </div>
                    </div>


                    <button
                        onclick="openChangePasswordModal()"
                        class="w-full mt-6 h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                    >
                        Đổi mật khẩu
                    </button>
                </div>
            </div>
        </section>
    `;
}


/* ---------- CHANGE PASSWORD MODAL ---------- */
function clearChangePasswordErrors() {
    const fields = [
        ["currentPassword", "currentPasswordError"],
        ["newPassword", "newPasswordError"],
        ["confirmNewPassword", "confirmNewPasswordError"],
    ];


    fields.forEach(([inputId, errorId]) => {
        const input = document.getElementById(inputId);
        const errorEl = document.getElementById(errorId);


        if (input) {
            input.classList.remove("border-red-300", "bg-red-50");
            input.classList.add("border-slate-200", "bg-white");
        }


        if (errorEl) {
            errorEl.textContent = "";
            errorEl.classList.add("hidden");
        }
    });
}


function resetChangePasswordForm() {
    const form = document.getElementById("changePasswordForm");
    if (form) form.reset();


    const currentPassword = document.getElementById("currentPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmNewPassword = document.getElementById("confirmNewPassword");


    if (currentPassword) currentPassword.type = "password";
    if (newPassword) newPassword.type = "password";
    if (confirmNewPassword) confirmNewPassword.type = "password";


    const toggles = document.querySelectorAll('[data-toggle-target]');
    toggles.forEach((btn) => {
        const icon = btn.querySelector("i");
        if (icon) {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    });


    clearChangePasswordErrors();
}


function openChangePasswordModal() {
    const user = getCurrentUser();
    if (!user) {
        if (typeof showToast === "function") {
            showToast("Bạn chưa đăng nhập.", "error");
        }
        return;
    }


    closeAdminMenu();


    const modal = document.getElementById("changePasswordModal");
    if (!modal) return;


    resetChangePasswordForm();
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}


function closeChangePasswordModal() {
    const modal = document.getElementById("changePasswordModal");
    if (!modal) return;


    modal.classList.remove("flex");
    modal.classList.add("hidden");


    resetChangePasswordForm();
}


function togglePasswordField(inputId, buttonEl) {
    const input = document.getElementById(inputId);
    if (!input || !buttonEl) return;


    const icon = buttonEl.querySelector("i");
    if (!icon) return;


    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    }
}


function bindChangePasswordEvents() {
    const form = document.getElementById("changePasswordForm");
    if (!form || form.dataset.bound === "true") return;


    form.dataset.bound = "true";


    const currentPassword = document.getElementById("currentPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmNewPassword = document.getElementById("confirmNewPassword");


    const currentPasswordError = document.getElementById("currentPasswordError");
    const newPasswordError = document.getElementById("newPasswordError");
    const confirmNewPasswordError = document.getElementById(
        "confirmNewPasswordError",
    );


    function clearFieldError(input, errorEl) {
        if (!input || !errorEl) return;
        input.classList.remove("border-red-300", "bg-red-50");
        input.classList.add("border-slate-200", "bg-white");
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
    }


    function showFieldError(input, errorEl, message) {
        if (!input || !errorEl) return;
        input.classList.remove("border-slate-200", "bg-white");
        input.classList.add("border-red-300", "bg-red-50");
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
    }


    function clearAllErrors() {
        clearFieldError(currentPassword, currentPasswordError);
        clearFieldError(newPassword, newPasswordError);
        clearFieldError(confirmNewPassword, confirmNewPasswordError);
    }


    form.addEventListener("submit", async function (e) {
        e.preventDefault();


        const user = getCurrentUser();
        if (!user) {
            if (typeof showToast === "function") {
                showToast("Bạn chưa đăng nhập.", "error");
            }
            return;
        }


        const currentValue = currentPassword.value;
        const newValue = newPassword.value;
        const confirmValue = confirmNewPassword.value;


        let valid = true;
        clearAllErrors();


        if (!currentValue) {
            showFieldError(
                currentPassword,
                currentPasswordError,
                "Vui lòng nhập mật khẩu hiện tại",
            );
            valid = false;
        }


        if (!newValue) {
            showFieldError(
                newPassword,
                newPasswordError,
                "Vui lòng nhập mật khẩu mới",
            );
            valid = false;
        } else if (newValue === currentValue) {
            showFieldError(
                newPassword,
                newPasswordError,
                "Mật khẩu mới phải khác mật khẩu hiện tại",
            );
            valid = false;
        }


        if (!confirmValue) {
            showFieldError(
                confirmNewPassword,
                confirmNewPasswordError,
                "Vui lòng xác nhận mật khẩu mới",
            );
            valid = false;
        } else if (confirmValue !== newValue) {
            showFieldError(
                confirmNewPassword,
                confirmNewPasswordError,
                "Xác nhận mật khẩu không đúng",
            );
            valid = false;
        }


        if (!valid) return;


        const result = await changePassword(user.id, currentValue, newValue);


        if (!result.success) {
            showFieldError(
                currentPassword,
                currentPasswordError,
                result.message || "Đổi mật khẩu thất bại",
            );
            return;
        }


        closeChangePasswordModal();


        if (typeof showToast === "function") {
            showToast("Đổi mật khẩu thành công", "success");
        }
    });


    [currentPassword, newPassword, confirmNewPassword].forEach((input, index) => {
        if (!input) return;
        input.addEventListener("input", function () {
            if (index === 0) clearFieldError(currentPassword, currentPasswordError);
            if (index === 1) clearFieldError(newPassword, newPasswordError);
            if (index === 2) {
                clearFieldError(confirmNewPassword, confirmNewPasswordError);
            }
        });
    });
}


/* ---------- GLOBAL EVENTS ---------- */
document.addEventListener("click", function (event) {
    const wrapper = document.getElementById("admin-menu-wrapper");
    if (wrapper && !wrapper.contains(event.target)) {
        closeAdminMenu();
    }


    const changePasswordModal = document.getElementById("changePasswordModal");
    if (changePasswordModal && event.target === changePasswordModal) {
        closeChangePasswordModal();
    }


    const logoutModal = document.getElementById("logoutModal");
    if (logoutModal && event.target === logoutModal) {
        closeLogoutConfirm();
    }
});


document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeAdminMenu();
        closeLogoutConfirm();
        closeChangePasswordModal();
    }
});


document.addEventListener("DOMContentLoaded", function () {
    bindAdminHoverMenu();
    updateAdminHoverPopup();
    bindChangePasswordEvents();
});

window.addEventListener("api:unauthorized", function () {
    if (window.location.pathname.toLowerCase().endsWith("student.html")) {
        window.location.replace("Admin.html");
        return;
    }
    window.currentUser = null;
    renderLoginModule();
    if (typeof showToast === "function") {
        showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "error");
    }
});


/*đổi mật khẩu */
async function changePassword(maTaiKhoan, matKhauHienTai, matKhauMoi) {
    try {
        const response = await ApiClient.fetch(`${BASE_URL}/api/change-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                MaTaiKhoan: maTaiKhoan,
                MatKhauHienTai: matKhauHienTai,
                MatKhauMoi: matKhauMoi,
            }),
        });


        const data = await response.json();


        return data;
    } catch (error) {
        return { success: false, message: error.message || "Không thể đổi mật khẩu." };
    }
}
