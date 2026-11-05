const { spawnSync } = require("node:child_process");

const result = spawnSync(
    process.execPath,
    ["--test", "db-test-only.test.cjs"],
    {
        stdio: "inherit",
        env: { ...process.env, DB_NAME: "KTX_Group3_test" }
    }
);

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
