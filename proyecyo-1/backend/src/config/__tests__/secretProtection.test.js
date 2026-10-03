const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../../..");
test("Git excluye entornos y credenciales anidados conservando los ejemplos", () => {
  const paths = ["backend/.env", "backend/.env.production", "frontend/config/.env.local", "backend/certs/test.pem",
    "backend/config/credentials.json", "backend/secrets/test.json", "backend/.env.example", ".env.example"];
  const output = execFileSync("git", ["check-ignore", "--no-index", "--stdin"],
    { cwd: root, input: paths.join("\n") + "\n", encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
  expect(output).toEqual(paths.slice(0, 6));
});
test("configuracion Docker separa variables del backend del frontend y del build", () => {
  const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");
  const frontend = compose.split("\n  frontend:")[1];
  expect(frontend).not.toContain("RECURRENTE");
  for (const folder of ["backend", "frontend", "backend/sql"]) {
    const dockerfile = fs.readFileSync(path.join(root, folder, "Dockerfile"), "utf8");
    expect(dockerfile).not.toMatch(/(?:ARG|ENV).*RECURRENTE/);
    const ignore = fs.readFileSync(path.join(root, folder, ".dockerignore"), "utf8");
    expect(ignore).toContain("**/.env.*");
    expect(ignore).toContain("**/secrets");
  }
});
