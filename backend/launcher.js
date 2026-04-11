try {
    console.log('Attempting to require ./src/server2.js...');
    require('./src/server2.js');
    console.log('Successfully required ./src/server2.js');
} catch (err) {
    console.error('Error requiring module:', err);
    if (err.code === 'MODULE_NOT_FOUND') {
        console.error('Module search paths:', module.paths);
    }
}
