/* Small adapters for the existing dictionary and pronunciation modules. */
const byId = id => document.getElementById(id);
const originalWords = new Map();
const extraExamples = {};
const termPattern = /^[A-Za-z]+(?:[ '\u2019-][A-Za-z]+)*$/;
