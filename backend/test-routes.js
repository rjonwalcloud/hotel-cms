const app = require('./src/server');

const printRoutes = (router, basePath = '') => {
    if (router && router.stack) {
        router.stack.forEach((layer) => {
            if (layer.route) {
                const path = layer.route.path;
                const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
                console.log(`${methods} ${basePath}${path}`);
            } else if (layer.name === 'router' && layer.handle) {
                // Nested router
                const regexp = layer.regexp.toString();
                // Super basic regex parsing to get path prefix
                const match = regexp.match(/^\/\^\\\/?(?:\?\=\\\/)?(.*?)\\\/?\?\(\?\=\\\/\|\$\)/);
                let nestedPath = '';
                if (match && match[1]) {
                    nestedPath = '/' + match[1].replace(/\\\//g, '/');
                } else if (regexp.includes('bulk-bookings')) {
                    nestedPath = '/api/bulk-bookings';
                }
                printRoutes(layer.handle, basePath + nestedPath);
            }
        });
    }
};

console.log("Registered routes:");
printRoutes(app._router);
process.exit(0);
