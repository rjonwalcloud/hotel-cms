# Security Policy

## Supported Versions

Please note that this project is currently in active development. Security updates will only be provided for the latest version.

| Component      | Version Requirement  | Supported          |
| -------------- | -------------------- | ------------------ |
| **Hotel CMS**  | 1.0.x                | :white_check_mark: |
| **Node.js**    | >= 18.0.0            | :white_check_mark: |
| **NPM**        | >= 9.0.0             | :white_check_mark: |
| **Docker**     | Required for Compose | :white_check_mark: |
| **PostgreSQL** | 13+                  | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Hotel CMS seriously. If you discover a security vulnerability within this project, please report it by opening a new issue in this repository.

To report the vulnerability, please go to the [Issues](https://github.com/rjonwalcloud/hotel-cms/issues) tab and create a new issue.

### What to include in your report:

*   **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
*   **Full paths of source file(s)** related to the manifestation of the issue
*   **The location of the affected source code** (tag/branch/commit or direct URL)
*   **Any special configuration** required to reproduce the issue
*   **Step-by-step instructions** to reproduce the issue
*   **Proof-of-concept or exploit code** (if possible)
*   **Impact of the issue**, including how an attacker might exploit the issue

### Our Response

We will acknowledge receipt of your vulnerability report and strive to send you regular updates about our progress.

If your report is accepted, we will:
1.  Work with you to validate and reproduce the issue.
2.  Develop a fix and patch the vulnerability.
3.  Publicly acknowledge your responsible disclosure (if you desire).

## Scope

This security policy covers the core `hotel-cms` repository, including the frontend, backend, and all associated microservices within this repository. 

*Third-party dependencies are monitored via Dependabot and updated as necessary, but vulnerabilities in upstream packages should ideally be reported directly to those maintainers as well.*
