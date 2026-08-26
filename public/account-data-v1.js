/* Account Data v1 — fail-closed structural validation for independent account files.
   Pure UMD module: no DOM, State, fetch or Store dependencies. */
(function accountDataModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AccountDataV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAccountDataV1() {
  'use strict';

  const VERSION = '1.0.0';
  const SLOTS = Object.freeze(['days', 'weeks', 'rewards', 'purchases', 'achievements', 'lootbox', 'episodes', 'profile']);
  const SLOT_SET = new Set(SLOTS);
  const LIMITS = Object.freeze({
    days: 5000,
    weeks: 1500,
    rewards: 5000,
    purchases: 10000,
    achievements: 5000,
    episodes: 5000,
    objectKeys: 10000,
    arrayItems: 10000,
    depth: 16,
    string: 100000,
  });

  function plainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function safeJsonValue(value, depth, seen) {
    if (value == null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.length <= LIMITS.string;
    if (typeof value !== 'object' || depth > LIMITS.depth || seen.has(value)) return false;
    seen.add(value);
    let valid = true;
    if (Array.isArray(value)) {
      valid = value.length <= LIMITS.arrayItems && value.every((item) => safeJsonValue(item, depth + 1, seen));
    } else if (plainObject(value)) {
      const keys = Object.keys(value);
      valid = keys.length <= LIMITS.objectKeys
        && keys.every((key) => key.length <= 256
          && key !== '__proto__' && key !== 'prototype' && key !== 'constructor'
          && safeJsonValue(value[key], depth + 1, seen));
    } else valid = false;
    seen.delete(value);
    return valid;
  }

  function safeJson(value) { return safeJsonValue(value, 0, new Set()); }
  function boundedObject(value, limit) {
    return plainObject(value) && Object.keys(value).length <= limit && safeJson(value);
  }
  function objectMap(value, limit) {
    return boundedObject(value, limit) && Object.values(value).every(plainObject);
  }
  function objectRows(value, limit) {
    return Array.isArray(value) && value.length <= limit && value.every(plainObject) && safeJson(value);
  }
  function optionalType(object, key, type) {
    return !(key in object) || object[key] == null || typeof object[key] === type;
  }
  function optionalArray(object, key, limit) {
    return !(key in object) || (Array.isArray(object[key]) && object[key].length <= limit && safeJson(object[key]));
  }
  function optionalArrayOrFinite(object, key, limit) {
    return !(key in object)
      || (typeof object[key] === 'number' && Number.isFinite(object[key]) && object[key] >= 0)
      || (Array.isArray(object[key]) && object[key].length <= limit && safeJson(object[key]));
  }
  function optionalFinite(object, key) {
    return !(key in object) || (typeof object[key] === 'number' && Number.isFinite(object[key]) && object[key] >= 0);
  }

  function validateLootbox(value) {
    if (!boundedObject(value, 200)) return false;
    return optionalType(value, 'day', 'string')
      && optionalFinite(value, 'opened')
      && optionalFinite(value, 'goldWon')
      && optionalFinite(value, 'carry')
      && optionalFinite(value, 'cosmeticsWon')
      && optionalArray(value, 'titles', 1000)
      && optionalArray(value, 'history', 1000)
      && optionalArrayOrFinite(value, 'vouchers', 1000);
  }

  function validateProfile(value) {
    if (!boundedObject(value, 200)) return false;
    return optionalType(value, 'text', 'string')
      && optionalType(value, 'updatedAt', 'string')
      && optionalType(value, 'auto', 'boolean');
  }

  function validate(name, value) {
    if (!SLOT_SET.has(name)) return false;
    if (name === 'days') return objectMap(value, LIMITS.days);
    if (name === 'weeks') return objectMap(value, LIMITS.weeks);
    if (name === 'achievements') return boundedObject(value, LIMITS.achievements);
    if (name === 'rewards') return objectRows(value, LIMITS.rewards);
    if (name === 'purchases') return objectRows(value, LIMITS.purchases);
    if (name === 'episodes') return objectRows(value, LIMITS.episodes);
    if (name === 'lootbox') return validateLootbox(value);
    if (name === 'profile') return validateProfile(value);
    return false;
  }

  function affectedSlots(data) {
    if (!plainObject(data)) return [];
    return SLOTS.filter((slot) => Object.prototype.hasOwnProperty.call(data, slot));
  }

  return Object.freeze({ VERSION, SLOTS, LIMITS, plainObject, safeJson, validate, affectedSlots });
});
