// Filled by the release build; generated design source remains unchanged.
export function localShellFonts(css){
 for(const [family,file,weights]of [['Manrope','manrope-variable','200 800'],['Literata','literata-variable','200 900']]){
  const external=new RegExp('@import\\s*(?:url\\(\\s*)?["\\\']https://fonts\\.googleapis\\.com/css2\\?family='+family+'[^"\\\']*["\\\']\\s*\\)?;','g');
  css=css.replace(external,`@font-face{font-family:${family};font-style:normal;font-weight:${weights};font-display:swap;src:url("/fonts/b25/${file}.woff2") format("woff2")}`);
 }
 return css;
}
