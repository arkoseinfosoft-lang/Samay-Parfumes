# Samay Parfumes Source Assets

This directory contains the unminified, commented source files for the theme assets:
- `samay.css`: Unminified luxury CSS styling
- `samay.js`: Unminified interactive cart and storefront scripts

## Build Step
To compile and minify to `assets/`:
```bash
npx clean-css-cli -o assets/samay.css src/samay.css
npx terser src/samay.js -o assets/samay.js --compress --mangle
```
