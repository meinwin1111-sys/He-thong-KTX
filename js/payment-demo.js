// Khi có BE, thay phần implement bằng fetch tới API, giữ nguyên chữ ký hàm.
// Shared browser-only ledger. Never calls the Admin API or stores authentication data.
(() => {
    const prefix = 'ktx.billing.demo.v1.';
    const key = code => prefix + encodeURIComponent(code);
    const LEGACY = [['room', 'ROOM', 'Tiền phòng'], ['electricity', 'ELECTRICITY', 'Tiền điện'], ['water', 'WATER', 'Tiền nước']];
    const moneyAmount = value => {
        const amount = Number(value);
        if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Số tiền hóa đơn không hợp lệ.');
        return amount;
    };
    const overdue = invoice => new Date(`${invoice.due}T23:59:59.999`) < new Date();
    const activeItems = invoice => (Array.isArray(invoice.items) ? invoice.items : []).filter(item => moneyAmount(item.amount) > 0);
    const invoiceTotal = invoice => (Array.isArray(invoice.items) ? invoice.items : []).reduce((sum, item) => sum + moneyAmount(item.amount), 0);
    const invoiceDebt = invoice => activeItems(invoice).filter(item => item.status !== 'PAID').reduce((sum, item) => sum + moneyAmount(item.amount), 0);
    const amount = invoice => {
        if (Array.isArray(invoice.items)) return invoiceDebt(invoice);
        const value = Number(invoice.remainingAmount ?? invoice.totalAmount ??
            (Number(invoice.room) + Number(invoice.electricity) + Number(invoice.water)));
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Số tiền hóa đơn không hợp lệ.');
        return value;
    };
    const status = invoice => {
        const items = activeItems(invoice);
        if (!items.length) {
            return invoice.paid || invoice.status === 'PAID' ? 'PAID' : overdue(invoice) ? 'OVERDUE' : 'UNPAID';
        }
        if (items.every(item => item.status === 'PAID')) return 'PAID';
        if (items.some(item => item.status === 'PAID')) return 'PARTIAL';
        if (items.every(item => item.status === 'WAITING_CASH')) return 'WAITING_CASH';
        return overdue(invoice) ? 'OVERDUE' : 'UNPAID';
    };
    function refreshInvoice(invoice) {
        invoice.status = status(invoice);
        invoice.paid = invoice.status === 'PAID';
        invoice.totalAmount = Array.isArray(invoice.items) ? invoiceTotal(invoice) : invoice.totalAmount;
        invoice.remainingAmount = amount(invoice);
        return invoice;
    }
    function migrateInvoice(invoice, requests) {
        if (!Array.isArray(invoice.items)) {
            const items = [];
            for (const [field, code, name] of LEGACY) {
                const value = Number(invoice[field]) || 0;
                if (value > 0) items.push({ id: `${invoice.id}-${code}`, code, name, amount: value, status: 'UNPAID' });
            }
            invoice.items = items;
        }
        invoice.items.forEach(item => {
            item.amount = Number(item.amount) || 0;
            if (!item.status) item.status = 'UNPAID';
        });
        if (invoice.paid || invoice.status === 'PAID') {
            invoice.items.forEach(item => { item.status = 'PAID'; });
        } else if (invoice.status === 'WAITING_CASH') {
            invoice.items.forEach(item => { if (item.status !== 'PAID') item.status = 'WAITING_CASH'; });
            const request = requests.find(entry => entry.invoiceId === invoice.id && entry.status === 'WAITING_CASH');
            if (request) {
                if (!request.id) request.id = `REQ-${invoice.id}`;
                request.items = invoice.items.filter(item => item.status === 'WAITING_CASH').map(item => ({
                    invoiceId: invoice.id, itemId: item.id, name: item.name, amount: item.amount, code: item.code
                }));
                request.amount = request.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            }
        }
        return refreshInvoice(invoice);
    }
    function read(code) {
        const raw = localStorage.getItem(key(code));
        if (!raw) return null;
        const value = JSON.parse(raw);
        if (value.studentId !== code || !Array.isArray(value.invoices) || !Array.isArray(value.payments) || !Array.isArray(value.requests)) {
            throw new Error('Dữ liệu thanh toán demo không hợp lệ. Không ghi đè dữ liệu đã lưu.');
        }
        value.invoices.forEach(invoice => migrateInvoice(invoice, value.requests));
        return value;
    }
    function save(value) {
        // One atomic storage write commits invoice, request and receipt together.
        localStorage.setItem(key(value.studentId), JSON.stringify(value));
        window.dispatchEvent(new Event('ktx-payment-change'));
    }
    function initialize(data) {
        const code = data.profile.code;
        if (!code) throw new Error('Không tìm thấy mã sinh viên đang đăng nhập.');
        let value = read(code);
        if (!value) {
            value = { studentId: code, studentName: data.profile.name, room: data.room.number,
                invoices: data.invoices.map(invoice => migrateInvoice({ ...invoice, items: invoice.items?.map(item => ({ ...item })) }, [])),
                payments: data.payments.map(p => ({ ...p, studentId: code, studentName: data.profile.name,
                    room: data.room.number, paymentMethod: p.method === 'Tiền mặt' ? 'CASH' : 'ONLINE',
                    paymentTime: p.paymentTime || p.date, transactionId: p.transactionId || p.id })), requests: [] };
            save(value);
        }
        return value;
    }
    function flatten(selection) {
        if (!Array.isArray(selection) || !selection.length) throw new Error('Chưa chọn hạng mục thanh toán.');
        const seen = new Set();
        const rows = [];
        for (const group of selection) {
            if (!group?.invoiceId || !Array.isArray(group.itemIds) || !group.itemIds.length) {
                throw new Error('Chưa chọn hạng mục thanh toán.');
            }
            for (const itemId of group.itemIds) {
                const token = `${group.invoiceId}\0${itemId}`;
                if (seen.has(token)) throw new Error('Hạng mục bị trùng trong lựa chọn.');
                seen.add(token);
                rows.push({ invoiceId: group.invoiceId, itemId });
            }
        }
        return rows;
    }
    function resolve(value, selection) {
        if (!value) throw new Error('Chưa có dữ liệu hóa đơn của sinh viên.');
        return flatten(selection).map(({ invoiceId, itemId }) => {
            const invoice = value.invoices.find(entry => entry.id === invoiceId);
            if (!invoice) throw new Error('Hóa đơn không tồn tại.');
            const item = (invoice.items || []).find(entry => entry.id === itemId);
            if (!item) throw new Error('Hạng mục không tồn tại.');
            if (item.status === 'PAID') throw new Error('Hạng mục đã thanh toán.');
            if (item.status === 'WAITING_CASH') throw new Error('Hạng mục đang chờ thanh toán tiền mặt.');
            const itemAmount = moneyAmount(item.amount);
            if (itemAmount <= 0) throw new Error('Hạng mục không còn số tiền phải thanh toán.');
            return { invoice, item, amount: itemAmount };
        });
    }
    function snapshot(resolved) {
        return resolved.map(row => ({
            invoiceId: row.invoice.id, itemId: row.item.id, name: row.item.name,
            amount: row.amount, code: row.item.code, note: row.item.note || ''
        }));
    }
    function buildQr(value, selection) {
        const resolved = resolve(value, selection);
        const total = resolved.reduce((sum, row) => sum + row.amount, 0);
        const reference = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
        const items = snapshot(resolved).map(item => ({ invoiceId: item.invoiceId, itemId: item.itemId, amount: item.amount }));
        const payload = { studentId: value.studentId, amount: total, paymentContent: `KTX ${value.studentId} ${reference}`, items };
        return { ...payload, studentName: value.studentName, room: value.room, details: snapshot(resolved),
            qrPayload: JSON.stringify(payload).length > 800
                ? { studentId: payload.studentId, amount: payload.amount, paymentContent: payload.paymentContent } : payload };
    }
    function complete(value, resolved, method, reviewer) {
        const now = new Date();
        const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const id = `${method === 'ONLINE' ? 'DEMO' : 'CASH'}-${day}-${crypto.randomUUID()}`;
        const items = snapshot(resolved);
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        const invoiceIds = [...new Set(items.map(item => item.invoiceId))];
        const receipt = { id, transactionId: id, studentId: value.studentId, studentName: value.studentName, room: value.room,
            invoiceId: invoiceIds.join(', '), amount: total, items, paymentStatus: 'SUCCESS', status: 'SUCCESS',
            paymentMethod: method, paymentTime: now.toISOString(), date: now.toISOString(),
            method: method === 'ONLINE' ? 'Online' : 'Tiền mặt', confirmedBy: reviewer || null };
        for (const row of resolved) row.item.status = 'PAID';
        for (const invoice of new Set(resolved.map(row => row.invoice))) {
            refreshInvoice(invoice);
            if (invoice.paid) {
                Object.assign(invoice, { paidAmount: invoice.totalAmount, paymentMethod: method,
                    paymentTime: receipt.paymentTime, transactionId: id });
            }
        }
        value.payments.unshift(receipt);
        return receipt;
    }
    async function mutate(code, callback) {
        // Serialize across tabs; never fall back to an unsafe read/modify/write race.
        if (!navigator.locks) throw new Error('Hãy mở bản demo trên localhost hoặc HTTPS bằng trình duyệt hỗ trợ Web Locks.');
        return navigator.locks.request(key(code), () => {
            const value = read(code);
            if (!value) throw new Error('Chưa có dữ liệu hóa đơn của sinh viên.');
            const result = callback(value);
            save(value);
            return result;
        });
    }
    function all() {
        const values = [];
        for (let i = 0; i < localStorage.length; i++) {
            const name = localStorage.key(i);
            if (name?.startsWith(prefix)) values.push(read(decodeURIComponent(name.slice(prefix.length))));
        }
        return values.filter(Boolean);
    }
    window.KTXPaymentDemo = {
        prefix, amount, status, read, initialize, all,
        async getInvoices(code) {
            const value = read(code);
            if (!value) throw new Error('Chưa có dữ liệu hóa đơn của sinh viên.');
            return value.invoices;
        },
        async qrDetails(code, selection) {
            const value = read(code);
            if (!value) throw new Error('Chưa có dữ liệu hóa đơn của sinh viên.');
            return buildQr(value, selection);
        },
        payOnline(code, selection) {
            return mutate(code, value => complete(value, resolve(value, selection), 'ONLINE'));
        },
        requestCash(code, selection) {
            return mutate(code, value => {
                const resolved = resolve(value, selection);
                const items = snapshot(resolved);
                const request = { id: `REQ-${crypto.randomUUID()}`, studentId: value.studentId, studentName: value.studentName,
                    room: value.room, invoiceId: [...new Set(items.map(item => item.invoiceId))].join(', '),
                    amount: items.reduce((sum, item) => sum + item.amount, 0), items, paymentMethod: 'CASH',
                    requestedAt: new Date().toISOString(), status: 'WAITING_CASH' };
                for (const row of resolved) row.item.status = 'WAITING_CASH';
                for (const invoice of new Set(resolved.map(row => row.invoice))) refreshInvoice(invoice);
                value.requests.push(request);
                return request;
            });
        },
        confirmCash(code, requestId, reviewer) {
            return mutate(code, value => {
                const request = value.requests.find(entry => entry.id === requestId && entry.status === 'WAITING_CASH');
                if (!request) throw new Error('Yêu cầu không còn chờ thanh toán tiền mặt.');
                const resolved = (request.items || []).map(entry => {
                    const invoice = value.invoices.find(item => item.id === entry.invoiceId);
                    const item = invoice?.items?.find(row => row.id === entry.itemId);
                    if (!invoice || !item || item.status !== 'WAITING_CASH') throw new Error('Yêu cầu không còn chờ thanh toán tiền mặt.');
                    if (moneyAmount(item.amount) !== moneyAmount(entry.amount)) throw new Error('Số tiền hóa đơn đã thay đổi.');
                    return { invoice, item, amount: moneyAmount(item.amount) };
                });
                if (!resolved.length) throw new Error('Yêu cầu không còn chờ thanh toán tiền mặt.');
                const receipt = complete(value, resolved, 'CASH', reviewer);
                request.status = 'PAID';
                request.transactionId = receipt.id;
                return receipt;
            });
        },
        rejectCash(code, requestId) {
            return mutate(code, value => {
                const request = value.requests.find(entry => entry.id === requestId && entry.status === 'WAITING_CASH');
                if (!request) throw new Error('Yêu cầu không còn chờ thanh toán tiền mặt.');
                for (const entry of request.items || []) {
                    const invoice = value.invoices.find(item => item.id === entry.invoiceId);
                    const item = invoice?.items?.find(row => row.id === entry.itemId);
                    if (item && item.status === 'WAITING_CASH') item.status = 'UNPAID';
                    if (invoice) refreshInvoice(invoice);
                }
                request.status = 'CANCELLED';
                return request;
            });
        },
        async listCashRequests() {
            return all().flatMap(record => record.requests.filter(entry => entry.status === 'WAITING_CASH'));
        },
        async listHistory() {
            return all().flatMap(record => record.payments.filter(entry => ['SUCCESS', 'Thành công'].includes(entry.status)))
                .sort((a, b) => String(b.paymentTime || '').localeCompare(String(a.paymentTime || '')));
        }
    };
})();
