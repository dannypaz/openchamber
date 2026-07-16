import fs from 'node:fs';

export const PRODUCTION_UPDATER_FEED = Object.freeze({
  provider: 'github',
  owner: 'dannypaz',
  repo: 'openchamber',
});

export const MAIN_CHANNEL_UPDATER_FEED = Object.freeze({
  provider: 'github',
  owner: 'dannypaz',
  repo: 'openchamber',
  channel: 'main',
});

const isLoopbackHostname = (hostname) => {
  if (hostname === '::1' || hostname === '[::1]') return true;
  const octets = hostname.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return false;
  const values = octets.map(Number);
  return values[0] === 127 && values.every((value) => value <= 255);
};

export const parseLoopbackUpdaterUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:')
      || !isLoopbackHostname(url.hostname)
      || url.username
      || url.password
      || url.search
      || url.hash) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const resolveBaseFeed = (updateChannel) =>
  updateChannel === 'main' ? MAIN_CHANNEL_UPDATER_FEED : PRODUCTION_UPDATER_FEED;

export const resolveUpdaterFeed = ({
  environment = process.env,
  testBuild = false,
  updateChannel = 'stable',
} = {}) => {
  const baseFeed = resolveBaseFeed(updateChannel);

  if (environment.OPENCHAMBER_E2E !== '1'
    || testBuild !== true) {
    return baseFeed;
  }

  const url = parseLoopbackUpdaterUrl(environment.OPENCHAMBER_UPDATER_E2E_URL);
  if (!url) return baseFeed;
  return { provider: 'generic', url };
};
