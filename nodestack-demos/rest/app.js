var restify = require('restify');
var MongoClient = require('mongodb').MongoClient;
var Server = require('mongodb').Server;

var server = restify.createServer({
      name: 'nodestackrest',
      version: '1.0.0'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

// DISCLAIMER:  This is DEMO code just for demonstrating how to connect to MongoDB and make a simple
// rest api.  We are ignoring all the security issues to keep the example simple.

// MongoDB Connection Information
var mongoclient = new MongoClient(new Server("127.0.0.1", 27017), {w: 1});

// Register REST handlers

// GET -> find()
// curl -G -d query={"test":true} localhost:8080/testdb/testcoll
server.get('/:db/:coll', function (req, res, next) {
    var dbName = req.params.db;
    var collName = req.params.coll;

    if (!req.params.query) {
        return next(new Error("\"query\" variable not set"));
    }

    try {
        var query = JSON.parse(req.params.query);
    } catch (err) {
        return next(new Error("Failed to parse JSON document in query variable: " + err.message));
    }

    // Do the find on our collection and db
    mongoclient.db(dbName).collection(collName).find(query).toArray(function(err, docs) {

        if (err) {
            return next(new Error(err));
        }

        res.send(docs);
        return next();
    });
});

// DELETE -> remove()
// curl -X DELETE -d query={"test":true} localhost:8080/testdb/testcoll
server.del('/:db/:coll', function (req, res, next) {
    var dbName = req.params.db;
    var collName = req.params.coll;

    if (!req.params.query) {
        return next(new Error("\"query\" variable not set"));
    }

    try {
        var query = JSON.parse(req.params.query);
    } catch (err) {
        return next(new Error("Failed to parse JSON document in query variable: " + err.message));
    }

    // Do the remove on our collection and db
    mongoclient.db(dbName).collection(collName).remove(query, function(err, docs) {

        if (err) {
            return next(new Error(err));
        }

        res.send("Successfully removed " + docs + " documents");
        return next();
    });
});

// POST -> insert()
// curl -d query={"test":true} localhost:8080/testdb/testcoll
server.post('/:db/:coll', function (req, res, next) {
    var dbName = req.params.db;
    var collName = req.params.coll;

    if (!req.params.query) {
        return next(new Error("\"query\" variable not set"));
    }

    try {
        var query = JSON.parse(req.params.query);
    } catch (err) {
        return next(new Error("Failed to parse JSON document in query variable: " + err.message));
    }

    // Do the insert on our collection and db
    mongoclient.db(dbName).collection(collName).insert(query, function(err, docs) {

        if (err) {
            return next(new Error(err));
        }

        res.send(docs);
        return next();
    });
});

// Open Connection to MongoDB
mongoclient.open(function(err, mongoclient) {

    if (err) {
        console.log(err);
        return;
    }

    // Start listening for clients once we know we are connected to the database
    server.listen(8080, function () {
        console.log('%s listening at %s', server.name, server.url);
    });
});
