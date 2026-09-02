// html-templates.js - STEP 6: ADD GITHUB HEADER
export function generateConfigHTML(userID, hostName, proxyIPMain, proxyIPSec, subbestip, sublink) {
    return `
<html>
<head>
<style>
body { font-family: Arial; padding: 20px; }
pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
button { margin: 5px; padding: 5px 10px; }
.links { margin: 15px 0; }
.header { text-align: center; margin-bottom: 20px; }
</style>
</head>
<body>

<div class="header">
<p>Welcome! If you found this useful, please star our project:</p>
</div>

<h1>Configuration for ${userID}</h1>

<div class="links">
<a href="${subbestip}">Best IP Subscription</a> | 
</div>

<h3>Subscription:</h3>
<pre>${sublink}</pre>
<button onclick="copyToClipboard('${sublink}')">Copy Sub</button>

<h3>Main Config:</h3>
<pre>${proxyIPMain}</pre>
<button onclick="copyToClipboard('${proxyIPMain.replace(/\n/g, '\\n')}')">Copy Main</button>

<h3>Backup Config:</h3>
<pre>${proxyIPSec}</pre>
<button onclick="copyToClipboard('${proxyIPSec.replace(/\n/g, '\\n')}')">Copy Backup</button>

<script>
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => alert('Copied!'));
}
</script>
</body>
</html>`;
}