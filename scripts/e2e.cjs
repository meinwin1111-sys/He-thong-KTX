const { spawnSync } = require("node:child_process");

if (process.env.DB_NAME && process.env.DB_NAME !== "KTX_Group3_test") {
    console.error("E2E chỉ được phép chạy với DB_NAME=KTX_Group3_test.");
    process.exit(2);
}

console.log("Running HTTP/database E2E and focused tests against KTX_Group3_test.");
const result = spawnSync(process.execPath, [
    "--test",
    "payment-qr.test.cjs",
    "payment-webhook.test.cjs",
    "js/student/billing.test.cjs",
    "student-auth.test.cjs",
    "student-backend.test.cjs",
    "api-contracts.test.cjs",
    "js/module/admin-workflows.test.cjs"
], {
    stdio: "inherit",
    env: { ...process.env, DB_NAME: "KTX_Group3_test" }
});

if (result.error) {
    console.error("Unable to start the E2E test runner:", result.error.message);
    process.exit(1);
}
process.exit(result.status ?? 1);
