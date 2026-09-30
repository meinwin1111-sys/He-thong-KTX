// Shared browser-only ledger. Never calls the Admin API or stores authentication data.
(() => {
    const prefix = 'ktx.billing.demo.v1.';
    const key = code => prefix + encodeURIComponent(code);
    const amount = invoice => {
        const value = Number(invoice.remainingAmount ?? invoice.totalAmount ??
            (Number(invoice.room) + Number(invoice.electricity) + Number(invoice.water)));
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Số tiền hóa đơn không hợp lệ.');
        return value;
    };
    const status = invoice => invoice.paid || invoice.status === 'PAID' ? 'PAID' :
        invoice.status === 'WAITING_CASH' ? 'WAITING_CASH' :
        new Date(`${invoice.due}T23:59:59.999`) < new Date() ? 'OVERDUE' : 'UNPAID';
    function read(code) {
        const raw = localStorage.getItem(key(code));
        if (!raw) return null;
        const value = JSON.parse(raw);
        if (value.studentId !== code || !Array.isArray(value.invoices) || !Array.isArray(value.payments) || !Array.isArray(value.requests)) {
            throw new Error('Dữ liệu thanh toán demo không hợp lệ. Không ghi đè dữ liệu đã lưu.');
        }
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
                invoices: data.invoices.map(i => ({ ...i, status: status(i) })),
                payments: data.payments.map(p => ({ ...p, studentId: code, studentName: data.profile.name,
                    room: data.room.number, paymentMethod: p.method === 'Tiền mặt' ? 'CASH' : 'ONLINE',
                    paymentTime: p.paymentTime || p.date, transactionId: p.transactionId || p.id })), requests: [] };
            save(value);
        }
        return value;
    }
    function payable(value, id) {
        const invoice = value?.invoices.find(i => i.id === id);
        if (!invoice) throw new Error('Hóa đơn không tồn tại.');
        if (status(invoice) === 'PAID') throw new Error('Hóa đơn đã thanh toán.');
        if (status(invoice) === 'WAITING_CASH') throw new Error('Hóa đơn đang chờ thanh toán tiền mặt.');
        if (amount(invoice) <= 0) throw new Error('Hóa đơn không còn số tiền phải thanh toán.');
        return invoice;
    }
    function details(value, invoice) {
        return { invoiceId: invoice.id, studentId: value.studentId, studentName: value.studentName,
            room: value.room, amount: amount(invoice), paymentContent: `KTX ${invoice.id} ${value.studentId}` };
    }
    function complete(value, invoice, method, reviewer) {
        if (value.payments.some(p => p.invoiceId === invoice.id && ['SUCCESS', 'Thành công'].includes(p.status))) {
            throw new Error('Hóa đơn đã có giao dịch thành công.');
        }
        const now = new Date();
        const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const id = `${method === 'ONLINE' ? 'DEMO' : 'CASH'}-${day}-${crypto.randomUUID()}`;
        const receipt = { ...details(value, invoice), id, transactionId: id, paymentStatus: 'SUCCESS',
            status: 'SUCCESS', paymentMethod: method, paymentTime: now.toISOString(),
            date: now.toISOString(), method: method === 'ONLINE' ? 'Online' : 'Tiền mặt', confirmedBy: reviewer || null };
        Object.assign(invoice, { paid: true, status: 'PAID', paidAmount: receipt.amount,
            paymentMethod: method, paymentTime: receipt.paymentTime, transactionId: id });
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
    window.KTXPaymentDemo = {
        prefix, amount, status, read, initialize,
        qrDetails(code, id) {
            const value = read(code);
            const invoice = payable(value, id);
            const { invoiceId, studentId, amount: sum, paymentContent } = details(value, invoice);
            return { invoiceId, studentId, amount: sum, paymentContent };
        },
        online(code, id) { return mutate(code, value => complete(value, payable(value, id), 'ONLINE')); },
        requestCash(code, id) { return mutate(code, value => {
            const invoice = payable(value, id);
            const request = { ...details(value, invoice), paymentMethod: 'CASH', requestedAt: new Date().toISOString(), status: 'WAITING_CASH' };
            invoice.status = 'WAITING_CASH';
            value.requests.push(request);
            return request;
        }); },
        confirmCash(code, id, reviewer) { return mutate(code, value => {
            const invoice = value.invoices.find(i => i.id === id);
            const request = value.requests.find(r => r.invoiceId === id && r.status === 'WAITING_CASH');
            if (!invoice || status(invoice) !== 'WAITING_CASH' || !request) throw new Error('Yêu cầu không còn chờ thanh toán tiền mặt.');
            if (request.amount !== amount(invoice)) throw new Error('Số tiền hóa đơn đã thay đổi.');
            const receipt = complete(value, invoice, 'CASH', reviewer);
            request.status = 'PAID';
            request.transactionId = receipt.id;
            return receipt;
        }); },
        all() {
            const values = [];
            for (let i = 0; i < localStorage.length; i++) {
                const name = localStorage.key(i);
                if (name?.startsWith(prefix)) values.push(read(decodeURIComponent(name.slice(prefix.length))));
            }
            return values.filter(Boolean);
        }
    };
})();
