const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys = require('../config/keys');

const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {

    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');

    return this;

};

mongoose.Query.prototype.exec = async function () {

    try {

        if(!this.useCache) {
            console.log("dont useCache start");

            return exec.apply(this, arguments);

        }

        const key = JSON.stringify(
            Object.assign({}, this.getQuery(), {
                collection: this.mongooseCollection.name}
            ));

        const cacheValue = await client.hget(this.hashKey, key);

        if(cacheValue) {

            console.log("isCached");

            const doc = JSON.parse(cacheValue);

            return Array.isArray(doc)
                ? doc.map(d => new this.model(d))
                : new this.model(doc)

        }

        const result = await exec.apply(this, arguments);

        client.hset([this.hashKey, key, JSON.stringify(result)], 'EX', 10);

        return result;
    } catch (e) {

        console.log("error almog cacche.js");
        console.log(e.toString());
    }

};

module.exports = {
    clearHash(hashKey) {
       client.del(JSON.stringify(hashKey));
    }
};