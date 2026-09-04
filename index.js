//import { connect } from "cloudflare:sockets";
//import { generateConfigHTML } from './src/html-templates.js';
import { handleIpSubscription, handleScamalyticsLookup, handleConfigPage, safeFetch, Config } from './src/VlessConfig.js'; 
import { ProtocolOverWSHandler} from './src/Core-function.js';
import { handleQrPage } from './src/qr-page.js'; // subscription to QR-Code

/**
 * LAST UPDATE
 * 
* Ssaturday 27 june 2026
*   - some optimization
*   - add xhttp protocol
*
*
*
*
*
* Friday 5 june 2026
 * - "Chunk" Type has been corected in  "ProtocolOverWSHandler"
 * - "Data" Type hass been correcte3d in "MakeReadableWebSocketStream"
 * 
 *  - Sat, 24 February 2026, 04:20 UTC.
 *    https://github.com/NiREvil/zizifn
 *
 * UUID
 *  - Generate your own uuid: https://www.uuidgenerator.net
 *  - Add multiple: comma-separated (uuid1, uuid2) - Line 30..
 *
 * PROXY IP LAND
 *  - An array of proxy addresses. You can add multiple proxies to the list.
 *    Example: ['proxy1.ir:8443', '1.1.1.1:443', 'proxy2.com:2053'], - Line 31.
 *  - Daily, tested proxy list:
 *    https://github.com/NiREvil/vless/blob/main/sub/ProxyIP.md
 *
 * SCAMALYTICS API
 *  - Default key is public, Line 33, 34, 45.
 *  - If you fork or expect heavy use, get your own free key:
 *    https://scamalytics.com/ip/api/enquiry?monthly_api_calls=5000
 *
 */
 





/** @type {ReturnType<typeof socks5AddressParser> | null} */
let parsedSocksCache = null;

/**
 * Parses SOCKS5 address string.
 * @param {string} address
 * @returns {object}
 */
function socks5AddressParser(address) {
  try {
    const [authPart, hostPart] = address.includes("@") ? address.split("@") : [null, address];
    const [hostname, portStr] = hostPart.split(":");
    const port = parseInt(portStr, 10);
    if (!hostname || isNaN(port)) throw new Error();
    let username, password;
    if (authPart) {
      [username, password] = authPart.split(":");
      if (!username) throw new Error();
    }
    return { username, password, hostname, port };
  } catch {
    throw new Error("Invalid SOCKS5 address format.");
  }
}

export default {
  /**
   * @param {Request<any, CfProperties<any>>} request
   * @param {{ PROXYIP: string; UUID: any; SCAMALYTICS_USERNAME: any; SCAMALYTICS_API_KEY: any; SCAMALYTICS_BASEURL: any; SOCKS5: any; SOCKS5_RELAY: string; }} env
   * @param {any} ctx
   */
  async fetch(request, env, ctx) {
<<<<<<< Updated upstream
    //console.log("🟢 Worker started, URL:", request.url);
    try {
      const cfg = Config.fromEnv(env);
      //console.log("🟢 Config loaded, userID:", cfg.userID);
      const url = new URL(request.url);
      //console.log(`url: ${url}`, `  cfg: ${cfg}`);
      //console.log(`[DEBUG] Request: ${request.method} ${url.pathname}`);
      //console.log(`[DEBUG] Protocol: ${url.protocol}`);
      //console.log(`[DEBUG] Headers:`, Object.fromEntries(request.headers));
=======
    console.log("🟢 Worker started, URL:", request.url);
    try {
      const cfg = Config.fromEnv(env);
      console.log("🟢 Config loaded, userID:", cfg.userID);
      const url = new URL(request.url);
      console.log(`url: ${url}`, `  cfg: ${cfg}`);
      console.log(`[DEBUG] Request: ${request.method} ${url.pathname}`);
      console.log(`[DEBUG] Protocol: ${url.protocol}`);
      //console.log(`[DEBUG] Headers:`, Object.fromEntries(request.headers));
      const ConnectionHeader = request.headers.get("connection");
      console.log(`[DEBUG] connection: `, ConnectionHeader);
>>>>>>> Stashed changes
      const upgradeHeader = request.headers.get("Upgrade");
      //console.log("upgradeHeader:",upgradeHeader);
      
      if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
              //console.log("🟢 WebSocket upgrade request detected");
              if (cfg.socks5.enabled && !parsedSocksCache) {
                parsedSocksCache = socks5AddressParser(cfg.socks5.address);
              }
      
              const requestConfig = {
                userID: cfg.userID,
                proxyIP: cfg.proxyIP,
                proxyPort: cfg.proxyPort,
                socks5Address: cfg.socks5.address,
                socks5Relay: cfg.socks5.relayMode,
                enableSocks: cfg.socks5.enabled,
                parsedSocks5Address: cfg.socks5.enabled ? parsedSocksCache : {},
              };
              //console.log("requestConfig: ",requestConfig ,"\n upgradeHeader: ",upgradeHeader);
              return ProtocolOverWSHandler(request, requestConfig);
      };
<<<<<<< Updated upstream
      //if (url.pathname.startsWith(`/xhttp/${cfg.userID}`))
=======
      if (ConnectionHeader && ConnectionHeader.toLowerCase() === "Keep-Alive" )
        console.log("protocol is : ..xhttp..");
>>>>>>> Stashed changes
        //return ProtocolOverXHTTPHandler(request, requestConfig);
      if (url.pathname === "/scamalytics-lookup") {
        console.log("..scamalytics..");
        return handleScamalyticsLookup(request, cfg);}
      if (url.pathname.startsWith(`/xray/${cfg.userID}`)) {
        console.log("..xray..");
        return handleIpSubscription(request, "xray", cfg.userID, url.hostname, ctx);}
      if (url.pathname.startsWith(`/sb/${cfg.userID}`)) {
        console.log("..sb..");
        return handleIpSubscription(request, "sb", cfg.userID, url.hostname, ctx);}
      if (url.pathname.startsWith(`/${cfg.userID}`))  {
        console.log("..url...");
        return handleConfigPage(cfg.userID, url.hostname, cfg.proxyAddress);}
      if (url.pathname.startsWith(`/sub/${cfg.userID}`))
        return handleQrPage(url.hostname, cfg.userID);
      return new Response(
        "UUID not found. Please set the UUID environment variable in the Cloudflare dashboard.",
        { status: 404 },
      );
    } catch (err) {
      return new Response(`Worker Logic Error: ${err.message}\n${err.stack}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  },
};
