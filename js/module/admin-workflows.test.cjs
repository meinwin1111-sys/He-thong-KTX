const { test } = require("node:test");
const assert = require("node:assert/strict");
const utils = require("./AdminWorkflowUtils");
const fs = require("node:fs");
const path = require("node:path");

test("Admin money helpers accept positive integer VND and format thousands", () => {
    assert.equal(utils.parseVnd("1.250.000"), 1250000);
    assert.equal(utils.parseVnd("1250000"), 1250000);
    assert.equal(utils.parseVnd("0"), null);
    assert.equal(utils.parseVnd("-1"), null);
    assert.equal(utils.parseVnd("1.5"), null);
    assert.equal(utils.formatVnd(1250000), "1.250.000 đ");
    assert.equal(utils.formatVnd(-1250000), "-1.250.000 đ");
});

test("Admin receipt amount can be rendered in Vietnamese words", () => {
    assert.equal(utils.amountInWords(0), "Không đồng");
    assert.equal(utils.amountInWords(1000000), "Một triệu đồng");
    assert.equal(utils.amountInWords(1250000), "Một triệu hai trăm năm mươi nghìn đồng");
});

test("Admin receipt amount validation prevents exceeding invoice balance", () => {
    assert.equal(utils.exceedsBalance(100, 300), false);
    assert.equal(utils.exceedsBalance(301, 300), true);
    assert.equal(utils.exceedsBalance(0, 300), true);
    assert.equal(utils.exceedsBalance(100, 0), true);
});

test("Admin HTML loads the API-backed workflow instead of legacy finance modules", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "..", "Admin.html"), "utf8");
    const legacyInvoice = fs.readFileSync(path.join(__dirname, "HoaDon.js"), "utf8");
    assert.match(html, /js\/module\/AdminWorkflows\.js/);
    assert.doesNotMatch(html, /js\/module\/HoaDon\.js|js\/payment-demo\.js|js\/module\/ThanhToanDemo\.js/);
    assert.doesNotMatch(legacyInvoice, /ApiClient\.fetch\(API_URL,\s*\{/);
    assert.doesNotMatch(legacyInvoice, /method:\s*['"]PUT['"]/);
});

test("Admin refund edits require an explanation when amount differs from suggestion", () => {
    assert.equal(utils.refundReasonRequired(100, 100, ""), false);
    assert.equal(utils.refundReasonRequired(90, 100, ""), true);
    assert.equal(utils.refundReasonRequired(90, 100, "Lý do điều chỉnh"), false);
});

test("Admin invoice display handles a NULL student without rendering undefined", () => {
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: null, HoTen: null }), "Theo phòng/hợp đồng");
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: "SV01", HoTen: "Nguyễn A" }), "Nguyễn A (SV01)");
});

test("Admin contract module uses the approved Chi tiết hợp đồng label and API alias", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    assert.match(source, /Chi tiết hợp đồng/);
    assert.match(source, /\/api\/chitiethopdong/);
    assert.doesNotMatch(source, /\/api\/history/);
});

test("Admin output escapes API strings before HTML rendering", () => {
    assert.equal(utils.escapeHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});
