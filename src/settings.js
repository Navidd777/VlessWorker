export const pt = 'dmxlc3M=';
export const at = 'QA==';
export const ed = 'RUR0dW5uZWw=';

export const maxDomains = 5; // ← max number IP from mainDomains list
export const maxFromJson = 20;  // ← max number IP from fetch "https://cf-ip-cache.local"
export const maxFromStatic = 45; // ← max number IP from staticIPs list


export const byteToHex = (() => {
    const array = [];
    for (let i = 0; i < 256; i++) {
        array[i] = (i + 0x100).toString(16).substr(1);
    }
    return array;
})();

export const HTML_URL = "https://nirevil.github.io/zizifn/";

export const CONST = {
  ED_PARAMS: { ed: 2560, eh: "Sec-WebSocket-Protocol" },
  AT_SYMBOL: "@",
  VLESS_PROTOCOL: atob("dmxlc3M="), // "vless"
  WS_READY_STATE_OPEN: 1,
  WS_READY_STATE_CLOSING: 2,
};

const hostAddress = "harmony.wknavid.workers.dev";

// ——— USER CONFIGURATION SECTION ———
export const USER_SETTINGS = {
  // Your UUID - Replace with your own UUID
  uuid: "8c97b4e6-9a9a-52cb-8bed-52452d293107",

  // Number of configs (IPs) per group
  ipCount: 20,

  // Early Data settings (optional) - Advanced feature for performance optimization
  ed: "2560",
  eh: "Sec-WebSocket-Protocol",

  /** 
   * ——— Configuration Groups ———
   * - You can add, remove, or modify groups as needed
   * - Each group can have different settings for hosts, ports, TLS, etc.
   * 
   * Available Clean IP Source options:
   *   - "static": Uses manually defined IPs from the staticIPs array
   *   - "dynamic1": Fetches IPs from NiREvil's GitHub repository
   *   - "dynamic2": Fetches IPs from strawberry API
   */
  groups: [
    {
      // ——— Group 1: TLS Configuration ———
      name: "| HAЯMOИY ᵀᴸˢ |",
      host: hostAddress,
      sni: hostAddress,
      path: "/random:16", // Path with 16 random characters
      tls: true,
      allowInsecure: true,
      ports: ["443", "8443", "2053", "2083", "2087", "2096"], // Standard cloudflare TLS ports
      alpn: "http/1.1", // Application-layer protocol negotiation (websocket only support http/1.1)
      fp: ["chrome"], // Client fingerprint (currently only chrome works reliably)
      dataSource: "dynamic1", // Use the first IP source
      randomizeSni: true, // Set to true to randomize SNI character casing
    },
    /**{
      // ——— Group 2: Non-TLS Configuration (TCP), ONLY Workers, No pages.dev ———
      name: "| HAЯMOИY ᵀᶜᴾ |",
      host: hostAddress,
      sni: "", // Must be empty for non-TLS
      path: "/random:16",
      tls: false,
      allowInsecure: false,
      ports: ["80", "8080", "8880", "2052", "2082", "2086", "2095"], // Standard cloudflare HTTP ports
      alpn: "", // Must be empty for non-TLS
      fp: ["chrome"],
      dataSource: "dynamic2", // Use the second IP source
      randomizeSni: false,
    },
    */
    {
      // ——— Group 3: Alternative TLS Configuration ———
      name: "| HAЯMOИY ᴱᴹˢ |",
      host: hostAddress,
      sni: hostAddress,
      path: "/random:16?ed=2048", // Fixed path value optimized for xray core
      tls: true,
      allowInsecure: true,
      ports: ["443", "8443", "2053"],
      alpn: "http/1.1",
      fp: ["chrome"],
      dataSource: "static", // Use static IPs
      randomizeSni: true,
    },
  ],
};

