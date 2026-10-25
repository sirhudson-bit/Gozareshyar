# Deploy — rep.academyr.ir

| What | Where |
| --- | --- |
| Host | `194.56.148.100` (same VPS as namirahamrah.ir / academyr.ir) |
| Source checkout | `/var/www/gozaresh-yar-src` |
| Web root | `/var/www/rep.academyr.ir` |
| Runtime | none — plain static files, no Node/pm2 |
| nginx | `/etc/nginx/sites-enabled/rep.academyr.ir` |

## First time

```bash
git clone https://github.com/sirhudson-bit/Gozareshyar.git /var/www/gozaresh-yar-src
bash /var/www/gozaresh-yar-src/deploy/redeploy.sh
```

## Every later deploy

```bash
cd /var/www/gozaresh-yar-src && bash deploy/redeploy.sh
```

Or without a checkout — `index.html` is the whole app, so a single copy is enough:

```bash
curl -fsSL https://raw.githubusercontent.com/sirhudson-bit/Gozareshyar/main/index.html \
  -o /var/www/rep.academyr.ir/index.html
```

## Notes

- The site is **one self-contained file**: fonts are inlined as data URLs, no
  external CSS/JS and no local `fetch()`. That is why it works offline and why
  the deploy is a copy, not a build.
- Only `index.html` (plus the two starter files) is published. The repo keeps
  `src/`, `build.mjs` and `.git/` out of the web root on purpose.
- TLS: `certbot --nginx -d rep.academyr.ir`.
- Source lives at `C:\Users\Pc\gozaresh-yar`; build with `node build.mjs` after
  editing `src/`.
