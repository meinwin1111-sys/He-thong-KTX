// Student: HopDong
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;
    let backendContracts = [];
    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const formatDate = value => value ? date(String(value).slice(0, 10)) : 'Chưa cập nhật';

    ui.contractDetails = () => fields([['Mã hợp đồng', data.contract.id], ['Mã sinh viên', data.profile.code], ['Sinh viên', data.profile.name], ['Số phòng', data.contract.roomNumber], ['Khu/Tòa', data.room.building], ['Ngày bắt đầu', date(data.contract.start)], ['Ngày kết thúc', date(data.contract.end)], ['Thời hạn hợp đồng', ui.helpers.contractTerm()], ['Trạng thái hợp đồng', ui.helpers.contractStatus()], ['Tiền phòng / tháng', money(data.contract.fee)]]);
    ui.pages.contract = {
        title: 'Hợp đồng',
        render: () => backendStudent()
            ? '<section data-contract-content><p class="st-muted" role="status">Đang tải hợp đồng...</p></section>'
            : contractWarning() + card('Hợp đồng lưu trú hiện tại',
                '<p class="st-muted">Hợp đồng demo theo tài khoản Student hiện tại.</p>' +
                fields([['Mã hợp đồng', data.contract.id], ['Số phòng', data.contract.roomNumber],
                    ['Ngày bắt đầu', date(data.contract.start)], ['Ngày kết thúc', date(data.contract.end)],
                    ['Thời hạn hợp đồng', ui.helpers.contractTerm()],
                    ['Trạng thái hợp đồng', ui.helpers.contractStatus()],
                    ['Tiền phòng / tháng', money(data.contract.fee)]]) +
                '<div class="st-actions"><button type="button" class="st-button" data-action="contract-detail">Xem chi tiết</button><a href="#requests" class="st-button st-primary">Yêu cầu gia hạn</a></div>'),
        async load(root) {
            if (!backendStudent()) return;
            const content = root.querySelector('[data-contract-content]');
            try {
                const response = await ApiClient.fetch('/api/student/contracts');
                const contracts = await response.json();
                if (!root.isConnected) return;
                if (!Array.isArray(contracts)) throw new Error('Dữ liệu hợp đồng không hợp lệ.');
                backendContracts = contracts;
                const active = contracts.find(contract => contract.TrangThaiHopDong === 'Còn hiệu lực') || contracts[0];
                ui.contractDetails = () => active ? fields([
                    ['Mã hợp đồng', active.MaHopDong],
                    ['Mã sinh viên', active.MaSinhVien],
                    ['Sinh viên', window.StudentAuth.session().name],
                    ['Số phòng', active.TenPhong],
                    ['Khu/Tòa', active.Khu || 'Chưa cập nhật'],
                    ['Ngày bắt đầu', formatDate(active.NgayBatDau)],
                    ['Ngày kết thúc', formatDate(active.NgayKetThuc)],
                    ['Trạng thái hợp đồng', active.TrangThaiHopDong],
                    ['Tiền phòng / tháng', money(Number(active.GiaPhong || 0))]
                ]) : '<p class="st-muted">Bạn hiện chưa có hợp đồng.</p>';
                content.innerHTML = contracts.length
                    ? contracts.map(contract => card(
                        contract.TrangThaiHopDong === 'Còn hiệu lực' ? 'Hợp đồng lưu trú hiện tại' : 'Hợp đồng lưu trú',
                        fields([
                            ['Mã hợp đồng', contract.MaHopDong],
                            ['Số phòng', contract.TenPhong],
                            ['Khu/Tòa', contract.Khu || 'Chưa cập nhật'],
                            ['Ngày bắt đầu', formatDate(contract.NgayBatDau)],
                            ['Ngày kết thúc', formatDate(contract.NgayKetThuc)],
                            ['Trạng thái hợp đồng', contract.TrangThaiHopDong],
                            ['Tiền phòng / tháng', money(Number(contract.GiaPhong || 0))]
                        ]) + `<div class="st-actions"><button type="button" class="st-button" data-action="contract-detail" ${active !== contract ? 'disabled' : ''}>Xem chi tiết</button>${contract.TrangThaiHopDong === 'Còn hiệu lực' ? '<a href="#requests" class="st-button st-primary">Yêu cầu gia hạn</a>' : ''}</div>`
                    )).join('')
                    : '<p class="st-muted">Bạn hiện chưa có hợp đồng.</p>';
            } catch (error) {
                if (root.isConnected) content.innerHTML = `<p class="st-notice" role="alert">${esc(error.message || 'Không thể tải hợp đồng.')}</p>`;
            }
        }
    };
})();
