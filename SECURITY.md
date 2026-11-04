# Security

Suite Budget is a local desktop app. It makes no network calls, holds no account, and sends no
telemetry. The threat model is therefore mostly about the file and the machine:

- A `.budget` file is JSON containing a base64 Loro snapshot. It is not encrypted. Anyone with the file
  can read the budget; use OS disk encryption and protect the file like a bank statement.
- The renderer is sandboxed (`contextIsolation`, `sandbox`, no `nodeIntegration`, no remote content).
  Machine access goes through the validated `BudgetBridge` IPC surface.
- The app never overwrites a damaged budget. It tries backups, then keeps a copy under `recovered/` and
  refuses to replace the live file.

## Reporting a vulnerability

Use GitHub's private security advisory for
[mr-rogers-neighborhood/suite-budget](https://github.com/mr-rogers-neighborhood/suite-budget/security/advisories/new).
Do not open a public issue for a vulnerability. Include the version, the platform, and the smallest
reproduction you can.
