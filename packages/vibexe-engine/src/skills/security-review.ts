import type { SkillDefinition } from "../types";

export const securityReview: SkillDefinition = {
	id: "security-review",
	name: "Security Review",
	category: "specialized",
	description: "OWASP Top 10, input validation, and secrets management",
	activationTriggers: ["security", "auth", "validation", "sanitize", "xss", "injection"],
	content: `## OWASP Top 10 Checklist
1. **Injection**: Use parameterized queries; never concatenate user input into SQL
2. **Broken Auth**: Enforce strong passwords, implement account lockout, use MFA
3. **Sensitive Data**: Encrypt at rest and in transit; never log PII
4. **XXE**: Disable external entity processing in XML parsers
5. **Broken Access Control**: Verify permissions on every request; default deny
6. **Misconfiguration**: Remove default credentials, disable directory listing
7. **XSS**: Escape all output; use Content-Security-Policy headers
8. **Insecure Deserialization**: Validate and sanitize all deserialized data
9. **Known Vulnerabilities**: Keep dependencies updated; audit regularly
10. **Logging**: Log security events; monitor for anomalies

## Input Validation
- Validate type, length, range, and format of all inputs
- Whitelist allowed values over blacklisting dangerous ones
- Sanitize HTML input with a library (DOMPurify) if rendering user content

## Secrets Management
- All secrets in environment variables, never in source code
- No credentials in commit history — use .env files in .gitignore
- Rotate secrets regularly; use short-lived tokens where possible`,
	enabled: true,
};
