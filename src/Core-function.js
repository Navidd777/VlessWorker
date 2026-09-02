import { connect } from "cloudflare:sockets";
import { safeFetch } from './VlessConfig.js'; 
import { CONST } from './settings.js';


function concatBuffers(...buffers) {
  const total = buffers.reduce((n, b) => n + (b.byteLength ?? b.length ?? 0), 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    const view = b instanceof Uint8Array ? b : new Uint8Array(b.buffer ?? b);
    result.set(view, offset);
    offset += view.byteLength;
  }
  return result.buffer;
}

/**
 * Core vless protocol logic
 * Handles VLESS protocol over WebSocket.
 * @param {Request} reqst
 * @param {object} config
 * @returns {Promise<Response>}
 */
export async function ProtocolOverWSHandler(reqst, config) {
  const wsPair = new WebSocketPair();
  const [client, webSocket] = Object.values(wsPair);
  webSocket.accept();
  let address = "";
  let portWithRandomLog = "";
  let udpStreamWriter = null;
  const Wslog = (info, event) => {
    console.log(`[${address}:${portWithRandomLog}] ${info}`, event || "");
  };
  const WsEarlyDataHeader = reqst.headers.get("Sec-WebSocket-Protocol") || "";
  const readableWebSocketStream = MakeReadableWebSocketStream(webSocket, WsEarlyDataHeader, Wslog);
  let remoteSocketWapper = { value: null };

  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          //console.log(`[MAIN] Write handler called`);
          //console.log(`[MAIN] Chunk type: ${chunk.constructor.name}, size: ${chunk.byteLength || chunk.length}`);
          if (udpStreamWriter) {
            //console.log(`[MAIN] Routing to DNS`);
            return udpStreamWriter.write(chunk);
          }
          if (remoteSocketWapper.value) {
            //console.log(`[MAIN] Using existing remote socket`);
            const writer = remoteSocketWapper.value.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }
          //console.log(`[MAIN] Processing new VLESS header`);
          // Convert chunk to ArrayBuffer for processVlessHeader
          //console.log('Chunk type:', typeof chunk, chunk?.constructor?.name, chunk?.byteLength);
          const buffer = chunk instanceof Blob ? await chunk.arrayBuffer() : chunk.buffer || chunk;          
          //console.log('chunt to new buffer : \nbuffer type:', typeof buffer, buffer?.constructor?.name, buffer?.byteLength);
  
          const {
            hasError,
            message,
            addressType,
            portRemote = 443,
            addressRemote = "",
            rawDataIndex,
            ProtocolVersion = new Uint8Array([0, 0]),
            isUDP,
          } = ProcessProtocolHeader(buffer, config.userID);
          address = addressRemote;
          portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? "udp" : "tcp"} `;

          if (hasError) throw new Error(message);

          const vlessResponseHeader = new Uint8Array([ProtocolVersion[0], 0]);
          const rawClientData = buffer.slice(rawDataIndex);
          //console.log('rawDataIndex:',rawDataIndex)  
          if (isUDP) {
            if (portRemote === 53) {
              const dnsPipeline = await createDnsPipeline(webSocket, vlessResponseHeader, Wslog);
              udpStreamWriter = dnsPipeline.write;
              udpStreamWriter(rawClientData);
            } else {
              throw new Error("UDP proxy is only enabled for DNS (port 53)");
            }
            return;
          }

          HandleTCPOutBound(
            remoteSocketWapper,
            addressType,
            addressRemote,
            portRemote,
            rawClientData,
            webSocket,
            vlessResponseHeader,
            Wslog,
            config,
          );
        },
        close() {
          Wslog(`readableWebSocketStream closed`);
        },
        abort(err) {
          Wslog(`readableWebSocketStream aborted`, err);
        },
      }),
    )
    .catch((err) => {
      console.error("Pipeline failed:", err.stack || err);
    });

  return new Response(null, { status: 101, webSocket: client });
}

/**
 * @param {string} uuid
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}



/**
 * Handles TCP outbound logic for VLESS.
 * @param {{ value: any; }} TCPremoteSocket
 * @param {number} TCPaddressType
 * @param {string} TCPaddressRemote
 * @param {number} TCPportRemote
 * @param {any} TCPrawClientData
 * @param {WebSocket} TCPwebSocket
 * @param {Uint8Array} TCPprotocolResponseHeader
 * @param {{ (info: any, event: any): void; (arg0: string): void; }} TCPlog
 * @param {{ socks5Relay: any; parsedSocks5Address: any; enableSocks: any; proxyIP: any; proxyPort: any; userID?: string; socks5Address?: string; }} TCPconfig
 */
async function HandleTCPOutBound(
  TCPremoteSocket,
  TCPaddressType,
  TCPaddressRemote,
  TCPportRemote,
  TCPrawClientData,
  TCPwebSocket,
  TCPprotocolResponseHeader,
  TCPlog,
  TCPconfig,
) {

  //log(`[TCP-OUT] Starting HandleTCPOutBound to ${addressRemote}:${portRemote}`);
  //log(`[TCP-OUT] rawClientData size: ${rawClientData?.byteLength || rawClientData?.length || 0} bytes`);
  // Log first 20 bytes of rawClientData for debugging
  /*if (rawClientData && rawClientData.byteLength > 0) {
    const firstBytes = new Uint8Array(rawClientData.slice(0, Math.min(20, rawClientData.byteLength)));
    log(`[TCP-OUT] rawClientData first bytes: ${Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  }*/
  async function connectAndWrite(address, port, socks = false) {
    //log(`[TCP-OUT] connectAndWrite called: address=${address}, port=${port}, socks=${socks}`);
    let tcpSocket;
    try {
    if (TCPconfig.socks5Relay) {
      //log(`[TCP-OUT] Using SOCKS5 relay to ${address}:${port}`);
      tcpSocket = await socks5Connect(TCPaddressType, address, port, TCPlog, TCPconfig.parsedSocks5Address);
    } else {
      //log(`[TCP-OUT] Direct connection to ${address}:${port}`);
      tcpSocket = socks
        ? await socks5Connect(TCPaddressType, address, port, TCPlog, TCPconfig.parsedSocks5Address)
        : connect({ hostname: address, port: port });
    }
    //log(`[TCP-OUT] Socket created successfully, writing rawClientData...`);
    TCPremoteSocket.value = tcpSocket;
    TCPlog(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(TCPrawClientData);
    //log(`[TCP-OUT] rawClientData written, result: ${writer.resultt}`);
    writer.releaseLock();
    return tcpSocket;
    } catch (error) {
      //log(`[TCP-OUT] ERROR in connectAndWrite: ${error.message}`);
      //log(`[TCP-OUT] Error stack: ${error.stack}`);
      throw error;
    }
  }

  async function retry() {
    //log(`[TCP-OUT] RETRY function called`);
    //log(`[TCP-OUT] config.enableSocks: ${config.enableSocks}`);
    //log(`[TCP-OUT] config.proxyIP: ${config.proxyIP}, config.proxyPort: ${config.proxyPort}`);
    try{
    const tcpSocket = TCPconfig.enableSocks
      ? await connectAndWrite(TCPaddressRemote, TCPportRemote, true)
      : await connectAndWrite(
          TCPconfig.proxyIP || TCPaddressRemote,
          TCPconfig.proxyPort || TCPportRemote,
          false,
        );
    //log(`[TCP-OUT] Retry connection successful`);
    tcpSocket.closed
      .catch((error) => console.log("retry tcpSocket closed error", error))
      .finally(() => {
          //log(`[TCP-OUT] Retry socket closed, closing WebSocket`);
          safeCloseWebSocket(TCPwebSocket);
        });
    RemoteSocketToWS(tcpSocket, TCPwebSocket, TCPprotocolResponseHeader, null, TCPlog);
    } catch(error) {
      TCPlog(`[TCP-OUT] RETRY failed: ${error.message}`);
    }
  }

  //const tcpSocket = await connectAndWrite(addressRemote, portRemote);
  //RemoteSocketToWS(tcpSocket, webSocket, TCPprotocolResponseHeader, retry, log);

  try {
    //log(`[TCP-OUT] Attempting primary connection to ${addressRemote}:${portRemote}`);
    const tcpSocket = await connectAndWrite(TCPaddressRemote, TCPportRemote);
    //log(`[TCP-OUT] Primary connection successful, setting up RemoteSocketToWS`);
    RemoteSocketToWS(tcpSocket, TCPwebSocket, TCPprotocolResponseHeader, retry, TCPlog);
  } catch (error) {
    TCPlog(`[TCP-OUT] PRIMARY CONNECTION FAILED: ${error.message}`);
    //log(`[TCP-OUT] Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
    //log(`[TCP-OUT] Initiating retry...`);
    await retry();
  }
}

/**
 * Converts WebSocket messages to a readable stream.
 * @param {WebSocket} webSocketServer
 * @param {string} earlyDataHeader
 * @param {{ (info: any, event: any): void; (arg0: string): void; }} log
 */
function MakeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  return new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener("message", (event) => {
        // Fix: Convert Blob to ArrayBuffer
        const data = event.data instanceof Blob ? event.data.arrayBuffer() : event.data;
        // Handle promise if Blob
        if (data instanceof Promise) {
          data.then(buffer => controller.enqueue(buffer)).catch(err => controller.error(err));
        } else {
          controller.enqueue(data);
        }
      });
      webSocketServer.addEventListener("close", () => {
        safeCloseWebSocket(webSocketServer);
        controller.close();
      });
      webSocketServer.addEventListener("error", (err) => {
        log("webSocketServer has error");
        controller.error(err);
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) controller.error(error);
      else if (earlyData) controller.enqueue(earlyData);
    },
    //pull(_controller) {},
    cancel(reason) {
      log(`ReadableStream was canceled, due to ${reason}`);
      safeCloseWebSocket(webSocketServer);
    },
  });
}

function ProcessProtocolHeader(protocolBuffer, userID) {
  if (protocolBuffer.byteLength < 24) return { hasError: true, message: "invalid data" };
  const dataView = new DataView(protocolBuffer); //First argument to DataView constructor must be an ArrayBuffer
  const version = dataView.getUint8(0);
  const slicedBufferString = stringify(new Uint8Array(protocolBuffer.slice(1, 17)));
  const uuids = userID.split(",").map((id) => id.trim());
  if (!slicedBufferString) return { hasError: true, message: "invalid uuid format" };
  const isValidUser = uuids.some((uuid) => slicedBufferString === uuid);
  if (!isValidUser) return { hasError: true, message: "invalid user" };

  const optLength = dataView.getUint8(17);
  const command = dataView.getUint8(18 + optLength);
  if (command !== 1 && command !== 2)
    return { hasError: true, message: `command ${command} is not supported` };

  const portIndex = 18 + optLength + 1;
  const portRemote = dataView.getUint16(portIndex);
  const addressType = dataView.getUint8(portIndex + 2);
  let addressValue, addressLength, addressValueIndex;

  switch (addressType) {
    case 1: // IPv4
      addressLength = 4;
      addressValueIndex = portIndex + 3;
      addressValue = new Uint8Array(
        protocolBuffer.slice(addressValueIndex, addressValueIndex + addressLength),
      ).join(".");
      break;
    case 2: // Domain
      addressLength = dataView.getUint8(portIndex + 3);
      addressValueIndex = portIndex + 4;
      addressValue = new TextDecoder().decode(
        protocolBuffer.slice(addressValueIndex, addressValueIndex + addressLength),
      );
      break;
    case 3: // IPv6
      addressLength = 16;
      addressValueIndex = portIndex + 3;
      addressValue = Array.from({ length: 8 }, (_, i) =>
        dataView.getUint16(addressValueIndex + i * 2).toString(16),
      ).join(":");
      break;
    default:
      return { hasError: true, message: `invalid addressType: ${addressType}` };
  }

  if (!addressValue)
    return { hasError: true, message: `addressValue is empty, addressType is ${addressType}` };

  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    ProtocolVersion: new Uint8Array([version]),
    isUDP: command === 2,
  };
}

/**
 * Pipes remote socket data to WebSocket.
 * @param {Socket} RsRemoteSocket
 * @param {WebSocket} RsWebSocket
 * @param {string | Uint8Array | ArrayBuffer | ArrayBufferView | Blob} RsProtocolResponseHeader
 * @param {{ (): Promise<void>; (): any; }} Rsetry
 * @param {{ (info: any, event: any): void; (arg0: string): void; (info: any, event: any): void; (arg0: string): void; (arg0: string): void; }} Rslog
 */
async function RemoteSocketToWS(RsRemoteSocket, RsWebSocket, RsProtocolResponseHeader, RsRetry, Rslog) {
  //log(`[SOCKET-TO-WS] Starting RemoteSocketToWS`);
  //log(`[SOCKET-TO-WS] WebSocket readyState: ${webSocket.readyState}`);
  //let vlessHeader = protocolResponseHeader;
  let hasIncomingData = false;
  try {
    await RsRemoteSocket.readable.pipeTo(
      new WritableStream({
        async write(chunk) {
          //log(`[SOCKET-TO-WS] DATA RECEIVED from remote: ${chunk.byteLength} bytes`);
          if (RsWebSocket.readyState !== CONST.WS_READY_STATE_OPEN)
            throw new Error("WebSocket is not open");
          /*if (vlessHeader) {
            log(`[SOCKET-TO-WS] Sending response with VLESS header (${vlessHeader.byteLength} bytes) + data (${chunk.byteLength} bytes)`);
          } else {
              log(`[SOCKET-TO-WS] Sending response without header (${chunk.byteLength} bytes)`);
          }*/
          hasIncomingData = true;
          const dataToSend = RsProtocolResponseHeader
            ? concatBuffers(RsProtocolResponseHeader, chunk)
            : chunk;
          RsWebSocket.send(dataToSend);
          RsProtocolResponseHeader = null;
        },
        close() {
          Rslog(`Remote connection readable closed.`);
        },
        abort(reason) {
          console.error(`Remote connection readable aborted:`, reason);
        },
      }),
    );
  } catch (error) {
    console.error(`RemoteSocketToWS error:`, error.stack || error);
    //log(`[SOCKET-TO-WS] Remote socket pipe error: ${error.message}`);
    safeCloseWebSocket(RsWebSocket);
  }
  //log(`[SOCKET-TO-WS] Remote socket readable completed`);
  //log(`[SOCKET-TO-WS] hasIncomingData: ${hasIncomingData}, retry exists: ${!!retry}`);
  
  if (!hasIncomingData && retry) {
    Rslog(`No incoming data, retrying`);
    await retry();
  }
}

/**
 * decodes base64 string to ArrayBuffer.
 * @param {string} base64Str
 */
function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { earlyData: null, error: null };
  try {
    const binaryStr = atob(base64Str.replace(/-/g, "+").replace(/_/g, "/"));
    const buffer = new ArrayBuffer(binaryStr.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binaryStr.length; i++) view[i] = binaryStr.charCodeAt(i);
    return { earlyData: buffer, error: null };
  } catch (error) {
    return { earlyData: null, error };
  }
}

/**
 * Safely closes a WebSocket connection.
 * @param {{ readyState: number; close: () => void; }} socket
 */
function safeCloseWebSocket(socket) {
  try {
    if (
      socket.readyState === CONST.WS_READY_STATE_OPEN ||
      socket.readyState === CONST.WS_READY_STATE_CLOSING
    )
      socket.close();
  } catch (error) {
    console.error("safeCloseWebSocket error:", error);
  }
}

const byteToHex = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).slice(1));

/*
 * @param {Uint8Array | (string | number)[]} arr
 */
function unsafeStringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset]] +
    byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] +
    byteToHex[arr[offset + 3]] +
    "-" +
    byteToHex[arr[offset + 4]] +
    byteToHex[arr[offset + 5]] +
    "-" +
    byteToHex[arr[offset + 6]] +
    byteToHex[arr[offset + 7]] +
    "-" +
    byteToHex[arr[offset + 8]] +
    byteToHex[arr[offset + 9]] +
    "-" +
    byteToHex[arr[offset + 10]] +
    byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] +
    byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] +
    byteToHex[arr[offset + 15]]
  ).toLowerCase();
}

/*
 * @param {Uint8Array} arr
 */
function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset);
  return isValidUUID(uuid) ? uuid : "";
}

/**
 * DNS pipeline for UDP DNS requests, using DNS-over-HTTPS, (REvil Method).
 * @param {WebSocket} PipWebSocket
 * @param {Uint8Array} PipVlessResponseHeader
 * @param {Function} log
 * @returns {Promise<{write: Function}>}
 */
async function createDnsPipeline(PipWebSocket, PipVlessResponseHeader, log) {
  let isHeaderSent = false;
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      // Parse UDP packets from VLESS framing
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPacketLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPacketLength));
        index = index + 2 + udpPacketLength;
        controller.enqueue(udpData);
      }
    },
  });

  transformStream.readable
    .pipeTo(
      new WritableStream({
        async write(chunk) {
          try {
            // Send DNS query using DoH
            const resp = await safeFetch(
              `https://1.1.1.1/dns-query`,
              {
                method: "POST",
                headers: { "content-type": "application/dns-message" },
                body: chunk,
              },
              3000,
            );
            const dnsQueryResult = await resp.arrayBuffer();
            const udpSize = dnsQueryResult.byteLength;
            const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);

            if (PipWebSocket.readyState === CONST.WS_READY_STATE_OPEN) {
              if (isHeaderSent) {
                //PipWebSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
                PipWebSocket.send(concatBuffers(udpSizeBuffer, dnsQueryResult));
              } else {
                //PipWebSocket.send(await new Blob([PipVlessResponseHeader, udpSizeBuffer, dnsQueryResult,]).arrayBuffer(),);
                PipWebSocket.send(concatBuffers(PipVlessResponseHeader, udpSizeBuffer, dnsQueryResult));
                isHeaderSent = true;
              }
            }
          } catch (error) {
            log("DNS query error: " + error);
          }
        },
      }),
    )
    .catch((e) => log("DNS stream error: " + e));

  const writer = transformStream.writable.getWriter();
  return {
    write: (/** @type {any} */ chunk) => writer.write(chunk),
  };
}

/**
 * SOCKS5 TCP connection logic.
 * @param {any} addressType
 * @param {string} addressRemote
 * @param {number} portRemote
 * @param {any} Slog
 * @param {{ username: any; password: any; hostname: any; port: any; }} parsedSocks5Addr
 */
async function socks5Connect(addressType, addressRemote, portRemote, Slog, parsedSocks5Addr) {
  const { username, password, hostname, port } = parsedSocks5Addr;
  const socket = connect({ hostname, port });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const encoder = new TextEncoder();

  await writer.write(new Uint8Array([5, 2, 0, 2]));
  let res = (await reader.read()).value;
  if (res[0] !== 0x05 || res[1] === 0xff) throw new Error("SOCKS5 server connection failed.");

  if (res[1] === 0x02) {
    if (!username || !password) throw new Error("SOCKS5 auth credentials not provided.");
    const authRequest = new Uint8Array([
      1,
      username.length,
      ...encoder.encode(username),
      password.length,
      ...encoder.encode(password),
    ]);
    await writer.write(authRequest);
    res = (await reader.read()).value;
    if (res[0] !== 0x01 || res[1] !== 0x00) throw new Error("SOCKS5 authentication failed.");
  }

  let DSTADDR;
  switch (addressType) {
    case 1:
      DSTADDR = new Uint8Array([1, ...addressRemote.split(".").map(Number)]);
      break;
    case 2:
      DSTADDR = new Uint8Array([3, addressRemote.length, ...encoder.encode(addressRemote)]);
      break;
    case 3:
      DSTADDR = new Uint8Array([
        4,
        ...addressRemote
          .split(":")
          .flatMap((x) => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)]),
      ]);
      break;
    default:
      throw new Error(`Invalid addressType for SOCKS5: ${addressType}`);
  }

  const socksRequest = new Uint8Array([5, 1, 0, ...DSTADDR, portRemote >> 8, portRemote & 0xff]);

  await writer.write(socksRequest); // SOCKS5 greeting
  res = (await reader.read()).value;
  if (res[1] !== 0x00) throw new Error("Failed to open SOCKS5 connection.");

  writer.releaseLock();
  reader.releaseLock();
  return socket;
}

