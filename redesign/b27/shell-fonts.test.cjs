const test=require('node:test'),a=require('node:assert/strict');
test('approved font imports, including semicolon weight lists, become same-origin variable fonts',async()=>{
 const{localShellFonts}=await import('./shell-fonts.mjs');
 const css='@import"https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;650;800&display=swap";@import url("https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500;7..72,700&display=swap");.content{display:grid}';
 const out=localShellFonts(css);a.doesNotMatch(out,/fonts\.googleapis/);a.match(out,/\/fonts\/b25\/manrope-variable\.woff2/);a.match(out,/\/fonts\/b25\/literata-variable\.woff2/);a.ok(out.endsWith('.content{display:grid}'));a.equal(localShellFonts(out),out);
});
