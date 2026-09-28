# Student Front-end

Open Admin.html on localhost or Live Server and choose the registration link. Register with a Gmail address and complete your personal profile. No mock roster matching is required. Sign in using the new Gmail and password.

Required: name, student code, birthday, gender, mobile phone, Gmail, school, class, password and confirmation. Address is optional. Passwords require at least 8 characters. Student code and Gmail must be unique among stored Student accounts. Phone accepts Vietnamese mobile numbers (10 digits or +84). Future and invalid birthdays are rejected.

- auth.js: mock account/profile storage and 24-hour session. Keys: ktx.student.mock.accounts.v1 and ktx.student.mock.session.v1.
- DangKy.js: two-column registration form; single column on small screens.
- data.js: loads the signed-in profile. Other residence records remain sample data.
- ThongTinCaNhan.js: displays all registered profile fields.
- app.js: routes, account dropdown and demo interactions.
- Other screen files and helpers.js retain their existing responsibilities.

Old registered accounts are retained; missing profile fields display an unavailable label. The original demo student@ktx.com / 123456 remains supported. New registrations require 8-character passwords.

This is local demo authentication, not Gmail verification. Credentials are stored locally; use test passwords only. Student account emails use the mock branch; other emails continue through the unchanged Admin API. Do not register a real Admin email as a Student demo account. Logout removes only the Student session. Payment and password-change pages remain UI demos.
