const { getWebhookConfig } = require("../recurrenteWebhook");
const { TEST_SECRET, TEST_SANDBOX } = require("../../../test/integration/support/recurrenteWebhookFixtures");
const config = { RECURRENTE_WEBHOOK_SECRET: TEST_SECRET, RECURRENTE_SANDBOX_ID: TEST_SANDBOX };
test("webhook usa signing secret independiente sin necesitar Secret Key", () => {
  const result = getWebhookConfig(config);
  expect(result.secret).toBe(TEST_SECRET);
  expect(JSON.stringify(result)).not.toContain(TEST_SECRET);
  expect(result.environment).toBe("sandbox");
  expect(result).not.toHaveProperty("RECURRENTE_SECRET_KEY");
});
test.each([{}, { ...config, RECURRENTE_WEBHOOK_SECRET: "" }, { ...config, RECURRENTE_WEBHOOK_SECRET: "sk_test_not_a_signing_secret" },
  { ...config, RECURRENTE_SANDBOX_ID: "" }, { ...config, RECURRENTE_SANDBOX_ID: "production" }])("config incompleta/invalida falla cerrado", (source) => {
  expect(() => getWebhookConfig(source)).toThrow("Webhook no configurado.");
});
