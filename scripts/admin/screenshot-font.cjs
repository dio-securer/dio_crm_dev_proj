const fs = require('node:fs');
const path = require('node:path');
// Optional host-provided font for headless environments without Korean glyphs.
module.exports = async function screenshotFont(page) {
 if (!process.env.ADMIN_SCREENSHOT_FONT_DIR) return;
 const root = process.env.ADMIN_SCREENSHOT_FONT_DIR;
 const css = fs.readFileSync(path.join(root, '400.css'), 'utf8').replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (_, quote, file) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(root,file)).toString('base64')})`);
 await page.addStyleTag({content:css+'\nbody,button,input,select { font-family: "Noto Sans KR", sans-serif !important; }'});
 await page.evaluate(()=>document.fonts.ready);
};
