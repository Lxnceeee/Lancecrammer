// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { SerialPort } = require('serialport');

const PORT = 3000;
const GSM_PORT = process.env.GSM_PORT || 'COM4'; // <-- change to your actual COM port
const BAUD = Number(process.env.GSM_BAUD || 115200); // SIM800 usually 9600, sometimes 115200
const BAUD_CANDIDATES = [...new Set([BAUD, 9600, 115200])];
const AT_TIMEOUT_MS = 1200;
const AT_RETRIES = 2;
const MODEM_READY_TIMEOUT_MS = 15000;
const SMS_PROMPT_TIMEOUT_MS = 12000;
const SMS_FINAL_TIMEOUT_MS = 35000;
const PER_SMS_TIMEOUT_MS = 180000;
const SEND_GAP_MS = 350;
const FIREBASE_ENV_MAP = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  storageBucket: 'FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
  appId: 'FIREBASE_APP_ID'
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

process.on('unhandledRejection', (reason) => {
  const message = reason && reason.message ? reason.message : String(reason);
  console.error('Unhandled promise rejection:', message);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.message ? err.message : err);
});

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'smsblastingver8.html'));
});

app.get('/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json({ ok: true, ports });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/firebase-config', (req, res) => {
  const config = {};
  const missing = [];

  Object.entries(FIREBASE_ENV_MAP).forEach(([field, envKey]) => {
    const value = String(process.env[envKey] || '').trim();
    config[field] = value;
    if (!value) {
      missing.push(envKey);
    }
  });

  res.json({
    ok: missing.length === 0,
    config,
    missing
  });
});

let port = null;
let modemLock = Promise.resolve();
let activeBaud = BAUD;
let activePortPath = GSM_PORT;

const ensurePortInstance = (path = activePortPath, baudRate = activeBaud) => {
  const samePath = port && port.path === path;
  const usable = port && !port.destroyed;
  if (usable && samePath) {
    return;
  }

  if (port && !port.destroyed) {
    try {
      port.removeAllListeners();
    } catch (_) {}
  }
  port = new SerialPort({ path, baudRate, autoOpen: false });
  port.on('error', (err) => {
    console.error(`Serial error on ${activePortPath}: ${err.message}`);
  });
  activePortPath = path;
  activeBaud = baudRate;
};

const openPort = () =>
  new Promise((resolve, reject) => {
    ensurePortInstance(activePortPath, activeBaud);
    if (port.isOpen) return resolve();
    port.open(err => (err ? reject(err) : resolve()));
  });

const closePort = () =>
  new Promise((resolve, reject) => {
    if (!port) return resolve();
    if (!port.isOpen) {
      port = null;
      return resolve();
    }
    port.close(err => {
      port = null;
      if (err) return reject(err);
      resolve();
    });
  });

const updateBaudRate = (baudRate) =>
  new Promise((resolve, reject) => {
    ensurePortInstance(activePortPath, activeBaud);
    if (activeBaud === baudRate) return resolve();
    if (!port.isOpen) {
      activeBaud = baudRate;
      return resolve();
    }
    port.update({ baudRate }, err => {
      if (err) return reject(err);
      activeBaud = baudRate;
      resolve();
    });
  });

const sendATOnce = (cmd, timeoutMs = AT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    if (!port || port.destroyed || !port.isOpen) {
      return reject(new Error('Serial port is not initialized'));
    }
    const lines = [];
    let rawBuffer = '';
    let done = false;
    let timer = null;

    const scheduleTimeout = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        finish(new Error(`Timeout waiting for response to ${cmd}. Lines: ${lines.join(' | ') || '(none)'}`));
      }, timeoutMs);
    };

    const finish = (err) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      port.off('data', onData);
      if (err) reject(err);
      else resolve(lines);
    };

    const onData = (chunk) => {
      rawBuffer += chunk.toString('utf8');
      const parts = rawBuffer.split(/[\r\n]+/);
      rawBuffer = parts.pop() || '';

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        lines.push(trimmed);
        if (trimmed === 'OK') {
          return finish();
        }
        if (trimmed === 'ERROR' || trimmed.includes('CMS ERROR') || trimmed.includes('CME ERROR')) {
          return finish(new Error(lines.join(' | ')));
        }
        scheduleTimeout();
      }
    };

    scheduleTimeout();
    port.on('data', onData);
    try {
      port.write(cmd + '\r', err => {
        if (err) finish(err);
      });
    } catch (err) {
      finish(err);
    }
  });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const sendAT = async (cmd, timeoutMs = AT_TIMEOUT_MS, retries = AT_RETRIES) => {
  let lastError;
  for (let i = 1; i <= retries; i++) {
    try {
      return await sendATOnce(cmd, timeoutMs);
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await sleep(300);
      }
    }
  }
  throw lastError || new Error(`Failed to execute command: ${cmd}`);
};

const withModemLock = (task) => {
  const next = modemLock.then(task, task);
  modemLock = next.catch(() => {});
  return next;
};

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

const isFatalModemError = (msg = '') => {
  const value = String(msg);
  return (
    value.includes('Timeout waiting for response to AT') ||
    value.includes('Timed out waiting for modem prompt') ||
    value.includes('Failed to open') ||
    value.includes('ENOENT') ||
    value.includes('Access is denied') ||
    value.includes('The semaphore timeout period has expired')
  );
};

const normalizePhone = (raw) => {
  let value = String(raw || '').trim();
  if (!value) return '';
  value = value.replace(/[^\d+]/g, '');
  if (value.startsWith('+')) {
    value = '+' + value.slice(1).replace(/\D/g, '');
  } else {
    value = value.replace(/\D/g, '');
  }
  if (value.startsWith('+63')) return '+63' + value.slice(3);
  if (value.startsWith('63')) return '+' + value;
  if (value.startsWith('0')) return '+63' + value.slice(1);
  if (value.startsWith('9') && value.length === 10) return '+63' + value;
  return value;
};

const resetPromptState = async () => {
  if (!port || port.destroyed || !port.isOpen) return;
  // If modem is stuck waiting for SMS body after AT+CMGS, ESC exits prompt mode.
  await new Promise((resolve) => {
    try {
      port.write('\x1B\r', () => resolve());
    } catch (_) {
      resolve();
    }
  });
  await sleep(150);
  try {
    await new Promise((resolve, reject) => port.flush(err => (err ? reject(err) : resolve())));
  } catch (_) {
    // Best effort only.
  }
};

const hardResetSmsPromptState = async () => {
  if (!port || port.destroyed || !port.isOpen) return;
  // Some modules need repeated cancel bytes to leave the CMGS '>' editor.
  const writes = [Buffer.from([0x1B]), Buffer.from([0x1A]), Buffer.from('\r', 'ascii')];
  for (const payload of writes) {
    await new Promise((resolve) => {
      try {
        port.write(payload, () => resolve());
      } catch (_) {
        resolve();
      }
    });
    await sleep(80);
  }
  try {
    await new Promise((resolve, reject) => port.flush(err => (err ? reject(err) : resolve())));
  } catch (_) {}
};

const ensureModemReady = async () => {
  const errors = [];

  const listedPorts = await SerialPort.list().catch(() => []);
  const candidatePaths = [...new Set([GSM_PORT, ...listedPorts.map(p => p.path).filter(Boolean)])];

  const tryPortAndBaud = async (path, baud) => {
    try {
      await closePort();
    } catch (_) {}

    ensurePortInstance(path, baud);
    await openPort();
    if (!port || port.destroyed || !port.isOpen) {
      throw new Error(`Failed to open serial port ${path} @ ${baud}`);
    }

    await sleep(80);
    await resetPromptState();
    await sendAT('AT', AT_TIMEOUT_MS, AT_RETRIES);
    activePortPath = path;
    activeBaud = baud;
  };

  const probe = async () => {
    for (const path of candidatePaths) {
      for (const baud of BAUD_CANDIDATES) {
        try {
          await tryPortAndBaud(path, baud);
          return;
        } catch (err) {
          errors.push(`${path} @ ${baud}: ${err.message}`);
        }
      }
    }
    throw new Error(
      `No modem response. Tried ports ${candidatePaths.join(', ')} and baud rates ${BAUD_CANDIDATES.join(', ')}. Last error: ${errors[errors.length - 1] || 'unknown'}`
    );
  };

  await withTimeout(
    probe(),
    MODEM_READY_TIMEOUT_MS,
    `No modem AT response within ${MODEM_READY_TIMEOUT_MS}ms`
  );
};

const waitForPrompt = (promptChar = '>', timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    let buffer = '';
    const onData = data => {
      buffer += data.toString();
      if (buffer.includes(promptChar)) {
        port.off('data', onData);
        clearTimeout(timer);
        resolve(true);
      }
    };
    const timer = setTimeout(() => {
      port.off('data', onData);
      reject(new Error('Timed out waiting for modem prompt'));
    }, timeoutMs);
    port.on('data', onData);
  });

const waitForFinalResponse = (timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const lines = [];
    let rawBuffer = '';
    let sawCmgs = false;

    const finish = err => {
      port.off('data', onData);
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(lines);
    };

    const onData = chunk => {
      rawBuffer += chunk.toString('utf8');
      if (rawBuffer.length > 4096) {
        rawBuffer = rawBuffer.slice(-4096);
      }

      // Parse regular line-delimited responses first.
      const parts = rawBuffer.split(/\r?\n/);
      rawBuffer = parts.pop() || '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        lines.push(trimmed);

        if (trimmed.startsWith('+CMGS:')) {
          sawCmgs = true;
          continue;
        }
        if (trimmed === 'OK') {
          return finish();
        }
        if (trimmed === 'ERROR' || trimmed.includes('CMS ERROR') || trimmed.includes('CME ERROR')) {
          return finish(new Error(lines.join(' | ')));
        }
      }

      // Some modems emit final tokens without clean newlines.
      const probe = rawBuffer;
      if (!sawCmgs && /\+CMGS:\s*\d+/.test(probe)) {
        sawCmgs = true;
      }
      if (/(^|\r|\n)OK(\r|\n|$)/.test(probe)) {
        if (!lines.includes('OK')) lines.push('OK');
        return finish();
      }
      const errMatch = probe.match(/(CMS ERROR:[^\r\n]*|CME ERROR:[^\r\n]*|(^|\r|\n)ERROR(\r|\n|$))/);
      if (errMatch) {
        const token = String(errMatch[1] || 'ERROR').trim();
        if (token && !lines.includes(token)) lines.push(token);
        return finish(new Error(lines.join(' | ')));
      }
    };

    const timer = setTimeout(() => {
      const trailing = rawBuffer.trim();
      if (trailing) {
        lines.push(`raw:${trailing.slice(0, 240)}`);
      }
      const reason = sawCmgs
        ? 'Timed out waiting for final OK after +CMGS'
        : 'Timed out waiting for modem response after Ctrl+Z';
      finish(new Error(`${reason}. Lines: ${lines.join(' | ') || '(none)'}`));
    }, timeoutMs);

    port.on('data', onData);
  });

const writePort = (data) =>
  new Promise((resolve, reject) => {
    port.write(data, err => {
      if (err) return reject(err);
      port.drain(drainErr => (drainErr ? reject(drainErr) : resolve()));
    });
  });

const sanitizeSmsMessage = (value) => {
  const text = String(value || '');
  // Remove control chars except CR/LF/TAB which are usually safe in text mode SMS.
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};

const ensureNetworkReadyForSms = async () => {
  const cpin = await sendAT('AT+CPIN?', AT_TIMEOUT_MS, 2);
  if (!cpin.some(line => /READY/i.test(line))) {
    throw new Error(`SIM not ready: ${cpin.join(' | ')}`);
  }

  const creg = await sendAT('AT+CREG?', AT_TIMEOUT_MS, 2);
  const cregJoined = creg.join(' | ');
  if (!/[,\s](1|5)\b/.test(cregJoined)) {
    throw new Error(`Not registered to network: ${cregJoined}`);
  }

  const csq = await sendAT('AT+CSQ', AT_TIMEOUT_MS, 2);
  const csqJoined = csq.join(' | ');
  const m = csqJoined.match(/\+CSQ:\s*(\d+)\s*,/i);
  if (m) {
    const rssi = Number(m[1]);
    if (Number.isFinite(rssi) && (rssi === 99 || rssi <= 5)) {
      throw new Error(`Weak/no signal (CSQ ${rssi}): ${csqJoined}`);
    }
  }
};

const sendSMSAttempt = async (phone, message, bodyMode = 'inline') => {
  const safeMessage = sanitizeSmsMessage(message);
  await hardResetSmsPromptState();
  await sendAT('AT', AT_TIMEOUT_MS, 2);
  console.log('ATE0');
  console.log(await sendAT('ATE0', AT_TIMEOUT_MS, 2));
  console.log('AT+CMEE=2');
  console.log(await sendAT('AT+CMEE=2', AT_TIMEOUT_MS, 2));
  console.log('AT+CMGF=1');
  console.log(await sendAT('AT+CMGF=1', AT_TIMEOUT_MS, 2));
  // Best effort: prefer GSM charset in text mode.
  await sendAT('AT+CSCS="GSM"', AT_TIMEOUT_MS, 1).catch(() => []);
  console.log(`AT+CMGS="${phone}"`);
  const promptPromise = waitForPrompt('>', SMS_PROMPT_TIMEOUT_MS);
  await new Promise((resolve, reject) => {
    port.write(`AT+CMGS="${phone}"\r`, err => (err ? reject(err) : resolve()));
  });
  await promptPromise;
  console.log('Writing message + Ctrl+Z');
  const finalRespPromise = waitForFinalResponse(SMS_FINAL_TIMEOUT_MS);
  const messageBytes = Buffer.from(safeMessage, 'latin1');
  if (bodyMode === 'split-cr') {
    await writePort(Buffer.concat([messageBytes, Buffer.from('\r', 'ascii')]));
    await sleep(120);
    await writePort(Buffer.from([0x1A]));
  } else if (bodyMode === 'split-crlf') {
    await writePort(Buffer.concat([messageBytes, Buffer.from('\r\n', 'ascii')]));
    await sleep(120);
    await writePort(Buffer.from([0x1A]));
  } else if (bodyMode === 'split-delay') {
    await writePort(messageBytes);
    await sleep(350);
    await writePort(Buffer.from([0x1A]));
  } else if (bodyMode === 'split') {
    await writePort(messageBytes);
    await sleep(120);
    await writePort(Buffer.from([0x1A]));
  } else {
    await writePort(Buffer.concat([messageBytes, Buffer.from([0x1A])]));
  }
  const finalResp = await finalRespPromise;
  console.log('Final response:', finalResp);
};

const sendSMS = async (phone, message) => {
  return withModemLock(async () => {
    await ensureModemReady();
    await ensureNetworkReadyForSms();
    const bodyModes = ['inline', 'split-cr', 'split-crlf', 'split-delay', 'split'];
    let lastErr = null;
    for (let attempt = 1; attempt <= bodyModes.length; attempt++) {
      try {
        await sendSMSAttempt(phone, message, bodyModes[attempt - 1]);
        return;
      } catch (err) {
        lastErr = err;
        const errMsg = err && err.message ? err.message : String(err);
        console.warn(`SMS attempt ${attempt} (${bodyModes[attempt - 1]}) failed for ${phone}: ${errMsg}`);
        try {
          await resetPromptState();
        } catch (_) {}

        // Keep retries on the same modem session to avoid random port/baud hopping.
        // If the session appears broken, do a controlled reopen on the active path only.
        const needsRecover =
          errMsg.includes('No modem response') ||
          errMsg.includes('Serial port is not initialized') ||
          errMsg.includes('Access is denied') ||
          errMsg.includes('Timed out waiting for response to AT');
        if (needsRecover) {
          try {
            await closePort();
          } catch (_) {}
          ensurePortInstance(activePortPath, activeBaud);
          await openPort();
          await sleep(120);
        }
        if (attempt < bodyModes.length) {
          await sleep(500);
        }
      }
    }
    throw lastErr || new Error('Failed to send SMS');
  });
};

const parseGsmTimestamp = (raw = '') => {
  const value = String(raw || '').trim();
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{2}),(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return Date.now();
  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);
  const ss = Number(m[6]);
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  const dt = new Date(year, mm - 1, dd, hh, mi, ss);
  return Number.isNaN(dt.getTime()) ? Date.now() : dt.getTime();
};

const parseInboxFromCmglLines = (lines) => {
  const grouped = new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line.startsWith('+CMGL:')) continue;

    const headerMatch = line.match(/^\+CMGL:\s*(\d+),\"([^\"]+)\",\"([^\"]*)\"(?:,\"[^\"]*\")?,\"([^\"]*)\"/);
    if (!headerMatch) continue;

    const slot = headerMatch[1];
    const status = (headerMatch[2] || '').toUpperCase();
    const phone = (headerMatch[3] || '').trim() || `Unknown-${slot}`;
    const dateRaw = headerMatch[4] || '';
    const body = (lines[i + 1] || '').trim();
    const epoch = parseGsmTimestamp(dateRaw);
    const time = new Date(epoch).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (!grouped.has(phone)) {
      grouped.set(phone, {
        id: `gsm-${phone.replace(/[^\w]/g, '')}` || `gsm-${slot}`,
        name: phone,
        phone,
        unread: 0,
        messages: []
      });
    }

    const convo = grouped.get(phone);
    convo.messages.push({
      id: `gsm-${slot}-${epoch}`,
      slot: Number(slot),
      direction: 'incoming',
      text: body || '(No content)',
      time,
      epoch
    });
    if (status.includes('UNREAD')) {
      convo.unread += 1;
    }
  }

  const conversations = Array.from(grouped.values()).map((conv) => {
    conv.messages.sort((a, b) => a.epoch - b.epoch);
    return conv;
  });

  conversations.sort((a, b) => {
    const aLatest = a.messages.length ? a.messages[a.messages.length - 1].epoch : 0;
    const bLatest = b.messages.length ? b.messages[b.messages.length - 1].epoch : 0;
    return bLatest - aLatest;
  });

  return conversations;
};

app.get('/status', async (req, res) => {
  try {
    await ensureModemReady();
    const resp = await sendAT('AT');
    res.json({ ok: true, port: activePortPath, baud: activeBaud, resp });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: `${e.message}. Check modem power, SIM inserted, and TX/RX wiring on ${GSM_PORT}.`
    });
  }
});

app.get('/diagnostics', async (req, res) => {
  try {
    await ensureModemReady();
    const at = await sendAT('AT');
    const cpin = await sendAT('AT+CPIN?');
    const creg = await sendAT('AT+CREG?');
    const csq = await sendAT('AT+CSQ');
    const cmgf = await sendAT('AT+CMGF=1');
    res.json({ ok: true, port: activePortPath, baud: activeBaud, at, cpin, creg, csq, cmgf });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: `${e.message}. Check modem power, SIM inserted, and TX/RX wiring on ${GSM_PORT}.`
    });
  }
});

app.get('/inbox', async (req, res) => {
  try {
    await ensureModemReady();
    await sendAT('AT+CMGF=1', AT_TIMEOUT_MS, 2);
    const lines = await sendAT('AT+CMGL="ALL"', 6000, 2);
    const conversations = parseInboxFromCmglLines(lines);
    res.json({ ok: true, conversations });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, conversations: [] });
  }
});

app.post('/inbox/delete', async (req, res) => {
  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  const normalized = [...new Set(slots.map((s) => Number(s)).filter((n) => Number.isInteger(n) && n >= 0))];
  if (normalized.length === 0) {
    return res.status(400).json({ ok: false, error: 'slots[] required' });
  }

  try {
    const results = await withModemLock(async () => {
      await ensureModemReady();
      const out = [];
      for (const slot of normalized) {
        try {
          await sendAT(`AT+CMGD=${slot}`, AT_TIMEOUT_MS, 2);
          out.push({ slot, ok: true });
        } catch (err) {
          out.push({ slot, ok: false, error: err.message });
        }
      }
      return out;
    });

    const successCount = results.filter(r => r.ok).length;
    const failedCount = results.length - successCount;
    res.json({ ok: failedCount === 0, successCount, failedCount, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/sms', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const message = String(req.body?.message || '');
  if (!phone || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'phone and message required' });
  }
  if (phone.replace(/[^\d]/g, '').length < 10) {
    return res.status(400).json({ ok: false, error: 'invalid phone number' });
  }

  try {
    await sendSMS(phone, message);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/sms/bulk', async (req, res) => {
  const inputPhones = Array.isArray(req.body?.phones) ? req.body.phones : [];
  const phones = [...new Set(inputPhones.map(normalizePhone).filter(p => p.replace(/[^\d]/g, '').length >= 10))];
  const message = String(req.body?.message || '');
  console.log('Bulk SMS request:', {
    count: phones.length,
    messagePreview: typeof message === 'string' ? message.slice(0, 120) : ''
  });
  if (!Array.isArray(inputPhones) || phones.length === 0 || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'phones[] and message required' });
  }

  try {
    await withModemLock(async () => {
      await ensureModemReady();
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: `Modem not ready: ${e.message}`,
      successCount: 0,
      failedCount: phones.length,
      results: phones.map(phone => ({ phone, ok: false, error: `Modem not ready: ${e.message}` }))
    });
  }

  const results = [];
  let fatalError = '';
  for (const phone of phones) {
    try {
      await withTimeout(
        sendSMS(phone, message),
        PER_SMS_TIMEOUT_MS,
        'Timed out while sending SMS'
      );
      results.push({ phone, ok: true });
    } catch (e) {
      const errMsg = e && e.message ? e.message : String(e);
      results.push({ phone, ok: false, error: errMsg });
      if (isFatalModemError(errMsg)) {
        fatalError = errMsg;
        break;
      }
    }
    await sleep(SEND_GAP_MS);
  }

  if (fatalError && results.length < phones.length) {
    for (let i = results.length; i < phones.length; i++) {
      results.push({ phone: phones[i], ok: false, error: `Skipped: ${fatalError}` });
    }
  }

  const successCount = results.filter(r => r.ok).length;
  const failedCount = results.length - successCount;
  const allFailed = successCount === 0;
  const firstFailure = results.find(r => !r.ok);

  if (allFailed) {
    return res.status(500).json({
      ok: false,
      error: firstFailure?.error
        ? `All SMS sends failed: ${firstFailure.error}`
        : 'All SMS sends failed',
      successCount,
      failedCount,
      results
    });
  }

  res.json({
    ok: true,
    successCount,
    failedCount,
    results
  });
});

function startServer() {
  const startOnHost = (host, required, onReady) => {
    const server = app.listen(PORT, host, () => {
      console.log(`Server listening on http://${host}:${PORT}`);
      if (typeof onReady === 'function') onReady();
    });

    server.on('error', (err) => {
      const code = err && err.code ? err.code : 'UNKNOWN';
      if (!required && (code === 'EAFNOSUPPORT' || code === 'EADDRNOTAVAIL' || code === 'EADDRINUSE')) {
        console.warn(`Skipping optional ${host} listener (${code})`);
        if (typeof onReady === 'function') onReady();
        return;
      }
      console.error(`Failed to start ${host} listener:`, err.message);
      process.exit(1);
    });
  };

  // Always start IPv4 loopback first.
  startOnHost('127.0.0.1', true, () => {
    // Best effort: enable IPv6 loopback too so clients using [::1] can connect.
    startOnHost('::1', false, () => {
      console.log(`Server ready on http://localhost:${PORT} (pid ${process.pid})`);
    });
  });
}

startServer();
