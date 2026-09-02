import { staticIPs, mainDomains } from './proxyIPs.js'; // Import staticIPs
import { maxDomains, maxFromJson, maxFromStatic, HTML_URL, CONST } from './settings.js';



const pick = (/** @type {string | any[]} */ arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffleArray = (arr) => arr.sort(() => Math.random() - 0.5);

export const Config = {
  userID: "be0ff9df-1468-41a0-8865-796d1c6800db",
  proxyIPs: ["nima.nscl.ir:443"],
  scamalytics: {
    username: "nimasecure999",
    apiKey: "ce75d58f98849753077a270e6013a036d6f4a6c562fd74c960960ae7a7087b40",
    baseUrl: "https://api12.scamalytics.com/v3/",
  },
  socks5: {
    enabled: false,
    relayMode: false,
    address: "",
  },

  /**
   * @param {{ PROXYIP: string; UUID: any; SCAMALYTICS_USERNAME: any; SCAMALYTICS_API_KEY: any; SCAMALYTICS_BASEURL: any; SOCKS5: any; SOCKS5_RELAY: string; }} env
   */
  fromEnv(env) {
    const selectedProxyIP =
      env.PROXYIP || this.proxyIPs[Math.floor(Math.random() * this.proxyIPs.length)];
    const [proxyHost, proxyPort = "443"] = selectedProxyIP.split(":");

    return {
      userID: env.UUID || this.userID,
      proxyIP: proxyHost,
      proxyPort: proxyPort,
      proxyAddress: selectedProxyIP,
      scamalytics: {
        username: env.SCAMALYTICS_USERNAME || this.scamalytics.username,
        apiKey: env.SCAMALYTICS_API_KEY || this.scamalytics.apiKey,
        baseUrl: env.SCAMALYTICS_BASEURL || this.scamalytics.baseUrl,
      },
      socks5: {
        enabled: !!env.SOCKS5,
        relayMode: env.SOCKS5_RELAY === "true" || this.socks5.relayMode,
        address: env.SOCKS5 || this.socks5.address,
      },
    };
  },
};


/**
 * @param {Request} request
 * @param {string} core
 * @param {any} userID
 * @param {string} hostName
 * @param {{ waitUntil: (arg0: Promise<void>) => void; }} ctx
 */
export async function handleIpSubscription(request, core, userID, hostName, ctx) {
  const url = new URL(request.url);
  const subName = url.searchParams.get("name");

  /**
   * Cake Subscription usage details
   * - These values create fake usage statistics for subscription clients
   * - Customize these values to display desired traffic and expiry information
   */
  const CAKE_INFO = {
    total_TB: 380, // Total traffic quota in Terabytes
    base_GB: 42000, // Base usage that's always shown (in Gigabytes)
    daily_growth_GB: 250, // Daily traffic growth (in Gigabytes) - simulates gradual usage
    expire_date: "2028-4-20", // Subscription expiry date (YYYY-MM-DD)
  };


  const httpsPorts = [443, 8443, 2053, 2083, 2087, 2096]; // Standard cloudflare TLS/HTTPS ports.
  const httpPorts = [80, 8080, 8880, 2052, 2082, 2086, 2095]; // Standard cloudflare TCP/HTTP ports.
  let links = [];
  const isPagesDeployment = hostName.endsWith(".pages.dev");
  
  const selectedDomains = shuffleArray(mainDomains).slice(0, maxDomains);

  selectedDomains.forEach((domain, i) => {
    links.push(
      buildLink({
        core,
        proto: "tls",
        userID,
        hostName,
        address: domain,
        port: pick(httpsPorts),
        tag: `Domain${i + 1}`,
      }),
    );
    if (isPagesDeployment && !isPagesDeployment) {
      links.push(
        buildLink({
          core,
          proto: "tcp",
          userID,
          hostName,
          address: domain,
          port: pick(httpPorts),
          tag: `Domain${i + 1}`,
        }),
      );
    }
  });

  try {
    const cache = caches.default;
    const cacheKey = new Request("https://cf-ip-cache.local");

    let response = await cache.match(cacheKey);

    if (!response) {
      const r = await safeFetch(
        "https://raw.githubusercontent.com/NiREvil/vless/refs/heads/main/Cloudflare-IPs.json",
        {},
        4000,
      );
      if (r.ok) {
        response = new Response(await r.text(), {
          headers: {
            "Cache-Control": "public, max-age=86400",
          },
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
    }

    if (response) {
      const json = await response.json();
      //const ips = [...(json.ipv4 || []), ...(json.ipv6 || [])].slice(0, 20).map((x) => x.ip);

      // Shuffle both sources
      const jsonIPs = shuffleArray([...new Set(
        [...(json.ipv4 || []), ...(json.ipv6 || [])].map((x) => x.ip).filter(Boolean)
      )]);
      const staticIPsPool = shuffleArray([...new Set(staticIPs)]);
      // Pick with availability check
      const fromJson   = jsonIPs.slice(0, Math.min(maxFromJson, jsonIPs.length));
      const fromStatic = staticIPsPool.slice(0, Math.min(maxFromStatic, staticIPsPool.length));

      // Merge and deduplicate
      const ips = [...new Set([...fromJson, ...fromStatic])];
      //onsole.log(ips);
      ips.forEach((ip, i) => {
        const formattedAddress = ip.includes(":") ? `[${ip}]` : ip;
        links.push(
          buildLink({
            core,
            proto: "tls",
            userID,
            hostName,
            address: formattedAddress,
            port: pick(httpsPorts),
            tag: `IP${i + 1}`,
          }),
        );
        if (isPagesDeployment && !isPagesDeployment) {
          links.push(
            buildLink({
              core,
              proto: "tcp",
              userID,
              hostName,
              address: formattedAddress,
              port: pick(httpPorts),
              tag: `IP${i + 1}`,
            }),
          );
        }
      });
    }
  } catch (e) {
    console.error("Cached IP fetch failed", e);
  }

  // Creating cake information headers
  const GB_in_bytes = 1024 * 1024 * 1024;
  const TB_in_bytes = 1024 * GB_in_bytes;
  const total_bytes = CAKE_INFO.total_TB * TB_in_bytes;
  const base_bytes = CAKE_INFO.base_GB * GB_in_bytes;
  // Calculating "dynamic" consumption based on hours per day
  const now = new Date();
  const hours_passed = now.getHours() + now.getMinutes() / 60;
  const daily_growth_bytes = (hours_passed / 24) * (CAKE_INFO.daily_growth_GB * GB_in_bytes);
  // Splitting usage between upload and download
  const cake_download = base_bytes + daily_growth_bytes / 2;
  const cake_upload = base_bytes + daily_growth_bytes / 2;
  // Convert expiration date to Unix Timestamp
  const expire_timestamp = Math.floor(new Date(CAKE_INFO.expire_date).getTime() / 1000);
  const subInfo = `upload=${Math.round(cake_upload)}; download=${Math.round(cake_download)}; total=${total_bytes}; expire=${expire_timestamp}`;

  const headers = {
    "Content-Type": "text/plain;charset=utf-8",
    "Profile-Update-Interval": "6",
    "Subscription-Userinfo": subInfo,
  };

  if (subName) headers["Profile-Title"] = subName;
  return new Response(btoa(links.join("\n")), { headers });
}

const decodeSecure = (encoded) => atob(encoded);

/**
 * @param {URL | RequestInfo<unknown, CfProperties<unknown>>} url
 */
export async function safeFetch(url, options = {}, timeout = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}


/**
 * Generates a random path string for WebSocket connection.
 * @param {number} length - Length of the random path part.
 * @param {string} [query] - Optional query string to append (e.g., 'ed=2048').
 * @returns {string} The generated path.
 */
function generateRandomPath(length = 28, query = "") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `/${result}${query ? `?${query}` : ""}`;
}

const CORE_PRESETS = {
  // Xray cores – Dream
  xray: {
    tls: {
      path: () => generateRandomPath(12, "ed=2048"),
      security: "tls",
      fp: "chrome",
      alpn: "http/1.1",
      extra: {},
    },
    tcp: {
      path: () => generateRandomPath(12, "ed=2560"),
      security: "none",
      fp: "chrome",
      extra: {},
    },
  },
  // Singbox cores – Freedom
  sb: {
    tls: {
      path: () => generateRandomPath(18),
      security: "tls",
      fp: "chrome",
      alpn: "http/1.1",
      extra: CONST.ED_PARAMS,
    },
    tcp: {
      path: () => generateRandomPath(18),
      security: "none",
      fp: "chrome",
      extra: CONST.ED_PARAMS,
    },
  },
};

/**
 * @param {any} tag
 * @param {string} proto
 */
function makeName(tag, proto) {
  return `${tag}-${proto.toUpperCase()}`;
}

function createVlessLink({
  userID,
  address,
  port,
  host,
  path,
  security,
  sni,
  fp,
  alpn,
  extra = {},
  name,
}) {
  const params = new URLSearchParams({
    type: decodeSecure("d3M="), // "ws"
    host,
    path,
  });

  if (security) {
    params.set("security", security);
    if (security === "tls") params.set("allowInsecure", "0");
  }

  if (sni) params.set("sni", sni);
  if (fp) params.set("fp", fp);
  if (alpn) params.set("alpn", alpn);

  for (const [k, v] of Object.entries(extra)) params.set(k, v);

  return `${CONST.VLESS_PROTOCOL}://${userID}@${address}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
}

function buildLink({ core, proto, userID, hostName, address, port, tag }) {
  const p = CORE_PRESETS[core][proto];
  return createVlessLink({
    userID,
    address,
    port,
    host: hostName,
    path: p.path(),
    security: p.security,
    sni: p.security === "tls" ? hostName : undefined,
    fp: p.fp,
    alpn: p.alpn,
    extra: p.extra,
    name: makeName(tag, proto),
  });
}

export async function handleScamalyticsLookup(request, config) {
  const url = new URL(request.url);
  const ipToLookup = url.searchParams.get("ip");
  if (!ipToLookup)
    return new Response(JSON.stringify({ error: "Missing IP" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  const { username, apiKey, baseUrl } = config.scamalytics;
  if (!username || !apiKey)
    return new Response(JSON.stringify({ error: "Scamalytics API not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });

  const scamalyticsUrl = `${baseUrl}${username}/?key=${apiKey}&ip=${ipToLookup}`;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const scamalyticsResponse = await fetch(scamalyticsUrl);
    const responseBody = await scamalyticsResponse.json();
    return new Response(JSON.stringify(responseBody), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.toString() }), { status: 500, headers });
  }
}

export async function handleConfigPage(userID, hostName, proxyAddress) {
  const dream = buildLink({
    core: "xray",
    proto: "tls",
    userID,
    hostName,
    address: hostName,
    port: 443,
    tag: `${hostName}-Xray`,
  });
  const freedom = buildLink({
    core: "sb",
    proto: "tls",
    userID,
    hostName,
    address: hostName,
    port: 443,
    tag: `${hostName}-Singbox`,
  });

  const encodedSubName = encodeURIComponent("INDEX");
  const subXrayUrl = `https://${hostName}/xray/${userID}?name=${encodedSubName}`;
  const subSbUrl = `https://${hostName}/sb/${userID}?name=${encodedSubName}`;

  try {
    const response = await safeFetch(HTML_URL);
    if (!response.ok) throw new Error(`Failed to load HTML from GitHub Pages: ${response.status}`);

    let finalHTML = await response.text();

    finalHTML = finalHTML
      .replace(/{{PROXY_ADDRESS}}/g, proxyAddress)
      .replace(/{{CONFIG_DREAM}}/g, dream)
      .replace(/{{CONFIG_FREEDOM}}/g, freedom)
      .replace(/{{URL_HIDDIFY}}/g, `hiddify://install-config?url=${encodeURIComponent(subXrayUrl)}`)
      .replace(
        /{{URL_V2RAYNG}}/g,
        `v2rayng://install-config?url=${encodeURIComponent(subXrayUrl)}#${encodedSubName}`,
      )
      .replace(
        /{{URL_CLASH}}/g,
        `clash://install-config?url=${encodeURIComponent(`https://revil-sub.pages.dev/sub/clash-meta?url=${subSbUrl}`)}`,
      )
      .replace(
        /{{URL_EXCLAVE}}/g,
        `sn://subscription?url=${encodeURIComponent(subSbUrl)}&name=${encodedSubName}`,
      );

    return new Response(finalHTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return new Response(`Error rendering panel: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}