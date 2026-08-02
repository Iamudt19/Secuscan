'use strict';

/**
 * SecuScan — Tier 1 Explanation Templates
 *
 * Pre-written templates with plain-English summaries, real-world impacts,
 * and copy-pasteable fixes for the ~30 most common security findings.
 */
const TEMPLATES = {
  // ─── HTTP Security Headers ──────────────────────────────────────────────────
  'headers::content-security-policy': {
    title: 'Missing Content-Security-Policy (CSP) Header',
    summary: 'Your website does not have a Content Security Policy (CSP). Without it, the browser has no instructions on which scripts, stylesheets, or connections are safe to load, allowing it to run anything.',
    impact: 'If your site ever has a Cross-Site Scripting (XSS) bug, an attacker can exploit it to inject malicious scripts. A strong CSP acts as a vital safety net, blocking unauthorized scripts from running even if an injection vulnerability exists.',
    fix: 'Add a Content-Security-Policy header to your web server response. Start with a safe default policy:\n\n# HTTP Header:\nContent-Security-Policy: default-src \'self\'; script-src \'self\'; object-src \'none\';\n\n# Nginx config:\nadd_header Content-Security-Policy "default-src \'self\';" always;\n\n# Express.js (helmet):\napp.use(helmet());'
  },
  'headers::strict-transport-security': {
    title: 'Missing HTTP Strict Transport Security (HSTS)',
    summary: 'Your site does not tell browsers that they must always connect securely using HTTPS. Without this instruction, a browser may attempt an unencrypted connection.',
    impact: 'Attackers on the same network (like a public Wi-Fi hotspot) can perform an SSL-stripping attack, silently downgrading a user\'s connection to plain HTTP to steal cookies, credentials, and session tokens.',
    fix: 'Add the Strict-Transport-Security header to all secure HTTPS responses. It should specify a long duration (at least 1 year):\n\n# HTTP Header:\nStrict-Transport-Security: max-age=31536000; includeSubDomains; preload\n\n# Nginx config:\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
  },
  'headers::x-frame-options': {
    title: 'Missing X-Frame-Options Header',
    summary: 'Your site is missing protection against Clickjacking. This means other websites can embed your pages inside an invisible iframe overlaying their own content.',
    impact: 'An attacker can trick users into clicking buttons or typing keys on your website (such as "Delete Account" or "Approve Permissions") while the user thinks they are interacting with the attacker\'s host page.',
    fix: 'Configure your server to send the X-Frame-Options header to prevent framing by unauthorized domains:\n\n# HTTP Header:\nX-Frame-Options: DENY\n\n# Nginx config:\nadd_header X-Frame-Options "DENY" always;\n\n# Alternative (modern CSP directive):\nContent-Security-Policy: frame-ancestors \'self\';'
  },
  'headers::x-content-type-options': {
    title: 'Missing X-Content-Type-Options Header',
    summary: 'Your site does not instruct browsers to strictly follow the declared Content-Type header. This allows browsers to perform MIME-type sniffing to guess the file type.',
    impact: 'If your application accepts user uploads (like images), an attacker could upload a script masquerading as an image. The browser might sniff the file, recognize it as JavaScript, and execute it, leading to XSS.',
    fix: 'Send the X-Content-Type-Options header set to "nosniff" on all responses:\n\n# HTTP Header:\nX-Content-Type-Options: nosniff\n\n# Nginx config:\nadd_header X-Content-Type-Options "nosniff" always;'
  },
  'headers::referrer-policy': {
    title: 'Missing Referrer-Policy Header',
    summary: 'Your site does not restrict how much URL information is shared with other sites when users click outbound links.',
    impact: 'If your site includes sensitive parameters in URLs (e.g. single-use password reset tokens, private user IDs), they will leak to third-party sites in the "Referer" header.',
    fix: 'Add a Referrer-Policy header to restrict referrer leaks to other origins:\n\n# HTTP Header:\nReferrer-Policy: strict-origin-when-cross-origin\n\n# Nginx config:\nadd_header Referrer-Policy "strict-origin-when-cross-origin" always;'
  },
  'headers::permissions-policy': {
    title: 'Missing Permissions-Policy Header',
    summary: 'Your website does not restrict which browser hardware features (camera, microphone, geolocation) can be accessed by the page or embedded iframes.',
    impact: 'If a third-party script on your site (like an ad network or analytics script) gets compromised, it can attempt to request access to the user\'s camera or location, leveraging your site\'s domain trust.',
    fix: 'Specify a strict Permissions-Policy header to disable unused features by default:\n\n# HTTP Header:\nPermissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n\n# Nginx config:\nadd_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;'
  },

  // ─── SSL/TLS & Encryption ──────────────────────────────────────────────────
  'ssl::https_unavailable': {
    title: 'HTTPS is Not Available',
    summary: 'The site does not support secure HTTPS connections. All communication happens in plain text over HTTP.',
    impact: 'Every password, cookie, and form submission can be read or modified by anyone on the transit path, including Wi-Fi routers, ISPs, and network eavesdroppers.',
    fix: 'Install a TLS certificate. You can obtain one for free from Let\'s Encrypt:\n\n# Using Certbot for Nginx:\ncertbot --nginx -d yourdomain.com\n\n# Or run Caddy web server, which handles certificates automatically.'
  },
  'ssl::expired_cert': {
    title: 'Expired TLS Certificate',
    summary: 'The site\'s TLS certificate has expired, meaning it is no longer recognized as valid by web browsers.',
    impact: 'Browsers will show a hard warning blocking users from entering your site. Bypassing the warning is dangerous because traffic could be intercepted.',
    fix: 'Renew the TLS certificate immediately:\n\n# Force manual renewal:\ncertbot renew --force-renewal\n\n# Verify automatic cron renewal timer is enabled:\nsystemctl status certbot.timer'
  },
  'ssl::self_signed': {
    title: 'Self-Signed or Untrusted TLS Certificate',
    summary: 'The TLS certificate was generated locally instead of being issued by a trusted Certificate Authority (CA).',
    impact: 'Browsers will block visitors with security warnings because they cannot verify the identity of the server. This makes the site highly vulnerable to impersonation.',
    fix: 'Obtain a valid certificate from a trusted authority:\n\n# Get a free Let\'s Encrypt certificate:\ncertbot --nginx -d yourdomain.com'
  },
  'ssl::deprecated_tls': {
    title: 'Deprecated TLS Version Negotiated',
    summary: 'The server accepts obsolete encryption protocols (TLS 1.0 or TLS 1.1) that have been formally deprecated due to known cryptographic weaknesses.',
    impact: 'Attackers can exploit weaknesses in older protocols to perform connection downgrade attacks and potentially decrypt secure user traffic.',
    fix: 'Configure your web server to only support TLS 1.2 and TLS 1.3:\n\n# Nginx config:\nssl_protocols TLSv1.2 TLSv1.3;\n\n# Apache config:\nSSLProtocol all -SSLv3 -TLSv1 -TLSv1.1'
  },
  'ssl::no_http_redirect': {
    title: 'HTTP Traffic Does Not Redirect to HTTPS',
    summary: 'The server accepts plain HTTP requests on port 80 but does not redirect them to the secure HTTPS version.',
    impact: 'Visitors who type your domain directly without prefixing "https://" will browse the site unencrypted, making their session tokens vulnerable to interception.',
    fix: 'Add a global redirect rule from port 80 to port 443:\n\n# Nginx config:\nserver {\n  listen 80;\n  server_name yourdomain.com;\n  return 301 https://$host$request_uri;\n}'
  },
  'ssl::missing_hsts_redirect': {
    title: 'HTTP Redirect Present, but HSTS is Missing',
    summary: 'The site redirects HTTP requests to HTTPS, but does not use HSTS headers to ensure browsers remember to do this automatically in the future.',
    impact: 'The very first request a user makes is still sent over plain HTTP before the redirect occurs. An attacker can intercept this initial request to perform SSL-stripping.',
    fix: 'Add the Strict-Transport-Security header to HTTPS responses:\n\n# Nginx config:\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
  },

  // ─── Exposed Files & Paths ─────────────────────────────────────────────────
  'exposed_files::exposed_env': {
    title: 'Exposed Environment Variable File (.env)',
    summary: 'A configuration file containing environment variables is publicly reachable in your web directory.',
    impact: 'Anyone can read the file to steal database passwords, third-party API keys, and internal app secrets, leading to a complete compromise of your services.',
    fix: 'Move the `.env` file outside your public web directory, or block access to dotfiles in your server configuration:\n\n# Nginx config:\nlocation ~ /\\.env {\n  deny all;\n  return 404;\n}'
  },
  'exposed_files::exposed_pem': {
    title: 'Exposed Private Key File (.pem/.key)',
    summary: 'A private cryptographic key or SSL certificate file is publicly accessible.',
    impact: 'Attackers can use your private key to decrypt traffic, sign code under your identity, or impersonate your server.',
    fix: 'Delete the key from the web directory immediately and revoke any associated certificates. Keys must never be accessible via HTTP.'
  },
  'exposed_files::exposed_ssh': {
    title: 'Exposed SSH Private Key',
    summary: 'An SSH private key used for server access is publicly reachable.',
    impact: 'An attacker can download the key and use it to log into your servers or developer accounts, gaining full administrator access.',
    fix: 'Remove the key immediately, rotate it by generating a new key pair, and remove the compromised key from all server `authorized_keys` lists.'
  },
  'exposed_files::exposed_cloud': {
    title: 'Exposed Cloud Provider Credentials',
    summary: 'An AWS, GCP, or Azure credential file is publicly exposed.',
    impact: 'Attackers can seize full control of your cloud account, spawn massive crypto-mining instances, or access your hosted databases, causing large bills.',
    fix: 'Revoke the exposed access keys immediately in your cloud provider\'s console, then delete the file.'
  },
  'exposed_files::exposed_git': {
    title: 'Exposed .git Directory',
    summary: 'The internal `.git` metadata folder is publicly accessible in your web root.',
    impact: 'Attackers can download the entire folder and reconstruct your application\'s full source code, including commit history and past secrets.',
    fix: 'Configure Nginx or Apache to deny access to the `.git` folder:\n\n# Nginx config:\nlocation ~ /\\.git {\n  deny all;\n  return 404;\n}'
  },
  'exposed_files::exposed_ds_store': {
    title: 'Exposed .DS_Store File',
    summary: 'A macOS folder metadata file (.DS_Store) is publicly accessible.',
    impact: 'Leaks a listing of all files and folders in that directory, exposing hidden paths and giving attackers a directory map.',
    fix: 'Delete the file and block access in Nginx:\n\n# Nginx:\nlocation ~ /\\.DS_Store {\n  deny all;\n}'
  },

  // ─── Exposed Configs (Repository) ──────────────────────────────────────────
  'config::dockerfile_root': {
    title: 'Dockerfile Configured to Run as Root',
    summary: 'The application container is built to run all processes as the default root user.',
    impact: 'If an attacker finds a remote code execution bug in the app, they immediately inherit root privileges inside the container, facilitating container escapes.',
    fix: 'Create a dedicated non-root user and switch to it at the end of your Dockerfile:\n\n# Dockerfile:\nRUN groupadd -r appuser && useradd -r -g appuser appuser\nUSER appuser'
  },
  'config::dockerfile_debug_port': {
    title: 'Dockerfile Exposes Debug Ports',
    summary: 'The Dockerfile exposes debugging ports (such as Node inspector port 9229) to the network.',
    impact: 'Attackers can connect remote debugging utilities to your live application processes to read heap memory or run arbitrary code.',
    fix: 'Remove the debug ports (9229, 9230) from the EXPOSE directive in the production Dockerfile.'
  },
  'config::compose_password': {
    title: 'Hardcoded Password in Docker Compose',
    summary: 'A plain-text database or API password is written directly in the docker-compose.yml file.',
    impact: 'Anyone with repository access can view the credentials and gain access to the database or associated services.',
    fix: 'Use environment variables instead of hardcoding:\n\n# docker-compose.yml:\nenvironment:\n  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}\n\n# Store the actual value in a local `.env` (which is gitignored).'
  },

  // ─── Hardcoded Secrets ──────────────────────────────────────────────────────
  'secrets::aws-access-key': {
    title: 'Committed AWS Access Key',
    summary: 'An active Amazon Web Services (AWS) Access Key ID was found committed in the repository files.',
    impact: 'Anyone who reads this key can make API requests to your AWS account, potentially reading data, deleting databases, or starting expensive servers.',
    fix: '1. Revoke the key immediately in the AWS IAM Console.\n2. Clean the git history using git-filter-repo.\n3. Put the credentials into environment variables.'
  },
  'secrets::aws-secret-key': {
    title: 'Committed AWS Secret Key',
    summary: 'An active Amazon Web Services (AWS) Secret Key was found in the repository.',
    impact: 'Allows full API authentication when paired with an Access Key ID, giving an attacker administrative access to your cloud assets.',
    fix: 'Revoke the key immediately in the AWS IAM Console. Rotate all compromised credentials.'
  },
  'secrets::stripe-key': {
    title: 'Committed Stripe API Secret Key',
    summary: 'A live Stripe merchant secret API key was found committed in your source code.',
    impact: 'An attacker can authenticate to your Stripe account, access customer lists, process refunds, or attempt to exfiltrate payment funds.',
    fix: '1. Revoke and roll the key immediately in the Stripe Dashboard under Developers > API Keys.\n2. Remove the key from your repository history.'
  },
  'secrets::github-pat': {
    title: 'Committed GitHub Personal Access Token (PAT)',
    summary: 'A GitHub personal access token was found committed in the repository.',
    impact: 'Attackers can use this token to access your private repositories, modify code, or push malicious commits to your projects.',
    fix: 'Revoke the token immediately in your GitHub settings under Developer Settings > Personal Access Tokens.'
  },
  'secrets::generic-api-key': {
    title: 'Committed Generic API Key or Token',
    summary: 'A secret key or token was found hardcoded in the codebase.',
    impact: 'Exposes the corresponding third-party account to unauthorized operations, which could lead to API rate limit issues or data exposure.',
    fix: 'Revoke the key on the provider\'s portal, then move it to an environment variable.'
  },
  'secrets::generic-password': {
    title: 'Hardcoded Plaintext Password',
    summary: 'A plaintext password was found written directly inside your codebase.',
    impact: 'Exposes database, admin, or SMTP credentials to anyone with access to the source code.',
    fix: 'Move the password to a safe environment variable and use config loaders (like `dotenv`) to read it.'
  },
  'secrets::private-key-header': {
    title: 'Committed Private Key Material',
    summary: 'A PEM private key block (RSA, OpenSSH, or EC) was found committed inside a code file.',
    impact: 'Gives anyone who views the key the power to decrypt files, sign data, or log into servers trusting the corresponding public key.',
    fix: 'Revoke the key immediately and replace it with a new one. Do not commit key files.'
  },

  // ─── Security Checklist Web Probes ─────────────────────────────────────────
  'checklist::verbose_server': {
    title: 'Verbose Server Specification Leaked',
    summary: 'The HTTP response exposes specific web server software version numbers (e.g. nginx/1.18.0).',
    impact: 'Knowing the exact software version lets attackers lookup matching public CVE exploits immediately.',
    fix: 'Configure your web server to suppress version numbers. For nginx: add "server_tokens off;" inside nginx.conf. For Apache: set "ServerTokens Prod".'
  },
  'checklist::powered_by': {
    title: 'X-Powered-By Header Present',
    summary: 'The server exposes the "X-Powered-By" header, revealing underlying web framework runtimes.',
    impact: 'Knowing the framework details (e.g. Express, PHP, ASP.NET) helps attackers narrow down exploit campaigns.',
    fix: 'Configure your application to hide this header. In Express: app.disable("x-powered-by"). In PHP: set "expose_php = Off" in php.ini.'
  },
  'checklist::stack_trace': {
    title: 'Stack Trace Leaked on Error Page',
    summary: 'The server error or 404 page leaked runtime software stack traces or raw database exception statements.',
    impact: 'Stack traces expose internal file paths, codebase variables, and library versions, making exploit crafting significantly easier.',
    fix: 'Implement a global error handler that catches exceptions and returns a generic user-friendly page without detailed logs.'
  },
  'checklist::xss_reflected': {
    title: 'Input Validation Weakness (XSS Reflected)',
    summary: 'The web application reflects unescaped query parameter tags back into the page response body.',
    impact: 'Reflecting raw tags enables Cross-Site Scripting (XSS), letting malicious links execute scripts in a user\'s browser session.',
    fix: 'Never render user input directly. Always HTML-encode values before rendering, or rely on framework routing templating (like React/Vue) which auto-escapes output.'
  },
  'checklist::directory_listing_uploads': {
    title: 'Directory Listing Enabled on Uploads Folder',
    summary: 'The server lets visitors view the full contents list of your uploads directory.',
    impact: 'Exposed directory lists help attackers inspect user-uploaded files, locate private keys, or find staging backups.',
    fix: 'Configure your web server to disable directory indexing. For nginx: set "autoindex off;". For Apache: add "Options -Indexes" in .htaccess.'
  },
  'checklist::missing_rate_limiting': {
    title: 'Missing Public Endpoint Rate Limiting',
    summary: 'We executed rapid consecutive public requests without triggering a "429 Too Many Requests" response code.',
    impact: 'Rogue bots can spam public search endpoints or submit scanners indefinitely, consuming system memory and server capacity.',
    fix: 'Configure rate limiting middleware (like express-rate-limit in Node.js, rack-attack in Rails) or use cloud firewalls (like Cloudflare) to throttle IPs.'
  },
  'checklist::auth_cookie_insecure': {
    title: 'Insecure Session Cookie Configuration',
    summary: 'The session cookie is missing the HttpOnly or Secure attribute flag.',
    impact: 'If a session cookie lacks HttpOnly, malicious scripts can read it to hijack user accounts. Lacking Secure means it is transmitted in plain-text over unencrypted HTTP.',
    fix: 'Set both HttpOnly and Secure flags when initiating session cookies: "Set-Cookie: session_id=xyz; Secure; HttpOnly; SameSite=Lax".'
  },
  'checklist::idor_exposure': {
    title: 'Unauthenticated Access Control Exposure (Potential IDOR)',
    summary: 'The server returned sensitive user record profiles to an unauthenticated request.',
    impact: 'Without resource ownership checks, any guest or user can access, modify, or delete other users\' private profiles by guessing numeric IDs.',
    fix: 'Verify the user authentication session and enforce resource ownership checks on the server before database queries: "if (resource.owner_id !== loggedInUser.id) throw ForbiddenError()".'
  },
  'checklist::secrets_leak': {
    title: 'Hardcoded API Credentials in Frontend Assets',
    summary: 'A hardcoded credential or secret API key was found exposed in the client-side asset files.',
    impact: 'Attackers scan public web assets to steal Stripe or cloud credentials, using them to execute charges or access secure databases.',
    fix: 'Move all API credentials, private tokens, and keys to server-side environment variables and access them only through a backend layer.'
  },
  'checklist::sqli_leak': {
    title: 'Missing Database Parameter Sanitization (Potential SQLi)',
    summary: 'Submitting database control quotes in query parameter "id" leaked raw database syntax error messages.',
    impact: 'Database syntax leaks suggest the application concatenates raw query parameters, exposing the DB to schema extraction or authentication bypasses.',
    fix: 'Never concatenate SQL queries. Always use parameterized queries (prepared statements) or secure ORMs to query databases.'
  },
  'checklist::secure_deployment_missing': {
    title: 'Missing Secure Deployment Headers',
    summary: 'The server is missing HSTS or Content Security Policy (CSP) headers in its responses.',
    impact: 'Without these headers, connections can be downgraded to plain HTTP, and browsers are vulnerable to script-injection (XSS) framing attacks.',
    fix: 'Add security headers to all production HTTP server configurations. For nginx: "add_header Content-Security-Policy ...;".'
  }
};

module.exports = { TEMPLATES };
