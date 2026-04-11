const express = require('express');
const app = require('./src/server'); // Oops wait, does server.js export app? Let's check.
console.log(app);
