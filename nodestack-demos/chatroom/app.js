var http = require('http'), // HTTP server
  io = require('socket.io'), // Socket.io
  fs = require('fs'), // File System
  MongoClient = require('mongodb').MongoClient,
  Server = require('mongodb').Server,
  uuid = require('node-uuid');

// [ client ]
//    /\
//    ||
//    \/
// [ server ]
//    /\
//    ||
//    \/
// [ message bus ]

// Note:  This is a DEMO and is not meant to be used in production.  It is only meant to be a simple
// example of how to use a capped collection in MongoDB as a message bus.

if ((process.argv.length !== 2) && (process.argv.length !== 5)) {
    console.log("usage: " + process.argv[0] + " " + process.argv[1] + " [<port> <mongohost> <mongoport>]");
    return;
}

var serverListenPort = 8080;
var host = "localhost";
var port = 27017;

if (process.argv.length === 5) {
    serverListenPort = Number(process.argv[2]);
    host = process.argv[3]
    port = Number(process.argv[4]);
}

// Helper class to handle interacting with the message bus
MessageBusConnection = function (collection) {

    // Unique id to make sure this server doesn't read its own messages
    var instance = uuid.v4();

    // Start up a tailable cursor on this messagebus collection and return data as it comes
    this.listen = function (callback) {

        // Make this cursor tailable and continuously return new data
        var options = { tailable: true, awaitdata: true, numberOfRetries: -1 };

        // Only get messages that are added after we join
        var query = { "ts" : { "$gt" : new Date() } };

        // Create the cursor and sort by message time
        var cursor = collection.find(query, options).sort({ "ts" : 1 });

        // Register callback for each document cursor returns
        cursor.each(function (err, doc) {

            if (err) {
                console.log(err);
                callback(new Error("Failed to read document"));
            }

            if (doc === null) {
                return;
            }

            if (doc.instance !== instance) {
                callback(null, doc);
            }
        });
    };

    // Put a message in the messagebus collection with the necessary information
    this.put = function (message, user, callback) {

        var messageBusDocument = {
            "message" : message,
            "user" : user,
            "instance" : instance,
            "ts" : new Date()
        };

        collection.insert(messageBusDocument, function (err, insertedDoc) {

            if (err) {
                console.log(err);
                callback(new Error("Failed to insert document"));
            }

            callback (null, insertedDoc);
        });
    }
}

// Helper class to connect to the messagebus collection in MongoDB
MessageBus = function () { }
MessageBus.connect = function (host, port, callback) {

    // MongoDB connection information
    var mongoclient = new MongoClient(new Server(host, port, {}), { "w" : 1 });

    // Open connection to the database
    mongoclient.open(function (err, mongoclient) {

        // Get our database
        var db = mongoclient.db("chatserver");

        // Get our messagebus collection or create it if it doesn't exist
        db.createCollection('messagebus', {'capped':true, 'size':100 * 1024 * 1024}, function(err, collection) {

            // The MessageBusConnection is our interface to this collection
            callback(new MessageBusConnection(collection));
        });
    });
}

MessageBus.connect(host, port, function (messageBusConnection) {

    // Make a simple server that just serves index.html
    server = http.createServer(function(req, res){
        res.writeHead(200, {'Content-Type': 'text/html'});
        // read index.html and send it to the client
        var output = fs.readFileSync('./index.html', 'utf8');
        res.end(output);
    });

    // Attach a socket to our server
    var socket = io.listen(server);

    // Handler registration
    socket.on('connection', function (client) {

        // Send out welcome messages just to this client
        client.emit("message", {
            "message" : "Welcome to the Nodestack example chat app!",
            "user" : "Server",
        });

        // Start listening on behalf of this client
        messageBusConnection.listen(function (err, doc) {
            client.emit("message", doc);
        });

        // Client should set user name immediately after connecting
        client.on('setusername', function (name) {

            client.set('username', name.username, function () {

                // Send connection message to messagebus for other servers
                messageBusConnection.put(name.username + " has connected!", "Server", function (err, doc) {

                    if (err) {
                        console.log(err);
                    }

                    // Send connection message to any other clients connected to this server
                    client.broadcast.emit("message", {
                        "message" : name.username + " has connected!",
                        "user" : "Server"
                    });

                    console.log("Successfully inserted connection message.");
                });

                console.log('Connect by ', name);
            });
        });

        // Recieved a message from the client
        client.on('message', function (msg) {

            client.get('username', function (err, name) {

                // Send message to messagebus for other servers
                messageBusConnection.put(msg.message, name, function (err, doc) {

                    if (err) {
                        console.log(err);
                    }

                    // Send message to any other clients connected to this server
                    client.broadcast.emit("message", {
                        "message" : msg.message,
                        "user" : name
                    });

                    console.log("Successfully inserted message from " + name);
                });

                console.log('Chat message by ', name);
            });
        });

        // Client disconnected
        client.on('disconnect', function () {

            client.get('username', function (err, name) {

                // Send disconnect message to messagebus for other servers
                messageBusConnection.put(name + " has disconnected!", "Server", function (err, doc) {

                    if (err) {
                        console.log(err);
                    }

                    // Send disconnect message to any other clients connected to this server
                    client.broadcast.emit("message", {
                        "message" : name + " has disconnected!",
                        "user" : "Server"
                    });

                    console.log("Successfully inserted disconnect message.");
                });

                console.log('Disconnect by ', name);
            });
        });
    });

    // Start our http server
    console.log("Server listening on: " + serverListenPort);
    server.listen(serverListenPort);
});
