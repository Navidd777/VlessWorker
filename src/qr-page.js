/**
 * Generates a QR code page for the subscription URL.
 * @param {string} hostName
 * @param {string} userID
 * @returns {Response}
 */
export function handleQrPage(hostName, userID) {
  const subUrl = `https://${hostName}/xray/${userID}`;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harmony</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0f;color:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#13131f;border:1px solid #2d2b55;border-radius:16px;padding:32px 28px;width:360px;text-align:center;box-shadow:0 0 40px #7c3aed22}
  .title{font-size:22px;font-weight:700;letter-spacing:2px;color:#a78bfa;margin-bottom:4px}
  .sub{font-size:12px;color:#6b7280;margin-bottom:24px}
  #qr{display:flex;justify-content:center;margin-bottom:20px}
  #qr canvas,#qr img{border-radius:10px;border:2px solid #4c1d95}
  .url-box{background:#0f0f1a;border:1px solid #2d2b55;border-radius:8px;padding:10px 14px;font-size:11px;color:#94a3b8;word-break:break-all;margin-bottom:14px;text-align:left}
  .btn{width:100%;padding:10px;background:#7c3aed;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s}
  .btn:hover{background:#6d28d9}
  .btn.copied{background:#059669}
</style>
</head>
<body>
<div class="card">
  <div class="title">| HAЯMOИY |</div>
  <div class="sub">Scan to import subscription</div>
  <div id="qr"></div>
  <div class="url-box">${subUrl}</div>
  <button class="btn" onclick="navigator.clipboard.writeText('${subUrl}').then(()=>{this.textContent='✓ Copied!';this.classList.add('copied');setTimeout(()=>{this.textContent='Copy URL';this.classList.remove('copied')},2000)})">Copy URL</button>
</div>
<script>
  new QRCode(document.getElementById('qr'),{text:'${subUrl}',width:220,height:220,colorDark:'#7c3aed',colorLight:'#0f0f1a',correctLevel:QRCode.CorrectLevel.M});
<\/script>
</body>
</html>`;

  return new Response(html, { 
    headers: { "Content-Type": "text/html;charset=utf-8" } 
  });
}