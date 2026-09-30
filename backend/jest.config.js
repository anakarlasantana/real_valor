const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
  // O CRM (`../admin`, pacote irmão desde a R7) tem tsconfig e bundle próprios,
  // mas ainda não tem runner: o único teste dele — o do formulário, que decide o
  // que fica "pendente" na tela — roda aqui, como rodava antes de mudar de casa.
  // Fora do `roots`, o jest não o acharia e `make test` perderia uma suíte sem
  // dizer nada.
  roots: ["<rootDir>", "<rootDir>/../admin/src"],
};

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
