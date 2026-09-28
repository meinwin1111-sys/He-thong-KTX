// Student: HopDong
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    ui.contractDetails = () => fields([['Mã hợp đồng', data.contract.id], ['Mã sinh viên', data.profile.code], ['Sinh viên', data.profile.name], ['Số phòng', data.contract.roomNumber], ['Khu/Tòa', data.room.building], ['Ngày bắt đầu', date(data.contract.start)], ['Ngày kết thúc', date(data.contract.end)], ['Thời hạn hợp đồng', ui.helpers.contractTerm()], ['Trạng thái hợp đồng', ui.helpers.contractStatus()], ['Tiền phòng / tháng', money(data.contract.fee)]]);
    ui.pages.contract = { title: 'Hợp đồng', render: () => contractWarning() + card('Hợp đồng lưu trú hiện tại', '<p class="st-muted">Hợp đồng demo theo tài khoản Student hiện tại.</p>' + fields([['Mã hợp đồng', data.contract.id], ['Số phòng', data.contract.roomNumber], ['Ngày bắt đầu', date(data.contract.start)], ['Ngày kết thúc', date(data.contract.end)], ['Thời hạn hợp đồng', ui.helpers.contractTerm()], ['Trạng thái hợp đồng', ui.helpers.contractStatus()], ['Tiền phòng / tháng', money(data.contract.fee)]]) + '<div class="st-actions"><button type="button" class="st-button" data-action="contract-detail">Xem chi tiết</button><a href="#requests" class="st-button st-primary">Yêu cầu gia hạn</a></div>') };
})();
