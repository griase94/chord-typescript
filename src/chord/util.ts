import * as crypto from 'crypto';

import { RING_SIZE } from '../settings/settings';

export function hashStringSHA1(str: string): number {
  const hash = crypto.createHash('sha1').update(str).digest('hex');
  // We'll parse a portion of it as an integer, then mod by RING_SIZE
  // For bigger chord rings, parse the whole or bigger part of the hash
  const asInt = parseInt(hash.substring(0, 8), 16); // parse first 8 hex digits
  return asInt % RING_SIZE;
}

//function to check wether a given id is >= another given id considering the ring structure of the chord ring
export function isInSemiOpenInterval(
  id: number,
  start: number,
  end: number,
): boolean {
  if (start < end) {
    return id > start && id <= end;
  } else {
    return id > start || id <= end;
  }
}

//function to check wether a given id is > another given id considering the ring structure of the chord ring
export function isInOpenInterval(
  id: number,
  start: number,
  end: number,
): boolean {
  if (start < end) {
    return id > start && id < end;
  } else {
    return id > start || id < end;
  }
}
