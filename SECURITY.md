# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.x.x   | ✅ Active support   |
| 1.x.x   | ❌ End of life      |

## Reporting a Vulnerability

If you discover a security vulnerability in `@tiktool/live`, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email us at: **security@tik.tools**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 5 business days
- **Fix**: Critical issues patched within 7 days

### Scope

This policy covers:
- The `@tiktool/live` npm package
- The SDK source code in this repository
- The `api.tik.tools` API server

Out of scope:
- TikTok's own infrastructure
- Third-party services used alongside our SDK

## Security Best Practices

When using `@tiktool/live`:

1. **Never commit API keys** — use environment variables or secret managers
2. **Keep dependencies updated** — run `npm audit` regularly
3. **Use HTTPS** — the default `signServerUrl` uses HTTPS; never change to HTTP in production
4. **Rotate keys** — if you suspect a key is compromised, regenerate it from your [dashboard](https://tik.tools/dashboard)
