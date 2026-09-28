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


        console.log("Email gui di:", JSON.stringify(normalizedEmail));
        console.log("Mat khau gui di:", JSON.stringify(normalizedPassword));
        console.log(
            "Ma ky tu password:",
            [...normalizedPassword].map((ch) => `${ch} => ${ch.charCodeAt(0)}`),
        );


        const response = await fetch(`${BASE_URL}/api/login`, {
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


        if (!response.ok) {
            return {
                success: false,
                message: data.message || "Đăng nhập thất bại",
            };
        }


        return {
            success: true,
            user: {
                id: data.user.MaTaiKhoan,
                username: data.user.TenDangNhap || data.user.Email || "",
                email: data.user.Email || "",
                fullName: data.user.TenHienThi || "",
                phone: data.user.SoDienThoai || "",
                role: data.user.VaiTro || "",
            },
        };
    } catch (error) {
        console.error("Lỗi gọi API login:", error);
        return {
            success: false,
            message: "Không kết nối được server",
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
        <section id="module-login" class="w-full bg-[#f8fafc]" style="height:100vh;">
            <div class="w-full h-full">
                    <div class="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] w-full h-full bg-white">


                        <!-- LEFT PANEL -->
                        <div class="relative overflow-hidden bg-gradient-to-b from-[#059669] to-[#064e3b] text-white px-8 pt-6 pb-6 flex flex-col">
                            <div class="absolute w-[220px] h-[220px] rounded-full bg-white/10 -top-10 -right-12"></div>
                            <div class="absolute w-[170px] h-[170px] rounded-full bg-white/10 -bottom-10 -left-10"></div>


                            <div class="flex items-center gap-3 mb-12 relative z-10">
                                <div class="flex items-center gap-2">
                                    <div class="bg-yellow-400 p-1 rounded">
                                        <i class="fa-solid fa-hotel text-white text-xl"></i>
                                    </div>
                                    <div>
                                        <h1 class="text-xl font-extrabold text-white leading-tight">DMS</h1>
                                        <p class="text-[8px] text-emerald-200 uppercase">Dormitory Management System</p>
                                    </div>
                                </div>
                            </div>


                            <div class="flex-1 flex items-center justify-center">
                                <div class="relative rounded-[22px] border border-white/10 bg-white/5 h-[320px] w-full max-w-[540px] overflow-hidden flex items-center justify-center">
                                    <div class="absolute w-28 h-28 rounded-full bg-white/10 left-8 top-12"></div>
                                    <div class="absolute w-12 h-12 rounded-full bg-white/10 left-16 bottom-10"></div>
                                    <div class="absolute w-20 h-20 rounded-full bg-white/10 right-6 bottom-5"></div>
                                    <div class="absolute w-16 h-16 rounded-full bg-white/10 right-16 top-20"></div>
                                    <div class="absolute w-[120px] h-[120px] rounded-full bg-white/8 left-24 bottom-5"></div>


                                    <div class="relative z-10 w-[120px] h-[145px] bg-slate-50 rounded-[16px] shadow-2xl flex items-center justify-center">
                                        <div class="absolute top-[-8px] left-1/2 -translate-x-1/2 w-[42px] h-[12px] bg-slate-300 rounded-full"></div>


                                        <div class="w-[78px] h-[102px] bg-gradient-to-b from-emerald-100 to-emerald-50 rounded-[12px] relative">
                                            <div class="absolute top-4 left-4 w-5 h-5 rounded-full bg-yellow-400"></div>
                                            <div class="absolute top-5 left-9 w-5 h-5 rounded-full bg-emerald-600"></div>


                                            <div class="absolute top-12 left-4 right-4 h-1.5 bg-emerald-300 rounded-full"></div>
                                            <div class="absolute top-[52px] left-4 right-4 h-1.5 bg-emerald-300 rounded-full"></div>
                                            <div class="absolute top-[64px] left-4 right-7 h-1.5 bg-emerald-300 rounded-full"></div>


                                            <div class="absolute bottom-0 left-4 w-4 h-7 bg-yellow-400 rounded-b"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        <!-- RIGHT PANEL -->
                        <div class="bg-[#f8fafc] px-10 lg:px-16 py-8 flex items-center justify-center">
                            <div class="w-full max-w-[540px]">
                                <h2 class="text-[64px] font-extrabold text-[#0f172a] leading-none mb-12">
                                    Đăng nhập
                                </h2>


                                <form id="loginForm" novalidate>
                                    <div class="mb-7">
                                        <label for="loginEmail" class="block mb-3 text-[15px] font-bold text-slate-900">
                                            Email
                                        </label>
                                        <input
                                            type="text"
                                            id="loginEmail"
                                            name="email"
                                            placeholder="Nhập email"
                                            autocomplete="username"
                                            class="w-full h-14 rounded-[12px] border border-slate-200 bg-white px-5 text-[15px] outline-none focus:border-emerald-400"
                                        />
                                        <p id="loginEmailError" class="mt-2 text-[12px] text-red-500 font-medium hidden"></p>
                                    </div>


                                    <div class="mb-5">
                                        <label for="loginPassword" class="block mb-3 text-[15px] font-bold text-slate-900">
                                            Mật khẩu
                                        </label>


                                        <div class="relative">
                                            <input
                                                type="password"
                                                id="loginPassword"
                                                name="password"
                                                placeholder="Nhập mật khẩu"
                                                autocomplete="current-password"
                                                class="w-full h-14 rounded-[12px] border border-slate-200 bg-white px-5 pr-14 text-[15px] outline-none focus:border-emerald-400"
                                            />


                                            <button
                                                type="button"
                                                id="toggleLoginPassword"
                                                class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-600"
                                                aria-label="Hiện mật khẩu"
                                            >
                                                <i class="fa-regular fa-eye"></i>
                                            </button>
                                        </div>


                                        <p id="loginPasswordError" class="mt-2 text-[12px] text-red-500 font-medium hidden"></p>
                                    </div>


                                    <button
                                        type="submit"
                                        class="w-full h-14 rounded-[12px] bg-gradient-to-b from-[#059669] to-[#047857] text-white text-[16px] font-bold shadow-[0_10px_20px_rgba(5,150,105,0.28)] hover:opacity-95"
                                    >
                                        Đăng nhập
                                    </button>
                                </form>
                                <button type="button" onclick="openStudentRegistration()" class="mt-4 text-emerald-600 font-semibold hover:underline">Đăng ký tài khoản</button>
                            </div>
                        </div>


                    </div>
            </div>
        </section>
    `;


    bindLoginEvents();
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


        errorElement.textContent = "";
        errorElement.classList.add("hidden");
    }


    function showFieldError(input, errorElement, message) {
        if (!input || !errorElement) return;


        input.classList.add("input-error");


        errorElement.textContent = message;
        errorElement.classList.remove("hidden");
    }


    function markBothFieldsAsInvalid(message) {
        emailInput.classList.add("input-error");
        passwordInput.classList.add("input-error");


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

        // Chỉ email trong danh sách Student demo mới đi vào nhánh mock.
        // Tất cả email khác tiếp tục dùng nguyên luồng API Admin bên dưới.
        if (window.StudentAuth?.isStudentEmail(email)) {
            try {
                StudentAuth.login(email, password);
                window.location.assign('Student.html#home');
            } catch (error) {
                markBothFieldsAsInvalid(error instanceof DOMException ? 'Không thể lưu phiên Student. Vui lòng cho phép lưu trữ trình duyệt.' : error.message);
            }
            return;
        }


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


        if (!result.success) {
            markBothFieldsAsInvalid("Email hoặc mật khẩu không đúng");
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
    if (role) role.textContent = user.role || "Admin";
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


/*đổi mật khẩu */
async function changePassword(maTaiKhoan, matKhauHienTai, matKhauMoi) {
    try {
        const response = await fetch(`${BASE_URL}/api/change-password`, {
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


        if (!response.ok) {
            return { success: false, message: data.message };
        }
        return data;
    } catch (error) {
        return { success: false, message: "Lỗi server" };
    }
}

