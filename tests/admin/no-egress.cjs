const net=require('node:net');const dns=require('node:dns');
let attempts=0;const original=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){let a=Array.isArray(args[0])?args[0]:args;let options=typeof a[0]==='object'?a[0]:{port:a[0],host:typeof a[1]==='string'?a[1]:'localhost'};const host=options.host||'localhost';if(!['localhost','127.0.0.1','::1'].includes(host)){attempts++;throw Error('EXTERNAL_EGRESS_DENIED '+host)}return original.apply(this,args)};
const lookup=dns.lookup;dns.lookup=function(host,...args){if(!['localhost','127.0.0.1','::1'].includes(host)){attempts++;throw Error('EXTERNAL_DNS_DENIED '+host)}return lookup.call(this,host,...args)};
module.exports={get attempts(){return attempts}};
